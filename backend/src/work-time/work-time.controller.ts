import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import type { Response } from 'express';
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
   * Monthly Excel export — per-worker × per-day matrix.
   * GET /api/admin/work-time/export-xlsx?month=2026-08&mode=times|hours|both
   */
  @Get('export-xlsx')
  async exportXlsx(
    @Req() req: any,
    @Query('month') month: string,
    @Query('mode') mode: string,
    @Res() res: Response,
  ) {
    const m    = month ?? new Date().toISOString().slice(0, 7);
    const md   = (['times', 'hours', 'both'].includes(mode) ? mode : 'hours') as 'times' | 'hours' | 'both';
    const buf  = await this.svc.generateMonthXlsx(m, req.adminUser.tenantId, md);
    const name = `is-wagty-${m}-${md}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(buf);
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
