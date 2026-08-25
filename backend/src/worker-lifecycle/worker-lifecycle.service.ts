import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Worker } from '../workers/worker.entity';
import { ReportConfigService } from '../report-config/report-config.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  WorkerLifecycleAction,
  WorkerLifecycleEvent,
  WorkerLifecycleSource,
} from './worker-lifecycle-event.entity';
import {
  WorkerLifecycleReport,
  WorkerLifecycleReportStatus,
} from './worker-lifecycle-report.entity';

type LifecycleCounts = Record<WorkerLifecycleAction, number>;
type Lang = 'en' | 'ru' | 'tr';

// ─── Localized labels (tr / en / ru only — never a fourth language) ────────────

function getLifecycleL(lang: Lang = 'tr', tenantName = 'WorkForce') {
  const L = {
    en: {
      actionLabels: {
        [WorkerLifecycleAction.Created]: 'New Hires',
        [WorkerLifecycleAction.Terminated]: 'Terminated',
        [WorkerLifecycleAction.Restored]: 'Reactivated',
      },
      colIdx: '#', colWorker: 'Worker Name', colTabNo: 'Tab No', colProfession: 'Profession',
      colTeam: 'Team', colMobileRole: 'Mobile Role', colMesai: 'Overtime System',
      colSource: 'Source', colChangedBy: 'Changed By', colNote: 'Reason / Note', colTime: 'Time',
      sourceExcel: 'Excel', sourceManual: 'Manual',
      subject: (date: string) => `${tenantName} — Worker Changes (${date})`,
      emailTitle: `${tenantName} — Worker Changes`,
      emailIntro: (n: number) => `${n} worker lifecycle event(s) recorded in the latest batch.`,
      emailFooter: 'Full details are attached as an Excel file.',
    },
    ru: {
      actionLabels: {
        [WorkerLifecycleAction.Created]: 'Новые сотрудники',
        [WorkerLifecycleAction.Terminated]: 'Уволенные',
        [WorkerLifecycleAction.Restored]: 'Восстановленные',
      },
      colIdx: '#', colWorker: 'Имя работника', colTabNo: 'Таб. №', colProfession: 'Должность',
      colTeam: 'Бригада', colMobileRole: 'Моб. роль', colMesai: 'Система переработки',
      colSource: 'Источник', colChangedBy: 'Кем изменено', colNote: 'Причина / Заметка', colTime: 'Время',
      sourceExcel: 'Excel', sourceManual: 'Вручную',
      subject: (date: string) => `${tenantName} — Изменения по работникам (${date})`,
      emailTitle: `${tenantName} — Изменения по работникам`,
      emailIntro: (n: number) => `В последней партии зафиксировано ${n} событие(й) по работникам.`,
      emailFooter: 'Подробности во вложенном файле Excel.',
    },
    tr: {
      actionLabels: {
        [WorkerLifecycleAction.Created]: 'Yeni İşe Alınanlar',
        [WorkerLifecycleAction.Terminated]: 'İşten Çıkarılanlar',
        [WorkerLifecycleAction.Restored]: 'Yeniden Aktif Edilenler',
      },
      colIdx: '#', colWorker: 'İşçi Adı', colTabNo: 'Sicil No', colProfession: 'Meslek',
      colTeam: 'Ekip', colMobileRole: 'Mobil Rol', colMesai: 'Mesai Sistemi',
      colSource: 'Kaynak', colChangedBy: 'Değiştiren', colNote: 'Sebep / Not', colTime: 'Zaman',
      sourceExcel: 'Excel', sourceManual: 'Manuel',
      subject: (date: string) => `${tenantName} — İşçi Değişiklikleri (${date})`,
      emailTitle: `${tenantName} — İşçi Değişiklikleri`,
      emailIntro: (n: number) => `Son grup için ${n} adet işçi hareketi kaydedildi.`,
      emailFooter: 'Detaylar ekteki Excel dosyasında yer almaktadır.',
    },
  };
  return L[lang] ?? L.tr;
}
type LifecycleL = ReturnType<typeof getLifecycleL>;

@Injectable()
export class WorkerLifecycleService {
  private readonly logger = new Logger(WorkerLifecycleService.name);

  private readonly transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER ?? '',
      pass: process.env.MAIL_PASS ?? '',
    },
  });

  constructor(
    @InjectRepository(WorkerLifecycleEvent)
    private readonly repo: Repository<WorkerLifecycleEvent>,
    @InjectRepository(WorkerLifecycleReport)
    private readonly reportRepo: Repository<WorkerLifecycleReport>,
    private readonly reportConfigService: ReportConfigService,
    private readonly tenantsService: TenantsService,
  ) {}

  async recordCreated(
    worker: Worker,
    changedBy = 'Admin',
    source = WorkerLifecycleSource.Manual,
    note?: string | null,
  ) {
    return this.record(WorkerLifecycleAction.Created, worker, changedBy, source, note);
  }

  async recordTerminated(
    worker: Worker,
    changedBy = 'Admin',
    source = WorkerLifecycleSource.Manual,
    note?: string | null,
  ) {
    return this.record(WorkerLifecycleAction.Terminated, worker, changedBy, source, note);
  }

  async recordRestored(
    worker: Worker,
    changedBy = 'Admin',
    source = WorkerLifecycleSource.Manual,
    note?: string | null,
  ) {
    return this.record(WorkerLifecycleAction.Restored, worker, changedBy, source, note);
  }

  async getPendingSummary(tenantId?: string) {
    const pending = await this.repo.find({
      where: { reportedAt: IsNull(), tenantId: tenantId ?? IsNull() },
      order: { eligibleAt: 'ASC' },
    });
    const counts = this.emptyCounts();
    for (const event of pending) counts[event.action] += 1;
    return {
      total: pending.length,
      counts,
      nextSendAt: pending[0]?.eligibleAt ?? null,
      delayMinutes: this.manualDelayMinutes(),
    };
  }

  // No dedicated tenantId column on the reports table (avoids a production
  // schema migration) — scope by joining through the events each report was
  // built from instead. tenantId omitted = platform-level / legacy view.
  async listReports(tenantId?: string, limit = 30) {
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    if (!tenantId) {
      return this.reportRepo.find({ order: { createdAt: 'DESC' }, take: safeLimit });
    }
    const rows: { batchId: string | null }[] = await this.repo
      .createQueryBuilder('e')
      .select('DISTINCT e."reportBatchId"', 'batchId')
      .where('e."tenantId" = :tenantId', { tenantId })
      .andWhere('e."reportBatchId" IS NOT NULL')
      .getRawMany();
    const batchIds = rows.map(r => r.batchId).filter((id): id is string => !!id);
    if (batchIds.length === 0) return [];
    return this.reportRepo.find({
      where: { batchId: In(batchIds) },
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
  }

  async downloadReport(batchId: string, tenantId?: string) {
    const report = await this.findReport(batchId, tenantId);
    const events = await this.findReportEvents(report);
    const lang = await this.resolveLang(tenantId);
    const tenantName = await this.resolveTenantName(tenantId);
    const buffer = await this.buildWorkbook(events, lang, tenantName);
    return {
      report,
      buffer,
      filename: `${report.batchId}.xlsx`,
    };
  }

  async resendReport(batchId: string, tenantId?: string) {
    const report = await this.findReport(batchId, tenantId);
    const events = await this.findReportEvents(report);
    return this.sendEventBatch(events, tenantId, { report, isResend: true, markEventsReported: false });
  }

  async sendPendingNow(tenantId?: string) {
    const events = await this.repo.find({
      where: { reportedAt: IsNull(), tenantId: tenantId ?? IsNull() },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    if (events.length === 0) {
      return { sent: false, message: 'No pending worker lifecycle events' };
    }
    return this.sendEventBatch(events, tenantId, { markEventsReported: true });
  }

  // Runs globally (no request context) — groups eligible pending events by
  // tenant and sends one independent email per tenant, to that tenant's own
  // configured recipients, so tenants' worker data is never mixed together.
  @Cron(CronExpression.EVERY_MINUTE)
  async sendEligibleReports() {
    const now = new Date();
    const eligible = await this.repo.find({
      where: { reportedAt: IsNull(), eligibleAt: LessThanOrEqual(now) },
      order: { createdAt: 'ASC' },
      take: 2000,
    });
    if (eligible.length === 0) return;

    const byTenant = new Map<string | null, WorkerLifecycleEvent[]>();
    for (const event of eligible) {
      const key = event.tenantId ?? null;
      const bucket = byTenant.get(key) ?? [];
      bucket.push(event);
      byTenant.set(key, bucket);
    }

    for (const [tenantId, events] of byTenant) {
      const batch = events.slice(0, 500); // cap per-tenant batch, same as before
      await this.sendEventBatch(batch, tenantId ?? undefined, { markEventsReported: true, now });
    }
  }

  private async record(
    action: WorkerLifecycleAction,
    worker: Worker,
    changedBy: string,
    source: WorkerLifecycleSource,
    note?: string | null,
  ) {
    const delayMinutes = source === WorkerLifecycleSource.Manual
      ? this.manualDelayMinutes()
      : this.bulkDelayMinutes();

    const eligibleAt = new Date(Date.now() + delayMinutes * 60_000);
    const event = this.repo.create({
      action,
      source,
      workerEntityId: worker.id,
      workerId: worker.workerId,
      workerName: worker.name,
      profession: worker.profession ?? '',
      brigadeName: worker.brigadeName ?? '',
      mobileRole: worker.mobileRole ?? null,
      mesaiSistemi: worker.mesaiSistemi ?? null,
      changedBy,
      note: note?.trim() || null,
      eligibleAt,
      reportedAt: null,
      reportBatchId: null,
      tenantId: worker.tenantId ?? null,
    });
    return this.repo.save(event);
  }

  private manualDelayMinutes(): number {
    const n = Number(process.env.WORKER_LIFECYCLE_REPORT_DELAY_MINUTES ?? 10);
    return Number.isFinite(n) && n >= 0 ? n : 10;
  }

  private bulkDelayMinutes(): number {
    const n = Number(process.env.WORKER_LIFECYCLE_BULK_REPORT_DELAY_MINUTES ?? 0);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  // Resolves a tenant's real display name for report headers/emails. Falls
  // back to the generic 'WorkForce' label (never a hardcoded brand name).
  private async resolveTenantName(tenantId?: string): Promise<string> {
    if (!tenantId) return 'WorkForce';
    try {
      const tenant = await this.tenantsService.findOne(tenantId);
      return tenant?.name || 'WorkForce';
    } catch {
      return 'WorkForce';
    }
  }

  private async resolveLang(tenantId?: string): Promise<Lang> {
    const { lang } = await this.reportConfigService.getConfig(tenantId);
    return (lang === 'en' || lang === 'ru' || lang === 'tr') ? lang : 'tr';
  }

  private async getRecipients(tenantId?: string): Promise<string[]> {
    if (!tenantId) {
      const raw = process.env.WORKER_LIFECYCLE_REPORT_EMAILS;
      if (raw?.trim()) {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    const { emails } = await this.reportConfigService.getConfig(tenantId);
    return emails;
  }

  private emptyCounts(): LifecycleCounts {
    return {
      [WorkerLifecycleAction.Created]: 0,
      [WorkerLifecycleAction.Terminated]: 0,
      [WorkerLifecycleAction.Restored]: 0,
    };
  }

  private countEvents(events: WorkerLifecycleEvent[]): LifecycleCounts {
    const counts = this.emptyCounts();
    for (const event of events) counts[event.action] += 1;
    return counts;
  }

  private async findReport(batchId: string, tenantId?: string) {
    const report = await this.reportRepo.findOneBy({ batchId });
    if (!report) throw new NotFoundException(`Worker lifecycle report ${batchId} not found`);
    if (tenantId) {
      const firstEventId = report.eventIds?.[0];
      const owner = firstEventId ? await this.repo.findOneBy({ id: firstEventId }) : null;
      if (!owner || owner.tenantId !== tenantId) {
        throw new NotFoundException(`Worker lifecycle report ${batchId} not found`);
      }
    }
    return report;
  }

  private async findReportEvents(report: WorkerLifecycleReport) {
    if (!report.eventIds?.length) {
      throw new NotFoundException(`Worker lifecycle report ${report.batchId} has no events`);
    }
    const events = await this.repo.find({
      where: { id: In(report.eventIds) },
      order: { createdAt: 'ASC' },
    });
    if (events.length === 0) {
      throw new NotFoundException(`Worker lifecycle report ${report.batchId} events not found`);
    }
    return events;
  }

  private async sendEventBatch(
    events: WorkerLifecycleEvent[],
    tenantId: string | undefined,
    options: {
      report?: WorkerLifecycleReport;
      isResend?: boolean;
      markEventsReported?: boolean;
      now?: Date;
    } = {},
  ) {
    const now = options.now ?? new Date();
    const batchId = options.report?.batchId ?? `worker-lifecycle-${tenantId ?? 'global'}-${Date.now()}`;
    const counts = this.countEvents(events);
    const recipients = await this.getRecipients(tenantId);
    const lang = await this.resolveLang(tenantId);
    const tenantName = await this.resolveTenantName(tenantId);
    const L = getLifecycleL(lang, tenantName);
    const subject = options.report?.subject ?? L.subject(this.formatDate(now));
    const eventIds = events.map(e => e.id);

    const report = options.report ?? this.reportRepo.create({
      batchId,
      status: WorkerLifecycleReportStatus.Failed,
      subject,
      recipients,
      eventCount: events.length,
      counts,
      eventIds,
      error: null,
      sentAt: null,
      resentAt: null,
      resendCount: 0,
    });

    Object.assign(report, {
      subject,
      recipients,
      eventCount: events.length,
      counts,
      eventIds,
    });

    if (recipients.length === 0) {
      report.status = WorkerLifecycleReportStatus.Failed;
      report.error = 'No worker lifecycle report recipient emails configured';
      await this.reportRepo.save(report);
      if (options.markEventsReported && !options.isResend) {
        await this.postponeEvents(eventIds, now);
      }
      this.logger.warn(`${report.error} [tenant:${tenantId ?? 'global'}]`);
      return report;
    }

    try {
      const xlsx = await this.buildWorkbook(events, lang, tenantName);
      await this.transporter.sendMail({
        from: `"${tenantName}" <${process.env.MAIL_USER}>`,
        to: recipients.join(', '),
        subject,
        html: this.buildEmailHtml(events.length, counts, L),
        attachments: [
          {
            filename: `${batchId}.xlsx`,
            content: xlsx,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      });

      if (options.markEventsReported) {
        await this.repo.update(
          { id: In(eventIds) },
          { reportedAt: now, reportBatchId: batchId },
        );
      }

      report.status = WorkerLifecycleReportStatus.Sent;
      report.error = null;
      if (!report.sentAt) report.sentAt = now;
      if (options.isResend) {
        report.resendCount = (report.resendCount ?? 0) + 1;
        report.resentAt = now;
      }
      const saved = await this.reportRepo.save(report);
      this.logger.log(`Worker lifecycle report sent: ${events.length} events -> ${recipients.join(', ')} [tenant:${tenantId ?? 'global'}]`);
      return saved;
    } catch (err: any) {
      report.status = WorkerLifecycleReportStatus.Failed;
      report.error = err?.message ?? String(err);
      const saved = await this.reportRepo.save(report);
      if (options.markEventsReported && !options.isResend) {
        await this.postponeEvents(eventIds, now);
      }
      this.logger.error(`Worker lifecycle report failed [tenant:${tenantId ?? 'global'}]: ${report.error}`);
      return saved;
    }
  }

  private async postponeEvents(eventIds: string[], now: Date) {
    const retryAt = new Date(now.getTime() + this.retryDelayMinutes() * 60_000);
    await this.repo.update({ id: In(eventIds) }, { eligibleAt: retryAt });
  }

  private retryDelayMinutes(): number {
    const n = Number(process.env.WORKER_LIFECYCLE_RETRY_DELAY_MINUTES ?? 10);
    return Number.isFinite(n) && n >= 1 ? n : 10;
  }

  private async buildWorkbook(events: WorkerLifecycleEvent[], lang: Lang, tenantName: string): Promise<Buffer> {
    const L = getLifecycleL(lang, tenantName);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = tenantName;
    wb.created = new Date();

    for (const action of Object.values(WorkerLifecycleAction)) {
      const rows = events.filter(e => e.action === action);
      if (rows.length === 0) continue;

      const ws = wb.addWorksheet(L.actionLabels[action].slice(0, 31));
      ws.columns = [
        { header: L.colIdx, key: 'idx', width: 6 },
        { header: L.colTabNo, key: 'workerId', width: 14 },
        { header: L.colWorker, key: 'workerName', width: 32 },
        { header: L.colProfession, key: 'profession', width: 24 },
        { header: L.colTeam, key: 'brigadeName', width: 22 },
        { header: L.colMobileRole, key: 'mobileRole', width: 16 },
        { header: L.colMesai, key: 'mesaiSistemi', width: 14 },
        { header: L.colSource, key: 'source', width: 14 },
        { header: L.colChangedBy, key: 'changedBy', width: 18 },
        { header: L.colNote, key: 'note', width: 34 },
        { header: L.colTime, key: 'createdAt', width: 20 },
      ];

      ws.getRow(1).eachCell((cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      rows.forEach((event, idx) => {
        ws.addRow({
          idx: idx + 1,
          workerId: event.workerId,
          workerName: event.workerName,
          profession: event.profession,
          brigadeName: event.brigadeName,
          mobileRole: event.mobileRole ?? '',
          mesaiSistemi: event.mesaiSistemi ?? '',
          source: event.source === WorkerLifecycleSource.ExcelImport ? L.sourceExcel : L.sourceManual,
          changedBy: event.changedBy ?? '',
          note: event.note ?? '',
          createdAt: this.formatDateTime(event.createdAt, lang),
        });
      });

      ws.eachRow((row: any, rowNumber: number) => {
        row.eachCell((cell: any) => {
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
          cell.alignment = { vertical: 'middle' };
          if (rowNumber > 1) cell.font = { size: 10 };
        });
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  private buildEmailHtml(total: number, counts: LifecycleCounts, L: LifecycleL): string {
    return `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111827">
        <h2 style="margin:0 0 10px">${L.emailTitle}</h2>
        <p style="margin:0 0 14px;color:#4b5563">${L.emailIntro(total)}</p>
        <table style="border-collapse:collapse;font-size:13px">
          <tr><td style="padding:6px 12px;border:1px solid #e5e7eb">${L.actionLabels[WorkerLifecycleAction.Created]}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700">${counts[WorkerLifecycleAction.Created]}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #e5e7eb">${L.actionLabels[WorkerLifecycleAction.Terminated]}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700">${counts[WorkerLifecycleAction.Terminated]}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #e5e7eb">${L.actionLabels[WorkerLifecycleAction.Restored]}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700">${counts[WorkerLifecycleAction.Restored]}</td></tr>
        </table>
        <p style="margin:14px 0 0;color:#6b7280;font-size:12px">${L.emailFooter}</p>
      </div>
    `;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private formatDateTime(date: Date, lang: Lang): string {
    const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'tr-TR';
    return date.toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
