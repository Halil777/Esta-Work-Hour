import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from '../workers/worker.entity';
import { AttendanceEventsService } from '../attendance-events/attendance-events.service';
import { SyncEventsDto } from '../attendance-events/dto/sync-events.dto';
import { DeviceGuard } from './device.guard';

@Controller('device')
@UseGuards(DeviceGuard)
export class DeviceController {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    private readonly attendanceService: AttendanceEventsService,
  ) {}

  /**
   * Returns only the workers that belong to this tenant.
   * The Android NFC scanner uses this to populate its local worker list.
   */
  @Get('workers')
  async getWorkers(@Req() req: any) {
    const { tenantId } = req.device as { tenantId: string; tenantName: string };
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
   * Syncs NFC attendance events from the device, tagged with this tenant's ID.
   */
  @Post('attendance/sync')
  syncEvents(@Req() req: any, @Body() dto: SyncEventsDto) {
    const { tenantId } = req.device as { tenantId: string; tenantName: string };
    return this.attendanceService.syncEvents(dto, tenantId);
  }
}
