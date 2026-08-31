import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import type { Response } from 'express';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { WorkTimeService } from './work-time.service';

@Controller('admin/work-time')
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
    @Query('lang') lang: string,
    @Res() res: Response,
  ) {
    const m    = month ?? new Date().toISOString().slice(0, 7);
    const md   = (['times', 'hours', 'both'].includes(mode) ? mode : 'hours') as 'times' | 'hours' | 'both';
    const l    = lang || 'tr';
    const buf  = await this.svc.generateMonthXlsx(m, req.adminUser.tenantId, md, l);
    const prefixes: Record<string, string> = { en: 'work-time', ru: 'rabochee-vremya', tr: 'mesai-takibi' };
    const prefix = prefixes[l] ?? 'mesai-takibi';
    const name = `${prefix}-${m}-${md}.xlsx`;
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

  /**
   * Single-day summary — all workers, with raw scan check-in/check-out —
   * powers the day-view admin correction screen.
   * GET /api/admin/work-time/day-summary?date=2026-08-20
   */
  @Get('day-summary')
  getDaySummary(@Req() req: any, @Query('date') date: string) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    return this.svc.getDaySummary(d, req.adminUser.tenantId);
  }
}
