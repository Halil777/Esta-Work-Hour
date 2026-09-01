import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { ScannerDevice } from './scanner-device.entity';
import { Worker } from '../workers/worker.entity';
import { CreateScannerDeviceDto } from './dto/create-scanner-device.dto';
import { UpdateScannerDeviceDto } from './dto/update-scanner-device.dto';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';

@Injectable()
export class ScannerDevicesService {
  constructor(
    @InjectRepository(ScannerDevice)
    private readonly repo: Repository<ScannerDevice>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    private readonly attendanceEventsService: AttendanceEventsService,
  ) {}

  async findAll(tenantId: string) {
    const devices = await this.repo.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    const statsRows = await this.attendanceEventsService.getDeviceScanStats(tenantId);
    const statsByDevice = new Map(statsRows.map(s => [s.deviceId, s]));

    // Attach operator worker name + this device's scan stats
    return Promise.all(devices.map(async d => {
      let operatorName: string | null = null;
      if (d.workerEntityId) {
        const w = await this.workerRepo.findOne({
          where: { id: d.workerEntityId },
          select: ['id', 'name', 'workerId'],
        });
        operatorName = w?.name ?? null;
      }
      const { token: _, ...rest } = d;
      const stats = statsByDevice.get(d.id);
      return {
        ...rest,
        operatorName,
        tokenPrefix: d.token.slice(0, 8),
        totalWorkersScanned: stats?.totalWorkers ?? 0,
        todayWorkersScanned: stats?.todayWorkers ?? 0,
        totalScans: stats?.totalScans ?? 0,
        todayScans: stats?.todayScans ?? 0,
      };
    }));
  }

  /** Tenant-wide scan summary for the small dashboard strip on the page. */
  async getScanSummary(tenantId: string) {
    return this.attendanceEventsService.getTenantScanSummary(tenantId);
  }

  /**
   * Operator scan log (Operator Journaly tab): who (device/operator)
   * scanned which workers on which days, with device label + operator name
   * attached so the frontend doesn't need a second round-trip.
   */
  async getOperatorScanLog(tenantId: string, startDate: string, endDate: string) {
    const [logRows, devices] = await Promise.all([
      this.attendanceEventsService.getOperatorScanLog(tenantId, startDate, endDate),
      this.repo.find({ where: { tenantId } }),
    ]);

    const deviceMap = new Map(devices.map(d => [d.id, d]));
    const operatorIds = [...new Set(devices.map(d => d.workerEntityId).filter((id): id is string => !!id))];
    const operators = operatorIds.length > 0
      ? await this.workerRepo.find({ where: { id: In(operatorIds) }, select: ['id', 'name'] })
      : [];
    const operatorNameById = new Map(operators.map(o => [o.id, o.name]));

    return logRows.map(r => {
      const device = deviceMap.get(r.deviceId);
      return {
        ...r,
        deviceLabel: device?.label ?? 'Näbelli enjam',
        operatorName: device?.workerEntityId ? (operatorNameById.get(device.workerEntityId) ?? null) : null,
      };
    });
  }

  /**
   * Per-scan GPS points with device label + operator name joined in, for
   * the tenant-admin operator scan-locations map.
   */
  async getScanLocations(tenantId: string, startDate?: string, endDate?: string) {
    const [points, devices] = await Promise.all([
      this.attendanceEventsService.getScanLocations(tenantId, startDate, endDate),
      this.repo.find({ where: { tenantId } }),
    ]);

    const deviceMap = new Map(devices.map(d => [d.id, d]));
    const operatorIds = [...new Set(devices.map(d => d.workerEntityId).filter((id): id is string => !!id))];
    const operators = operatorIds.length > 0
      ? await this.workerRepo.find({ where: { id: In(operatorIds) }, select: ['id', 'name'] })
      : [];
    const operatorNameById = new Map(operators.map(o => [o.id, o.name]));

    return points.map(p => {
      const device = deviceMap.get(p.deviceId);
      return {
        ...p,
        deviceLabel: device?.label ?? 'Näbelli enjam',
        operatorName: device?.workerEntityId ? (operatorNameById.get(device.workerEntityId) ?? null) : null,
      };
    });
  }

  async getToken(tenantId: string, id: string) {
    const device = await this.repo.findOneBy({ id, tenantId });
    if (!device) throw new NotFoundException('Enjam tapylmady');
    return { token: device.token };
  }

  async create(tenantId: string, dto: CreateScannerDeviceDto) {
    const token = randomUUID();
    const device = this.repo.create({
      tenantId,
      label: dto.label,
      token,
      workerEntityId: dto.workerEntityId ?? null,
      location: dto.location ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(device);
    // Return token once (on creation)
    return { ...saved };
  }

  async update(tenantId: string, id: string, dto: UpdateScannerDeviceDto) {
    const device = await this.repo.findOneBy({ id, tenantId });
    if (!device) throw new NotFoundException('Enjam tapylmady');

    if (dto.label !== undefined) device.label = dto.label;
    if (dto.workerEntityId !== undefined) device.workerEntityId = dto.workerEntityId ?? null;
    if (dto.location !== undefined) device.location = dto.location ?? null;
    if (dto.isActive !== undefined) device.isActive = dto.isActive;

    const saved = await this.repo.save(device);
    const { token: _, ...rest } = saved;
    return { ...rest, tokenPrefix: saved.token.slice(0, 8) };
  }

  async regenerateToken(tenantId: string, id: string) {
    const device = await this.repo.findOneBy({ id, tenantId });
    if (!device) throw new NotFoundException('Enjam tapylmady');
    device.token = randomUUID();
    const saved = await this.repo.save(device);
    return { token: saved.token };
  }

  async remove(tenantId: string, id: string) {
    const device = await this.repo.findOneBy({ id, tenantId });
    if (!device) throw new NotFoundException('Enjam tapylmady');
    await this.repo.remove(device);
    return { success: true };
  }

  // Used by DeviceGuard
  async findByToken(token: string): Promise<ScannerDevice | null> {
    return this.repo.findOneBy({ token, isActive: true });
  }

  // Used by device setup login endpoint
  async findByWorkerEntityId(workerEntityId: string): Promise<ScannerDevice | null> {
    return this.repo.findOneBy({ workerEntityId, isActive: true });
  }

  async updateLastSeen(id: string) {
    await this.repo.update(id, { lastSeenAt: new Date() });
  }

  // Used by the device heartbeat endpoint
  async updateHeartbeat(
    id: string,
    data: { batteryLevel?: number; appVersion?: string; pendingEventCount?: number },
  ) {
    await this.repo.update(id, {
      ...(data.batteryLevel !== undefined ? { batteryLevel: data.batteryLevel } : {}),
      ...(data.appVersion !== undefined ? { appVersion: data.appVersion } : {}),
      ...(data.pendingEventCount !== undefined ? { pendingEventCount: data.pendingEventCount } : {}),
      lastHeartbeatAt: new Date(),
    });
    return { success: true };
  }
}
