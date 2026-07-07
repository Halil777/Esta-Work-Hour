import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { ReportConfigService } from '../report-config/report-config.service';
import { ReportsService } from '../reports/reports.service';
import { ReportType } from '../report-config/report-config.entity';
import { yesterdayLocal, todayLocal } from '../common/date-utils';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  private readonly transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER ?? '',
      pass: process.env.MAIL_PASS ?? '',
    },
  });

  constructor(
    private readonly reportConfigService: ReportConfigService,
    private readonly reportsService: ReportsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSend() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = todayLocal();

    const { emails, schedules } = await this.reportConfigService.getConfig();
    if (emails.length === 0) return;

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      if (schedule.time !== currentTime) continue;
      if (schedule.lastSentDate === today) continue;

      try {
        const reportDate = yesterdayLocal();
        const reportType: ReportType = schedule.reportType ?? 'daily_all';
        const { xlsx, html } = await this.reportsService.generateReport(reportDate, reportType, false);

        await this.transporter.sendMail({
          from: `"Esta WorkForce" <${process.env.MAIL_USER}>`,
          to: emails.join(', '),
          subject: `Esta WorkForce — ${schedule.label} (${reportDate})`,
          html,
          attachments: [
            {
              filename: `hasabat-${reportDate}.xlsx`,
              content: xlsx,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });

        await this.reportConfigService.updateScheduleLastSent(schedule.id, today);
        this.logger.log(`Report [${reportType}] sent for ${reportDate} to ${emails.join(', ')}`);
      } catch (err) {
        this.logger.error(`Failed to send report for schedule ${schedule.id}: ${err}`);
      }
    }
  }

  /** Manually trigger report send from admin panel */
  async sendNow(date?: string, reportType: ReportType = 'daily_all'): Promise<void> {
    // Manual sends use today's date by default (for testing current-day scans)
    const reportDate = date ?? todayLocal();
    const { emails } = await this.reportConfigService.getConfig();
    if (emails.length === 0) throw new Error('No recipient emails configured');

    const { xlsx, html } = await this.reportsService.generateReport(reportDate, reportType, true);

    await this.transporter.sendMail({
      from: `"Esta WorkForce" <${process.env.MAIL_USER}>`,
      to: emails.join(', '),
      subject: `Esta WorkForce — Günlük Hasabat (${reportDate})`,
      html,
      attachments: [
        {
          filename: `hasabat-${reportDate}.xlsx`,
          content: xlsx,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });
  }
}
