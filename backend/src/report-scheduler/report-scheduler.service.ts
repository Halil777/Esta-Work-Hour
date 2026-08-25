import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { ReportConfigService } from '../report-config/report-config.service';
import { ReportsService } from '../reports/reports.service';
import { TenantsService } from '../tenants/tenants.service';
import { ReportType, MonthlySchedule, ReportScheduleItem } from '../report-config/report-config.entity';
import { yesterdayLocal, todayLocal } from '../common/date-utils';

// Filename prefix by language (used for all email attachments)
const FILE_PREFIXES: Record<string, string> = {
  en: 'work-hours',
  ru: 'rabochie-chasy',
  tr: 'calisma-saatleri',
};
function filePrefix(lang: string): string {
  return FILE_PREFIXES[lang] ?? 'calisma-saatleri';
}

// Format a Date as YYYY-MM-DD using LOCAL date components (avoids toISOString UTC shift)
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
    private readonly tenantsService: TenantsService,
  ) {}

  // Resolves a tenant's real display name for report headers/emails. Falls
  // back to the generic 'WorkForce' label (never a hardcoded brand name) when
  // the config isn't tenant-scoped or the tenant lookup fails.
  private async resolveTenantName(tenantId?: string): Promise<string> {
    if (!tenantId) return 'WorkForce';
    try {
      const tenant = await this.tenantsService.findOne(tenantId);
      return tenant?.name || 'WorkForce';
    } catch {
      return 'WorkForce';
    }
  }

  // ─── Daily scheduled send ─────────────────────────────────────────────────────
  // Iterates ALL tenant configs so every tenant's schedule is checked.

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSend() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = todayLocal();

    const allConfigs = await this.reportConfigService.getAllConfigs();

    for (const cfg of allConfigs) {
      const tenantId = cfg.tenantId ?? undefined;
      const emails: string[] = JSON.parse(cfg.emailsJson ?? '[]');
      if (emails.length === 0) continue;

      const schedules: ReportScheduleItem[] = JSON.parse(cfg.schedulesJson ?? '[]');
      const lang = cfg.lang ?? 'tr';

      for (const schedule of schedules) {
        if (!schedule.enabled) continue;
        if (schedule.time !== currentTime) continue;
        if (schedule.lastSentDate === today) continue;

        try {
          const reportDate = yesterdayLocal();
          const reportType: ReportType = schedule.reportType ?? 'daily_all';
          const tenantName = await this.resolveTenantName(tenantId);
          const { xlsx, html } = await this.reportsService.generateReport(
            reportDate, reportType, false, tenantId, tenantName, lang as any,
          );

          await this.transporter.sendMail({
            from: `"${tenantName}" <${process.env.MAIL_USER}>`,
            to: emails.join(', '),
            subject: `${tenantName} — ${schedule.label} (${reportDate})`,
            html,
            attachments: [{
              filename: `${filePrefix(lang)}-${reportDate}.xlsx`,
              content: xlsx,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }],
          });

          await this.reportConfigService.updateScheduleLastSent(schedule.id, today, tenantId);
          this.logger.log(`Daily [${reportType}] sent for ${reportDate} → ${emails.join(', ')} [tenant:${tenantId ?? 'global'}]`);
        } catch (err) {
          this.logger.error(`Daily report failed schedule ${schedule.id} [tenant:${tenantId ?? 'global'}]: ${err}`);
        }
      }
    }
  }

  // ─── Monthly auto-send (1st of each month) ───────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSendMonthly() {
    const now = new Date();
    if (now.getDate() !== 1) return; // only fire on 1st of month

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // triggerMonth = YYYY-MM of the current month (the one we send from, i.e. previous month's report)
    const triggerMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Previous month date range — use local components, never toISOString (UTC shift bug)
    const prevFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevLast  = new Date(now.getFullYear(), now.getMonth(), 0);
    const startDate = fmtDate(prevFirst);
    const endDate   = fmtDate(prevLast);

    const allConfigs = await this.reportConfigService.getAllConfigs();

    for (const cfg of allConfigs) {
      const tenantId = cfg.tenantId ?? undefined;
      const lang = cfg.lang ?? 'tr';

      const monthlySchedule: MonthlySchedule = cfg.monthlyScheduleJson
        ? JSON.parse(cfg.monthlyScheduleJson)
        : { enabled: false, time: '08:00', emails: [], lastSentMonth: null };

      if (!monthlySchedule.enabled) continue;
      if (monthlySchedule.time !== currentTime) continue;
      if (monthlySchedule.lastSentMonth === triggerMonth) continue; // already sent this month

      const defaultEmails: string[] = JSON.parse(cfg.emailsJson ?? '[]');
      const recipients = monthlySchedule.emails.length > 0 ? monthlySchedule.emails : defaultEmails;

      if (recipients.length === 0) {
        this.logger.warn(`Monthly report: no recipients [tenant:${tenantId ?? 'global'}], skipping`);
        continue;
      }

      try {
        const tenantName = await this.resolveTenantName(tenantId);
        const { xlsx, html, subject } = await this.reportsService.generateRangeReport(
          startDate, endDate, undefined, true, tenantId, tenantName, lang as any,
        );

        await this.transporter.sendMail({
          from: `"${tenantName}" <${process.env.MAIL_USER}>`,
          to: recipients.join(', '),
          subject,
          html,
          attachments: [{
            filename: `${filePrefix(lang)}-${startDate}-${endDate}.xlsx`,
            content: xlsx,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }],
        });

        await this.reportConfigService.updateMonthlyLastSent(triggerMonth, tenantId);
        this.logger.log(`Monthly report sent ${startDate}..${endDate} → ${recipients.join(', ')} [tenant:${tenantId ?? 'global'}]`);
      } catch (err) {
        this.logger.error(`Monthly report failed [tenant:${tenantId ?? 'global'}]: ${err}`);
      }
    }
  }

  // ─── Manual trigger: daily ────────────────────────────────────────────────────

  async sendNow(date?: string, reportType: ReportType = 'daily_all', tenantId?: string, tenantName = 'WorkForce', lang = 'tr'): Promise<void> {
    const reportDate = date ?? todayLocal();
    const { emails } = await this.reportConfigService.getConfig(tenantId);
    if (emails.length === 0) throw new Error('No recipient emails configured');

    const { xlsx, html } = await this.reportsService.generateReport(reportDate, reportType, true, tenantId, tenantName, lang as any);

    await this.transporter.sendMail({
      from: `"${tenantName}" <${process.env.MAIL_USER}>`,
      to: emails.join(', '),
      subject: `${tenantName} — ${reportDate}`,
      html,
      attachments: [{
        filename: `${filePrefix(lang)}-${reportDate}.xlsx`,
        content: xlsx,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });
  }

  // ─── Manual trigger: range ────────────────────────────────────────────────────

  async sendRange(
    startDate: string,
    endDate: string,
    workerIds?: string[],
    customEmails?: string[],
    tenantId?: string,
    tenantName = 'WorkForce',
    lang = 'tr',
  ): Promise<void> {
    const { emails: configEmails } = await this.reportConfigService.getConfig(tenantId);
    const recipients = customEmails && customEmails.length > 0 ? customEmails : configEmails;
    if (recipients.length === 0) throw new Error('No recipient emails configured');

    const { xlsx, html, subject } = await this.reportsService.generateRangeReport(
      startDate, endDate, workerIds, false, tenantId, tenantName, lang as any,
    );

    await this.transporter.sendMail({
      from: `"${tenantName}" <${process.env.MAIL_USER}>`,
      to: recipients.join(', '),
      subject,
      html,
      attachments: [{
        filename: `${filePrefix(lang)}-${startDate}-${endDate}.xlsx`,
        content: xlsx,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    this.logger.log(`Range report sent [${startDate}..${endDate}] → ${recipients.join(', ')} [tenant:${tenantId ?? 'global'}]`);
  }
}
