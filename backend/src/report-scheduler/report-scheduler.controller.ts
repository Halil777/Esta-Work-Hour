import { Controller, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
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
    @Req() req: any,
    @Query('date') date?: string,
    @Query('reportType') reportType?: string,
    @Query('lang') lang?: string,
  ) {
    const l = lang || 'tr';
    await this.service.sendNow(
      date, (reportType as ReportType) ?? 'daily_all',
      req.adminUser?.tenantId, req.adminUser?.tenantName, l,
    );
    const msg: Record<string, string> = {
      en: 'Daily report sent',
      ru: 'Ежедневный отчёт отправлен',
      tr: 'Günlük rapor gönderildi',
    };
    return { ok: true, message: msg[l] ?? 'Günlük rapor gönderildi' };
  }

  /** Manually send range (date-range + optional worker filter) */
  @Post('send-range')
  async sendRange(
    @Req() req: any,
    @Body('startDate') startDate: string,
    @Body('endDate') endDate: string,
    @Body('workerIds') workerIds?: string[],
    @Body('customEmails') customEmails?: string[],
    @Body('lang') lang?: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
    }
    const l = lang || 'tr';
    await this.service.sendRange(
      startDate, endDate, workerIds, customEmails,
      req.adminUser?.tenantId, req.adminUser?.tenantName, l,
    );
    const msg: Record<string, string> = {
      en: `Report sent (${startDate} — ${endDate})`,
      ru: `Отчёт отправлен (${startDate} — ${endDate})`,
      tr: `Rapor gönderildi (${startDate} — ${endDate})`,
    };
    return { ok: true, message: msg[l] ?? `Rapor gönderildi (${startDate} — ${endDate})` };
  }
}
