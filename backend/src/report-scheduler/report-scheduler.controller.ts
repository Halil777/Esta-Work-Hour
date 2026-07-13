import { Controller, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ReportSchedulerService } from './report-scheduler.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { ReportType } from '../report-config/report-config.entity';

@UseGuards(AdminJwtGuard)
@Controller('report-config')
export class ReportSchedulerController {
  constructor(private readonly service: ReportSchedulerService) {}

  /** Manually send daily report */
  @Post('send-now')
  async sendNow(
    @Query('date') date?: string,
    @Query('reportType') reportType?: string,
  ) {
    await this.service.sendNow(date, (reportType as ReportType) ?? 'daily_all');
    return { ok: true, message: 'Günlük hasabat iberildi' };
  }

  /** Manually send range (date-range + optional worker filter) */
  @Post('send-range')
  async sendRange(
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
    @Body('workerIds') workerIds?: string[],
    @Body('customEmails') customEmails?: string[],
  ) {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }
    await this.service.sendRange(startDate, endDate, workerIds, customEmails);
    return { ok: true, message: `Hasabat iberildi (${startDate} — ${endDate})` };
  }
}
