import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { WorkTimeService } from './work-time.service';

@Controller('api/admin/work-time')
@UseGuards(AdminJwtGuard)
export class WorkTimeController {
  constructor(private readonly svc: WorkTimeService) {}

  /**
   * Monthly summary — all workers.
   * GET /api/admin/work-time/month-summary?month=2026-08
   */
  @Get('month-summary')
  getMonthSummary(@Req() req: any, @Query('month') month: string) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.svc.getMonthSummary(m, req.adminUser.tenantId);
  }

  /**
   * Day-by-day timesheet for one worker.
   * GET /api/admin/work-time/timesheet?month=2026-08&workerEntityId=<uuid>
   */
  @Get('timesheet')
  getTimesheet(
    @Req() req: any,
    @Query('workerEntityId') workerEntityId: string,
    @Query('month') month: string,
  ) {
    const m = month ?? new Date().toISOString().slice(0, 7);
    return this.svc.getWorkerTimesheet(workerEntityId, m, req.adminUser.tenantId);
  }
}
