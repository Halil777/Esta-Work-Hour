import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { Worker } from '../workers/worker.entity';
import { ReportConfigService } from '../report-config/report-config.service';
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

const ACTION_LABELS: Record<WorkerLifecycleAction, string> = {
  [WorkerLifecycleAction.Created]: 'Täze işe alnanlar',
  [WorkerLifecycleAction.Terminated]: 'İşden çykarylanlar',
  [WorkerLifecycleAction.Restored]: 'Gaýtadan aktiw edilenler',
};

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

  async getPendingSummary() {
    const pending = await this.repo.find({
      where: { reportedAt: IsNull() },
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

  async listReports(limit = 30) {
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    return this.reportRepo.find({
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
  }

  async downloadReport(batchId: string) {
    const report = await this.findReport(batchId);
    const events = await this.findReportEvents(report);
    const buffer = await this.buildWorkbook(events);
    return {
      report,
      buffer,
      filename: `${report.batchId}.xlsx`,
    };
  }

  async resendReport(batchId: string) {
    const report = await this.findReport(batchId);
    const events = await this.findReportEvents(report);
    return this.sendEventBatch(events, { report, isResend: true, markEventsReported: false });
  }

  async sendPendingNow() {
    const events = await this.repo.find({
      where: { reportedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    if (events.length === 0) {
      return { sent: false, message: 'No pending worker lifecycle events' };
    }
    return this.sendEventBatch(events, { markEventsReported: true });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sendEligibleReports() {
    const now = new Date();
    const events = await this.repo.find({
      where: { reportedAt: IsNull(), eligibleAt: LessThanOrEqual(now) },
      order: { createdAt: 'ASC' },
      take: 500,
    });

    if (events.length === 0) return;

    await this.sendEventBatch(events, { markEventsReported: true, now });
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

  private async getRecipients(): Promise<string[]> {
    const raw = process.env.WORKER_LIFECYCLE_REPORT_EMAILS;
    if (raw?.trim()) {
      return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    const { emails } = await this.reportConfigService.getConfig();
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

  private async findReport(batchId: string) {
    const report = await this.reportRepo.findOneBy({ batchId });
    if (!report) throw new NotFoundException(`Worker lifecycle report ${batchId} not found`);
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
    options: {
      report?: WorkerLifecycleReport;
      isResend?: boolean;
      markEventsReported?: boolean;
      now?: Date;
    } = {},
  ) {
    const now = options.now ?? new Date();
    const batchId = options.report?.batchId ?? `worker-lifecycle-${Date.now()}`;
    const counts = this.countEvents(events);
    const recipients = await this.getRecipients();
    const subject = options.report?.subject ?? `Esta WorkForce — Işçi hereketleri (${this.formatDate(now)})`;
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
      this.logger.warn(report.error);
      return report;
    }

    try {
      const xlsx = await this.buildWorkbook(events);
      await this.transporter.sendMail({
        from: `"Esta WorkForce" <${process.env.MAIL_USER}>`,
        to: recipients.join(', '),
        subject,
        html: this.buildEmailHtml(events.length, counts),
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
      this.logger.log(`Worker lifecycle report sent: ${events.length} events -> ${recipients.join(', ')}`);
      return saved;
    } catch (err: any) {
      report.status = WorkerLifecycleReportStatus.Failed;
      report.error = err?.message ?? String(err);
      const saved = await this.reportRepo.save(report);
      if (options.markEventsReported && !options.isResend) {
        await this.postponeEvents(eventIds, now);
      }
      this.logger.error(`Worker lifecycle report failed: ${report.error}`);
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

  private async buildWorkbook(events: WorkerLifecycleEvent[]): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Esta WorkForce';
    wb.created = new Date();

    for (const action of Object.values(WorkerLifecycleAction)) {
      const rows = events.filter(e => e.action === action);
      if (rows.length === 0) continue;

      const ws = wb.addWorksheet(ACTION_LABELS[action].slice(0, 31));
      ws.columns = [
        { header: '#', key: 'idx', width: 6 },
        { header: 'Sicil No', key: 'workerId', width: 14 },
        { header: 'İşçi ady', key: 'workerName', width: 32 },
        { header: 'Görev', key: 'profession', width: 24 },
        { header: 'Ekip', key: 'brigadeName', width: 22 },
        { header: 'Mobile rol', key: 'mobileRole', width: 16 },
        { header: 'Mesai', key: 'mesaiSistemi', width: 14 },
        { header: 'Çeşme', key: 'source', width: 14 },
        { header: 'Kim tarapyndan', key: 'changedBy', width: 18 },
        { header: 'Sebäp / Bellik', key: 'note', width: 34 },
        { header: 'Wagt', key: 'createdAt', width: 20 },
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
          source: event.source === WorkerLifecycleSource.ExcelImport ? 'Excel' : 'Manual',
          changedBy: event.changedBy ?? '',
          note: event.note ?? '',
          createdAt: this.formatDateTime(event.createdAt),
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

  private buildEmailHtml(total: number, counts: LifecycleCounts): string {
    return `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111827">
        <h2 style="margin:0 0 10px">Esta WorkForce — Işçi hereketleri</h2>
        <p style="margin:0 0 14px;color:#4b5563">Soňky batch boýunça ${total} sany lifecycle event hasaba alyndy.</p>
        <table style="border-collapse:collapse;font-size:13px">
          <tr><td style="padding:6px 12px;border:1px solid #e5e7eb">Täze işe alnanlar</td><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700">${counts[WorkerLifecycleAction.Created]}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #e5e7eb">İşden çykarylanlar</td><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700">${counts[WorkerLifecycleAction.Terminated]}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #e5e7eb">Gaýtadan aktiw edilenler</td><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:700">${counts[WorkerLifecycleAction.Restored]}</td></tr>
        </table>
        <p style="margin:14px 0 0;color:#6b7280;font-size:12px">Jikme-jiklik Excel faýlynda goşuldy.</p>
      </div>
    `;
  }

  private formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
