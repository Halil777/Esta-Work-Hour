import {
  Controller, Get, Post, Body, Param, Req, UseGuards, HttpCode,
  UnauthorizedException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { CardReportsService } from '../card-reports/card-reports.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Worker } from '../workers/worker.entity';
import { MobileCredential } from '../mobile-auth/mobile-credential.entity';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';
import { SyncEventsDto } from '../attendance-events/dto/sync-events.dto';
import { ScannerDevicesService } from '../scanner-devices/scanner-devices.service';
import { TenantsService } from '../tenants/tenants.service';
import { AttendanceAnomaliesService } from '../attendance-anomalies/attendance-anomalies.service';
import { WorkersCrudService } from '../workers/workers-crud.service';
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
    private readonly cardReportsService: CardReportsService,
    private readonly attendanceAnomaliesService: AttendanceAnomaliesService,
    private readonly workersCrudService: WorkersCrudService,
  ) {}

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
   * Workers — only returns this tenant's workers.
   */
  @UseGuards(DeviceGuard)
  @Get('workers')
  async getWorkers(@Req() req: any) {
    const { tenantId } = req.device as DeviceContext;
    const workers = await this.workerRepo.find({
      where: { tenantId },
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

    let changedBy = ctx.deviceLabel || 'NFC Device';
    if (ctx.workerEntityId) {
      const operator = await this.workerRepo.findOne({
        where: { id: ctx.workerEntityId },
        select: ['name'],
      });
      if (operator?.name) changedBy = `${operator.name} (${ctx.deviceLabel})`;
    }

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
   * Submit a card reassignment report from the NFC scanner device.
   */
  @UseGuards(DeviceGuard)
  @Post('card-reports')
  async submitCardReport(
    @Req() req: any,
    @Body('cardUid') cardUid: string,
    @Body('currentWorkerName') currentWorkerName?: string,
    @Body('suggestedWorkerId') suggestedWorkerId?: string,
    @Body('suggestedWorkerName') suggestedWorkerName?: string,
    @Body('note') note?: string,
  ) {
    if (!cardUid) throw new BadRequestException('cardUid is required');
    const { tenantId, deviceLabel } = req.device as DeviceContext;
    return this.cardReportsService.create({
      tenantId,
      cardUid,
      currentWorkerName,
      suggestedWorkerId,
      suggestedWorkerName,
      deviceLabel,
      note,
    });
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
