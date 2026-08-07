import { Controller, Post, Delete, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AttendanceOverridesService } from './attendance-overrides.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('attendance-overrides')
export class AttendanceOverridesController {
  constructor(private readonly service: AttendanceOverridesService) {}

  @Get()
  getForWorker(
    @Query('workerEntityId') workerEntityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getForWorkerRange(workerEntityId, startDate, endDate);
  }

  @Post()
  upsert(
    @Request() req: any,
    @Body('workerEntityId') workerEntityId: string,
    @Body('date') date: string,
    @Body('checkInMs') checkInMs: number | null,
    @Body('checkOutMs') checkOutMs: number | null,
    @Body('note') note: string | null,
    @Body('createdBy') createdBy: string,
  ) {
    const tenantId: string | undefined = req.adminUser?.tenantId;
    return this.service.upsert(
      workerEntityId,
      date,
      checkInMs ? Number(checkInMs) : null,
      checkOutMs ? Number(checkOutMs) : null,
      note ?? null,
      createdBy ?? 'Admin',
      tenantId,
    );
  }

  @Delete()
  remove(
    @Request() req: any,
    @Query('workerEntityId') workerEntityId: string,
    @Query('date') date: string,
    @Query('deletedBy') deletedBy?: string,
  ) {
    const tenantId: string | undefined = req.adminUser?.tenantId;
    return this.service.delete(workerEntityId, date, deletedBy ?? 'Admin', tenantId);
  }
}
