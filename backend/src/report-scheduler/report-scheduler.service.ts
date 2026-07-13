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

  // ─── Daily scheduled send ────────────────────────────────────────────────────

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
        this.logger.log(`Daily report [${reportType}] sent for ${reportDate} → ${emails.join(', ')}`);
      } catch (err) {
        this.logger.error(`Failed to send daily report for schedule ${schedule.id}: ${err}`);
      }
    }
  }

  // ─── Monthly auto-send (1st of each month) ───────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSendMonthly() {
    const now = new Date();
    if (now.getDate() !== 1) return; // only fire on 1st of month

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // triggerMonth = YYYY-MM of TODAY (i.e., the month we are in when we trigger)
    const triggerMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { monthlySchedule, emails: defaultEmails } = await this.reportConfigService.getConfig();
    if (!monthlySchedule.enabled) return;
    if (monthlySchedule.time !== currentTime) return;
    if (monthlySchedule.lastSentMonth === triggerMonth) return; // already sent this month

    // Previous month date range
    const prevFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevLast  = new Date(now.getFullYear(), now.getMonth(), 0);
    const startDate = prevFirst.toISOString().split('T')[0];
    const endDate   = prevLast.toISOString().split('T')[0];

    const recipients = monthlySchedule.emails.length > 0
      ? monthlySchedule.emails
      : defaultEmails;

    if (recipients.length === 0) {
      this.logger.warn('Monthly report: no recipient emails configured, skipping');
      return;
    }

    try {
      const { xlsx, html, subject } = await this.reportsService.generateRangeReport(
        startDate, endDate, undefined, true,
      );

      await this.transporter.sendMail({
        from: `"Esta WorkForce" <${process.env.MAIL_USER}>`,
        to: recipients.join(', '),
        subject,
        html,
        attachments: [
          {
            filename: `ayylik-hasabat-${startDate}-${endDate}.xlsx`,
            content: xlsx,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      });

      await this.reportConfigService.updateMonthlyLastSent(triggerMonth);
      this.logger.log(`Monthly report sent for ${startDate}..${endDate} → ${recipients.join(', ')}`);
    } catch (err) {
      this.logger.error(`Monthly report failed: ${err}`);
    }
  }

  // ─── Manual trigger: daily ────────────────────────────────────────────────────

  async sendNow(date?: string, reportType: ReportType = 'daily_all'): Promise<void> {
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

  // ─── Manual trigger: range ────────────────────────────────────────────────────

  async sendRange(
    startDate: string,
    endDate: string,
    workerIds?: string[],
    customEmails?: string[],
  ): Promise<void> {
    const { emails: configEmails } = await this.reportConfigService.getConfig();
    const recipients = customEmails && customEmails.length > 0 ? customEmails : configEmails;
    if (recipients.length === 0) throw new Error('No recipient emails configured');

    const { xlsx, html, subject } = await this.reportsService.generateRangeReport(
      startDate, endDate, workerIds, false,
    );

    await this.transporter.sendMail({
      from: `"Esta WorkForce" <${process.env.MAIL_USER}>`,
      to: recipients.join(', '),
      subject,
      html,
      attachments: [
        {
          filename: `is-sagatlary-${startDate}-${endDate}.xlsx`,
          content: xlsx,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      ],
    });

    this.logger.log(`Range report sent [${startDate}..${endDate}] → ${recipients.join(', ')}`);
  }
}
