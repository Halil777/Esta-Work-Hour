import {
  Controller, Get, Post, Body, Req, UseGuards,
  UnauthorizedException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Worker } from '../workers/worker.entity';
import { MobileCredential } from '../mobile-auth/mobile-credential.entity';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';
import { SyncEventsDto } from '../attendance-events/dto/sync-events.dto';
import { ScannerDevicesService } from '../scanner-devices/scanner-devices.service';
import { TenantsService } from '../tenants/tenants.service';
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
      select: ['id', 'workerId', 'name', 'profession', 'brigadeName', 'status', 'phone', 'hireDate', 'nfcCardUid'],
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
    }));
  }

  /**
   * Sync NFC attendance events — tagged with tenantId, warns on cross-device double-scan.
   */
  @UseGuards(DeviceGuard)
  @Post('attendance/sync')
  syncEvents(@Req() req: any, @Body() dto: SyncEventsDto) {
    const { tenantId } = req.device as DeviceContext;
    return this.attendanceService.syncEvents(dto, tenantId);
  }
}
