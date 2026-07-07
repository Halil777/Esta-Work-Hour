import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { ReportConfigService } from '../report-config/report-config.service';
import { ReportsService } from '../reports/reports.service';
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
      if (schedule.lastSentDate === today) continue; // already sent today

      try {
        // Report date: yesterday's attendance data
        const reportDate = yesterdayLocal();
        const xlsx = await this.reportsService.generateDailyXlsx(reportDate);

        await this.transporter.sendMail({
          from: `"Esta WorkForce" <${process.env.MAIL_USER}>`,
          to: emails.join(', '),
          subject: `Esta WorkForce — Günlük Hasabat (${reportDate})`,
          html: `
            <div style="font-family:sans-serif;max-width:500px">
              <h2 style="color:#1e3a5f">Esta WorkForce Günlük Hasabat</h2>
              <p>Sene: <strong>${reportDate}</strong></p>
              <p>Ektäki Excel faýlda ähli işçileriň gelmegi/gelmändigi baradaky maglumat bar.</p>
              <hr/>
              <p style="color:#888;font-size:12px">Bu habar awtomatik iberildi — Esta WorkForce Ulgamy</p>
            </div>
          `,
          attachments: [
            {
              filename: `hasabat-${reportDate}.xlsx`,
              content: xlsx,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ],
        });

        await this.reportConfigService.updateScheduleLastSent(schedule.id, today);
        this.logger.log(`Report sent for ${reportDate} to ${emails.join(', ')}`);
      } catch (err) {
        this.logger.error(`Failed to send report for schedule ${schedule.id}: ${err}`);
      }
    }
  }

  /** Manually trigger report send (for testing from controller) */
  async sendNow(date?: string): Promise<void> {
    const reportDate = date ?? yesterdayLocal();
    const { emails } = await this.reportConfigService.getConfig();
    if (emails.length === 0) throw new Error('No recipient emails configured');

    const xlsx = await this.reportsService.generateDailyXlsx(reportDate);

    await this.transporter.sendMail({
      from: `"Esta WorkForce" <${process.env.MAIL_USER}>`,
      to: emails.join(', '),
      subject: `Esta WorkForce — Günlük Hasabat (${reportDate})`,
      html: `
        <div style="font-family:sans-serif;max-width:500px">
          <h2 style="color:#1e3a5f">Esta WorkForce Günlük Hasabat</h2>
          <p>Sene: <strong>${reportDate}</strong></p>
          <p>Ektäki Excel faýlda ähli işçileriň gelmegi/gelmändigi baradaky maglumat bar.</p>
          <hr/>
          <p style="color:#888;font-size:12px">Bu habar El bilen iberildi — Esta WorkForce Ulgamy</p>
        </div>
      `,
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
