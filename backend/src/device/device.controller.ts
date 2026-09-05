import {
  Controller, Get, Post, Body, Param, Req, UseGuards, HttpCode,
  UnauthorizedException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Worker, WorkerStatus } from '../workers/worker.entity';
import { MobileCredential } from '../mobile-auth/mobile-credential.entity';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';
import { SyncEventsDto } from '../attendance-events/dto/sync-events.dto';
import { ScannerDevicesService } from '../scanner-devices/scanner-devices.service';
import { TenantsService } from '../tenants/tenants.service';
import { AttendanceAnomaliesService } from '../attendance-anomalies/attendance-anomalies.service';
import { WorkersCrudService } from '../workers/workers-crud.service';
import { CardAssignmentHistoryService } from '../card-assignment-history/card-assignment-history.service';
import { DeviceGuard } from './device.guard';

type DeviceContext = {
  tenantId: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  deviceId: string;
  deviceLabel: string;
  deviceLocation: string | null;
  workerEntityId: string | null;
};

@Controller('device')
export class DeviceController {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(MobileCredential)
    private readonly credRepo: Repository<MobileCredential>,
    private readonly attendanceService: AttendanceEventsService,
    private readonly scannerDevicesService: ScannerDevicesService,
    private readonly tenantsService: TenantsService,
    private readonly attendanceAnomaliesService: AttendanceAnomaliesService,
    private readonly workersCrudService: WorkersCrudService,
    private readonly cardAssignmentHistory: CardAssignmentHistoryService,
  ) {}

  /**
   * "Who did this" for the card-assignment audit trail — the operator's
   * name (looked up from the worker record the device was logged in as)
   * plus the device label, or just the device label if the device was
   * never tied to a specific worker login. Mirrors changeWorkerShift()'s
   * changedBy resolution below so both device-initiated actions read the
   * same way in the admin panel's history.
   */
  private async resolveChangedBy(ctx: DeviceContext): Promise<string> {
    let changedBy = ctx.deviceLabel || 'NFC Device';
    if (ctx.workerEntityId) {
      const operator = await this.workerRepo.findOne({
        where: { id: ctx.workerEntityId },
        select: ['name'],
      });
      if (operator?.name) changedBy = `${operator.name} (${ctx.deviceLabel})`;
    }
    return changedBy;
  }

  /**
   * First-time setup: worker logs in with mobile credentials → server returns device token.
   * The Android app stores the token and uses it for subsequent requests.
   */
  @Post('setup')
  async setup(@Body('username') username: string, @Body('password') password: string) {
    if (!username || !password) throw new BadRequestException('Username we parol gerek');

    const cred = await this.credRepo.findOneBy({ username, isActive: true });
    if (!cred) throw new UnauthorizedException('Ulanyjy ady ýa-da parol nädogry');

    const valid = await bcrypt.compare(password, cred.passwordHash);
    if (!valid) throw new UnauthorizedException('Ulanyjy ady ýa-da parol nädogry');

    const worker = await this.workerRepo.findOneBy({ id: cred.workerEntityId });
    if (!worker) throw new NotFoundException('Işçi tapylmady');

    const device = await this.scannerDevicesService.findByWorkerEntityId(worker.id);
    if (!device) {
      throw new NotFoundException('Bu işçä enjam birikdirilmändir. Tenant admin bilen habarlaşyň.');
    }

    const tenant = await this.tenantsService.findOne(device.tenantId) as any;

    return {
      deviceToken: device.token,
      tenantName: tenant.name,
      tenantLogoUrl: tenant.logoUrl ?? null,
      deviceLabel: device.label,
      deviceLocation: device.location ?? null,
      operatorName: worker.name,
    };
  }

  /** Device info — call after login to refresh tenant name / label */
  @UseGuards(DeviceGuard)
  @Get('info')
  async getInfo(@Req() req: any) {
    const ctx = req.device as DeviceContext;
    let operatorName: string | null = null;
    if (ctx.workerEntityId) {
      const w = await this.workerRepo.findOne({ where: { id: ctx.workerEntityId }, select: ['name'] });
      operatorName = w?.name ?? null;
    }
    return {
      tenantName: ctx.tenantName,
      tenantLogoUrl: ctx.tenantLogoUrl,
      deviceLabel: ctx.deviceLabel,
      deviceLocation: ctx.deviceLocation,
      operatorName,
    };
  }

  /**
   * Workers — only returns this tenant's workers, excluding Terminated ones
   * (same convention as the admin panel's default Workers listing — see
   * WorkersQueryService). The device's full-replace sync (WorkerSyncManager)
   * deletes any locally-cached worker no longer present in this response,
   * so excluding Terminated here is what actually purges a fired worker
   * from the app's list and local database, not just hides them.
   */
  @UseGuards(DeviceGuard)
  @Get('workers')
  async getWorkers(@Req() req: any) {
    const { tenantId } = req.device as DeviceContext;
    const workers = await this.workerRepo.find({
      where: { tenantId, status: Not(WorkerStatus.Terminated) },
      select: ['id', 'workerId', 'name', 'profession', 'brigadeName', 'status', 'phone', 'hireDate', 'nfcCardUid', 'shift'],
      order: { name: 'ASC' },
    });
    return workers.map(w => ({
      id: w.id,
      workerId: w.workerId,
      name: w.name,
      profession: w.profession,
      brigadeId: null,
      brigadeName: w.brigadeName,
      status: w.status,
      phone: w.phone,
      hireDate: w.hireDate,
      nfcCardUid: w.nfcCardUid,
      shift: w.shift,
    }));
  }

  /**
   * Home-screen stats + not-scanned shift alerts, computed tenant-wide on the
   * server. Every device polls this same endpoint instead of computing
   * "who scanned" from its own local history, so a worker who scanned on
   * device A is never wrongly shown as not-scanned on device B, and the
   * not-scanned banner shows identically on every device for the tenant
   * until it resolves.
   */
  @UseGuards(DeviceGuard)
  @Get('shift-alerts')
  async getShiftAlerts(@Req() req: any) {
    const { tenantId } = req.device as DeviceContext;
    const [alerts, stats] = await Promise.all([
      this.attendanceAnomaliesService.getShiftAlerts(tenantId),
      this.attendanceService.getTodayStats(tenantId),
    ]);
    return { ...alerts, ...stats };
  }

  /**
   * Operator changes a worker's day/night shift assignment from the device.
   * Reuses the normal worker-update path so the change lands in the same
   * audit trail the admin panel already shows on WorkerDetailPage — no
   * separate notification channel needed.
   */
  @UseGuards(DeviceGuard)
  @Post('workers/:workerId/shift')
  async changeWorkerShift(
    @Req() req: any,
    @Param('workerId') workerId: string,
    @Body('shift') shift: string,
  ) {
    const ctx = req.device as DeviceContext;
    if (shift !== 'day' && shift !== 'night') {
      throw new BadRequestException('shift "day" ýa-da "night" bolmaly');
    }

    const worker = await this.workerRepo.findOne({
      where: { workerId, tenantId: ctx.tenantId },
    });
    if (!worker) throw new NotFoundException('Işçi tapylmady');

    const changedBy = await this.resolveChangedBy(ctx);
    const updated = await this.workersCrudService.update(worker.id, { shift: shift as 'day' | 'night' }, changedBy);
    return { id: updated.id, workerId: updated.workerId, name: updated.name, shift: updated.shift };
  }

  /**
   * Sync NFC attendance events — tagged with tenantId, warns on cross-device double-scan.
   */
  @UseGuards(DeviceGuard)
  @Post('attendance/sync')
  syncEvents(@Req() req: any, @Body() dto: SyncEventsDto) {
    const { tenantId, deviceId } = req.device as DeviceContext;
    return this.attendanceService.syncEvents(dto, tenantId, deviceId);
  }

  /**
   * Operator self-service: clear a worker's NFC card directly from the
   * device — no admin approval step. Used from the mobile app's Settings
   * screen when a card was linked to the wrong worker by mistake: the
   * operator finds that worker there and clears their card, then re-scans
   * it to bind it to the right person via assignCard() below. Replaces the
   * old flow where the device could only *report* a mismatch and an admin
   * had to fix it from the Card Reports queue — every change here is
   * instant and logged to card_assignment_history (source 'mobile-device')
   * so the admin panel's Card History report still shows exactly which
   * operator/device did it and when.
   */
  @UseGuards(DeviceGuard)
  @Post('cards/unbind')
  async unbindCard(
    @Req() req: any,
    @Body('workerId') workerId: string,
    @Body('note') note?: string,
  ) {
    if (!workerId) throw new BadRequestException('workerId is required');
    const ctx = req.device as DeviceContext;

    const worker = await this.workerRepo.findOne({ where: { workerId, tenantId: ctx.tenantId } });
    if (!worker) throw new NotFoundException('Işçi tapylmady');

    if (worker.nfcCardUid) {
      const changedBy = await this.resolveChangedBy(ctx);
      const previousCardUid = worker.nfcCardUid;
      worker.nfcCardUid = null;
      await this.workerRepo.save(worker);
      await this.cardAssignmentHistory.recordChange(worker, previousCardUid, null, {
        source: 'mobile-device',
        changedBy,
        note: note?.trim() || 'Operator tarapyndan enjamdan aýryldy (nädogry baglanan kart)',
      });
    }

    return { workerId: worker.workerId, name: worker.name, nfcCardUid: worker.nfcCardUid };
  }

  /**
   * Operator self-service: bind an NFC card to a worker directly from the
   * device — the counterpart to unbindCard() above, and also what a
   * brand-new/never-seen card goes through the first time it's scanned and
   * linked. Immediately authoritative on the backend (unlike the old
   * "local binding + pending report" flow), so it propagates to every
   * other device's next worker resync and shows up right away in the admin
   * panel and on this worker's own card history.
   */
  @UseGuards(DeviceGuard)
  @Post('cards/assign')
  async assignCard(
    @Req() req: any,
    @Body('cardUid') cardUid: string,
    @Body('workerId') workerId: string,
  ) {
    if (!cardUid) throw new BadRequestException('cardUid is required');
    if (!workerId) throw new BadRequestException('workerId is required');
    const ctx = req.device as DeviceContext;

    const worker = await this.workerRepo.findOne({ where: { workerId, tenantId: ctx.tenantId } });
    if (!worker) throw new NotFoundException('Işçi tapylmady');

    const changedBy = await this.resolveChangedBy(ctx);

    // Clear the card from whoever currently holds it, if that's someone else.
    const currentHolder = await this.workerRepo.findOne({ where: { nfcCardUid: cardUid, tenantId: ctx.tenantId } });
    if (currentHolder && currentHolder.id !== worker.id) {
      currentHolder.nfcCardUid = null;
      await this.workerRepo.save(currentHolder);
      await this.cardAssignmentHistory.recordChange(currentHolder, cardUid, null, {
        source: 'mobile-device',
        changedBy,
        note: `Karta "${worker.name}" adyna geçirildi (enjam arkaly)`,
      });
    }

    const previousCardUid = worker.nfcCardUid;
    worker.nfcCardUid = cardUid;
    await this.workerRepo.save(worker);
    await this.cardAssignmentHistory.recordChange(worker, previousCardUid ?? null, cardUid, {
      source: 'mobile-device',
      changedBy,
      note: null,
    });

    return { workerId: worker.workerId, name: worker.name, nfcCardUid: worker.nfcCardUid };
  }

  /**
   * Periodic device health check-in (battery, APK version, local unsynced
   * event count). Separate from the passive lastSeenAt bump DeviceGuard does
   * on every request — this is a deliberate payload the app sends every
   * couple of minutes so the admin panel can flag a kiosk that's low on
   * battery, stuck on an old build, or quietly backing up unsynced scans.
   */
  @UseGuards(DeviceGuard)
  @Post('heartbeat')
  @HttpCode(200)
  async heartbeat(
    @Req() req: any,
    @Body('batteryLevel') batteryLevel?: number,
    @Body('appVersion') appVersion?: string,
    @Body('pendingEventCount') pendingEventCount?: number,
  ) {
    const { deviceId } = req.device as DeviceContext;
    return this.scannerDevicesService.updateHeartbeat(deviceId, {
      batteryLevel,
      appVersion,
      pendingEventCount,
    });
  }
}
