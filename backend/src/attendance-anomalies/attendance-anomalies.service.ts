import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { AttendanceEvent, EventType } from '../attendance-events/attendance-event.entity';
import { Worker, WorkerStatus } from '../workers/worker.entity';
import { Tenant } from '../tenants/tenant.entity';
import { ShiftSettingsService } from '../shift-settings/shift-settings.service';
import { ReportConfigService } from '../report-config/report-config.service';
import { todayLocal, currentLocalMinutes, yesterdayLocal } from '../common/date-utils';

export interface MissingCheckInWorker {
  workerId: string;
  name: string;
  team: string;
  checkOutTime: number; // ms timestamp
}

export interface MissingCheckOutWorker {
  workerId: string;
  name: string;
  team: string;
  checkInTime: number; // ms timestamp
}

export interface ShiftAlertData {
  startTime: string;
  graceEndTime: string;
  graceExpired: boolean;
  workers: { workerId: string; name: string; team: string }[];
}

@Injectable()
export class AttendanceAnomaliesService {
  private readonly logger = new Logger(AttendanceAnomaliesService.name);

  private readonly transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USER ?? '', pass: process.env.MAIL_PASS ?? '' },
  });

  constructor(
    @InjectRepository(AttendanceEvent) private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(Worker) private readonly workerRepo: Repository<Worker>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly shiftSettingsService: ShiftSettingsService,
    private readonly reportConfigService: ReportConfigService,
  ) {}

  // ─── Core query: workers with CHECK_OUT but no CHECK_IN on given date ─────────

  async getMissingCheckInWorkers(date: string, tenantId?: string): Promise<MissingCheckInWorker[]> {
    const startMs = new Date(`${date}T00:00:00`).getTime();
    const endMs   = new Date(`${date}T23:59:59.999`).getTime();

    // 1. All CHECK_OUTs for the date
    const coQb = this.eventRepo.createQueryBuilder('e')
      .where('e."eventTime" BETWEEN :start AND :end', { start: startMs, end: endMs })
      .andWhere('e."eventType" = :t', { t: EventType.CHECK_OUT });
    if (tenantId) coQb.andWhere('e."tenantId" = :tid', { tid: tenantId });
    else coQb.andWhere('e."tenantId" IS NULL');

    const checkOuts = await coQb.getMany();
    if (!checkOuts.length) return [];

    const empNos = [...new Set(checkOuts.map(e => e.employeeNumber).filter(Boolean))];

    // 2. CHECK_INs for those employees on same date
    const ciQb = this.eventRepo.createQueryBuilder('e')
      .where('e."eventTime" BETWEEN :start AND :end', { start: startMs, end: endMs })
      .andWhere('e."eventType" = :t', { t: EventType.CHECK_IN })
      .andWhere('e."employeeNumber" IN (:...empNos)', { empNos });
    if (tenantId) ciQb.andWhere('e."tenantId" = :tid', { tid: tenantId });
    else ciQb.andWhere('e."tenantId" IS NULL');

    const checkIns = await ciQb.getMany();
    const ciSet = new Set(checkIns.map(e => e.employeeNumber));

    // 3. Employees with CHECK_OUT but no CHECK_IN
    const missingNos = empNos.filter(e => !ciSet.has(e));
    if (!missingNos.length) return [];

    // 4. Worker details
    const wFilter: any = tenantId
      ? { workerId: In(missingNos), tenantId }
      : { workerId: In(missingNos) };
    const workers = await this.workerRepo.find({ where: wFilter });
    const wMap = new Map(workers.map(w => [w.workerId, w]));

    // Latest CHECK_OUT per employee
    const latestOut = new Map<string, number>();
    for (const e of checkOuts) {
      if (!missingNos.includes(e.employeeNumber)) continue;
      const ts = Number(e.eventTime);
      if (!latestOut.has(e.employeeNumber) || ts > latestOut.get(e.employeeNumber)!) {
        latestOut.set(e.employeeNumber, ts);
      }
    }

    return missingNos.map(empNo => {
      const w = wMap.get(empNo);
      return {
        workerId: empNo,
        name: w?.name ?? empNo,
        team: w?.brigadeName ?? '',
        checkOutTime: latestOut.get(empNo) ?? 0,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── Shift alerts: workers who haven't checked in after grace period ──────────

  async getShiftAlerts(tenantId?: string): Promise<{ day: ShiftAlertData; night: ShiftAlertData }> {
    const today = todayLocal();
    const nowMinutes = currentLocalMinutes();
    const shifts = await this.shiftSettingsService.getAll(tenantId);

    const build = async (shiftType: 'day' | 'night'): Promise<ShiftAlertData> => {
      const setting = shifts.find(s => s.shiftType === shiftType)!;
      const [h, m] = setting.startTime.split(':').map(Number);
      const graceEndMins = h * 60 + m + setting.graceMinutes;
      const graceH = Math.floor(graceEndMins / 60) % 24;
      const graceM = graceEndMins % 60;
      const graceEndTime = `${String(graceH).padStart(2, '0')}:${String(graceM).padStart(2, '0')}`;
      const graceExpired = nowMinutes >= graceEndMins % 1440;

      let workers: ShiftAlertData['workers'] = [];

      if (graceExpired) {
        const wFilter: any = { shift: shiftType, status: WorkerStatus.Active };
        if (tenantId) wFilter.tenantId = tenantId;
        const shiftWorkers = await this.workerRepo.find({ where: wFilter });

        if (shiftWorkers.length > 0) {
          const workerIds = shiftWorkers.map(w => w.workerId).filter(Boolean);
          const startMs = new Date(`${today}T00:00:00`).getTime();
          const endMs   = new Date(`${today}T23:59:59.999`).getTime();

          const ciQb = this.eventRepo.createQueryBuilder('e')
            .where('e."eventTime" BETWEEN :start AND :end', { start: startMs, end: endMs })
            .andWhere('e."eventType" = :t', { t: EventType.CHECK_IN })
            .andWhere('e."employeeNumber" IN (:...wids)', { wids: workerIds });
          if (tenantId) ciQb.andWhere('e."tenantId" = :tid', { tid: tenantId });
          else ciQb.andWhere('e."tenantId" IS NULL');

          const checkIns = await ciQb.getMany();
          const ciSet = new Set(checkIns.map(e => e.employeeNumber));

          workers = shiftWorkers
            .filter(w => !ciSet.has(w.workerId))
            .map(w => ({ workerId: w.workerId, name: w.name, team: w.brigadeName ?? '' }));
        }
      }

      return { startTime: setting.startTime, graceEndTime, graceExpired, workers };
    };

    const [day, night] = await Promise.all([build('day'), build('night')]);
    return { day, night };
  }

  // ─── Core query: workers with CHECK_IN but no CHECK_OUT (shift ended) ────────

  async getMissingCheckOutWorkers(tenantId?: string): Promise<MissingCheckOutWorker[]> {
    const today = todayLocal();
    const nowMinutes = currentLocalMinutes();
    const startMs = new Date(`${today}T00:00:00`).getTime();
    const endMs   = new Date(`${today}T23:59:59.999`).getTime();

    const shifts = await this.shiftSettingsService.getAll(tenantId);

    // Determine which shifts have ended
    const endedShiftTypes = new Set<string>();
    for (const shift of shifts) {
      const [h, m] = shift.endTime.split(':').map(Number);
      if (nowMinutes >= h * 60 + m) endedShiftTypes.add(shift.shiftType);
    }
    if (endedShiftTypes.size === 0) return [];

    // Default day end minutes (for workers without assigned shift)
    const daySetting = shifts.find(s => s.shiftType === 'day');
    let dayEndMins = 17 * 60; // 17:00 default
    if (daySetting) {
      const [h, m] = daySetting.endTime.split(':').map(Number);
      dayEndMins = h * 60 + m;
    }

    // 1. All CHECK_INs for today
    const ciQb = this.eventRepo.createQueryBuilder('e')
      .where('e."eventTime" BETWEEN :start AND :end', { start: startMs, end: endMs })
      .andWhere('e."eventType" = :t', { t: EventType.CHECK_IN });
    if (tenantId) ciQb.andWhere('e."tenantId" = :tid', { tid: tenantId });
    else ciQb.andWhere('e."tenantId" IS NULL');
    const checkIns = await ciQb.getMany();
    if (!checkIns.length) return [];

    const empNos = [...new Set(checkIns.map(e => e.employeeNumber).filter(Boolean))];

    // 2. CHECK_OUTs for same employees
    const coQb = this.eventRepo.createQueryBuilder('e')
      .where('e."eventTime" BETWEEN :start AND :end', { start: startMs, end: endMs })
      .andWhere('e."eventType" = :t', { t: EventType.CHECK_OUT })
      .andWhere('e."employeeNumber" IN (:...empNos)', { empNos });
    if (tenantId) coQb.andWhere('e."tenantId" = :tid', { tid: tenantId });
    else coQb.andWhere('e."tenantId" IS NULL');
    const checkOuts = await coQb.getMany();
    const coSet = new Set(checkOuts.map(e => e.employeeNumber));

    const missingNos = empNos.filter(e => !coSet.has(e));
    if (!missingNos.length) return [];

    // 3. Worker details filtered by ended shifts
    const wFilter: any = { workerId: In(missingNos) };
    if (tenantId) wFilter.tenantId = tenantId;
    const workers = await this.workerRepo.find({ where: wFilter });

    const filteredWorkers = workers.filter(w => {
      if (w.shift === 'day') return endedShiftTypes.has('day');
      if (w.shift === 'night') return endedShiftTypes.has('night');
      return nowMinutes >= dayEndMins; // no shift assigned — use day end
    });
    if (!filteredWorkers.length) return [];

    // Latest CHECK_IN per employee
    const latestIn = new Map<string, number>();
    for (const e of checkIns) {
      const ts = Number(e.eventTime);
      if (!latestIn.has(e.employeeNumber) || ts > latestIn.get(e.employeeNumber)!) {
        latestIn.set(e.employeeNumber, ts);
      }
    }

    return filteredWorkers.map(w => ({
      workerId: w.workerId,
      name: w.name,
      team: w.brigadeName ?? '',
      checkInTime: latestIn.get(w.workerId) ?? 0,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── Email: missing check-in ──────────────────────────────────────────────────

  private async sendMissingCheckInEmail(
    tenantName: string,
    date: string,
    workers: MissingCheckInWorker[],
    emails: string[],
  ): Promise<void> {
    const rows = workers.map(w => {
      const outTime = w.checkOutTime
        ? new Date(w.checkOutTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: process.env.TZ || 'Asia/Ashgabat' })
        : '—';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${w.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${w.workerId}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${w.team}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#f59e0b;font-weight:600">${outTime}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">⚠️ ${tenantName}</h1>
    <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px">Missing check-in alert · ${date}</p>
  </div>
  <div style="padding:24px 32px">
    <p style="color:#374151;margin:0 0 16px">The following workers have a <strong>check-out record but no check-in</strong> on <strong>${date}</strong>. Please enter their arrival times manually to ensure correct hour calculations.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#fef9ee">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase">Worker</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase">ID</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase">Team</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase">Check-out</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#64748b;font-size:12px;margin-top:20px">Total: <strong>${workers.length}</strong> worker(s) affected</p>
  </div>
  <div style="padding:12px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center">
    Sent automatically by ${tenantName} · WorkHour System
  </div>
</div>
</body></html>`;

    await this.transporter.sendMail({
      from: `"${tenantName}" <${process.env.MAIL_USER}>`,
      to: emails.join(', '),
      subject: `⚠️ ${tenantName} — Missing check-in: ${workers.length} worker(s) · ${date}`,
      html,
    });
  }

  // ─── Email: shift alert ───────────────────────────────────────────────────────

  private async sendShiftAlertEmail(
    tenantName: string,
    shiftType: 'day' | 'night',
    workers: { workerId: string; name: string; team: string }[],
    graceEndTime: string,
    emails: string[],
  ): Promise<void> {
    const today = todayLocal();
    const shiftLabel = shiftType === 'day' ? 'Day Shift ☀️' : 'Night Shift 🌙';
    const rows = workers.map(w => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${w.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${w.workerId}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${w.team}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">${tenantName} · ${shiftLabel}</h1>
    <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px">Grace period ended at ${graceEndTime} · ${today}</p>
  </div>
  <div style="padding:24px 32px">
    <p style="color:#374151;margin:0 0 16px"><strong>${workers.length}</strong> worker(s) assigned to ${shiftLabel} have <strong>not checked in</strong> after the grace period ended at <strong>${graceEndTime}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f5f3ff">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5b21b6;text-transform:uppercase">Worker</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5b21b6;text-transform:uppercase">ID</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#5b21b6;text-transform:uppercase">Team</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="padding:12px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center">
    Sent automatically by ${tenantName} · WorkHour System
  </div>
</div>
</body></html>`;

    await this.transporter.sendMail({
      from: `"${tenantName}" <${process.env.MAIL_USER}>`,
      to: emails.join(', '),
      subject: `🔔 ${tenantName} — ${shiftLabel}: ${workers.length} worker(s) not checked in · ${today}`,
      html,
    });
  }

  // ─── Email: missing check-out ────────────────────────────────────────────────

  private async sendMissingCheckOutEmail(
    tenantName: string,
    date: string,
    workers: MissingCheckOutWorker[],
    emails: string[],
  ): Promise<void> {
    const rows = workers.map(w => {
      const inTime = w.checkInTime
        ? new Date(w.checkInTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: process.env.TZ || 'Asia/Ashgabat' })
        : '—';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${w.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${w.workerId}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b">${w.team}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#ef4444;font-weight:600">${inTime}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:24px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">🚪 ${tenantName}</h1>
    <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px">Missing check-out alert · ${date}</p>
  </div>
  <div style="padding:24px 32px">
    <p style="color:#374151;margin:0 0 16px">The following workers have a <strong>check-in record but no check-out</strong> on <strong>${date}</strong> even though their shift has ended. Please enter their departure times manually.</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#fef2f2">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#991b1b;text-transform:uppercase">Worker</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#991b1b;text-transform:uppercase">ID</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#991b1b;text-transform:uppercase">Team</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#991b1b;text-transform:uppercase">Check-in</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#64748b;font-size:12px;margin-top:20px">Total: <strong>${workers.length}</strong> worker(s) affected</p>
  </div>
  <div style="padding:12px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center">
    Sent automatically by ${tenantName} · WorkHour System
  </div>
</div>
</body></html>`;

    await this.transporter.sendMail({
      from: `"${tenantName}" <${process.env.MAIL_USER}>`,
      to: emails.join(', '),
      subject: `🚪 ${tenantName} — Missing check-out: ${workers.length} worker(s) · ${date}`,
      html,
    });
  }

  // ─── Helper: get tenant name ──────────────────────────────────────────────────

  private async getTenantName(tenantId?: string): Promise<string> {
    if (!tenantId) return 'WorkForce';
    const t = await this.tenantRepo.findOneBy({ id: tenantId });
    return t?.name ?? 'WorkForce';
  }

  // ─── Cron: daily 9:00 AM — missing check-in email ────────────────────────────

  @Cron('0 9 * * *')
  async sendMorningAnomalyEmails(): Promise<void> {
    const allConfigs = await this.reportConfigService.getAllConfigs();
    for (const cfg of allConfigs) {
      const anomaly = this.reportConfigService.parseAnomalySchedule(cfg);
      if (!anomaly.missingCheckInEnabled) continue;

      const emails: string[] = JSON.parse(cfg.emailsJson ?? '[]');
      if (!emails.length) continue;

      const tenantId = cfg.tenantId ?? undefined;
      try {
        const yesterday = yesterdayLocal();
        const workers = await this.getMissingCheckInWorkers(yesterday, tenantId);
        if (!workers.length) continue;

        const tenantName = await this.getTenantName(tenantId);
        await this.sendMissingCheckInEmail(tenantName, yesterday, workers, emails);
        this.logger.log(`Morning anomaly email sent for tenant ${tenantId ?? 'global'} — ${workers.length} workers`);
      } catch (err) {
        this.logger.error(`Morning anomaly email failed for tenant ${tenantId}: ${err}`);
      }
    }
  }

  // ─── Cron: every minute — shift grace period alerts ──────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async checkShiftGraceAlerts(): Promise<void> {
    const allConfigs = await this.reportConfigService.getAllConfigs();
    const today = todayLocal();
    const nowMinutes = currentLocalMinutes();

    for (const cfg of allConfigs) {
      const anomaly = this.reportConfigService.parseAnomalySchedule(cfg);
      if (!anomaly.shiftAlertEnabled) continue;

      const emails: string[] = JSON.parse(cfg.emailsJson ?? '[]');
      if (!emails.length) continue;

      const tenantId = cfg.tenantId ?? undefined;
      const shifts = await this.shiftSettingsService.getAll(tenantId);

      for (const shift of shifts) {
        const lastKey = shift.shiftType === 'day'
          ? 'dayShiftLastAlertDate'
          : 'nightShiftLastAlertDate';
        if (anomaly[lastKey] === today) continue; // already sent today

        const [h, m] = shift.startTime.split(':').map(Number);
        const graceEndMins = (h * 60 + m + shift.graceMinutes) % 1440;

        // Fire in the 1-minute window right after grace ends
        if (nowMinutes < graceEndMins || nowMinutes > graceEndMins + 1) continue;

        const graceH = Math.floor(graceEndMins / 60);
        const graceM = graceEndMins % 60;
        const graceEndTime = `${String(graceH).padStart(2, '0')}:${String(graceM).padStart(2, '0')}`;

        try {
          // Get missing workers for this shift
          const wFilter: any = { shift: shift.shiftType, status: WorkerStatus.Active };
          if (tenantId) wFilter.tenantId = tenantId;
          const shiftWorkers = await this.workerRepo.find({ where: wFilter });
          if (!shiftWorkers.length) continue;

          const workerIds = shiftWorkers.map(w => w.workerId).filter(Boolean);
          const startMs = new Date(`${today}T00:00:00`).getTime();
          const endMs   = new Date(`${today}T23:59:59.999`).getTime();

          const ciQb = this.eventRepo.createQueryBuilder('e')
            .where('e."eventTime" BETWEEN :start AND :end', { start: startMs, end: endMs })
            .andWhere('e."eventType" = :t', { t: EventType.CHECK_IN })
            .andWhere('e."employeeNumber" IN (:...wids)', { wids: workerIds });
          if (tenantId) ciQb.andWhere('e."tenantId" = :tid', { tid: tenantId });
          else ciQb.andWhere('e."tenantId" IS NULL');

          const checkIns = await ciQb.getMany();
          const ciSet = new Set(checkIns.map(e => e.employeeNumber));
          const missing = shiftWorkers
            .filter(w => !ciSet.has(w.workerId))
            .map(w => ({ workerId: w.workerId, name: w.name, team: w.brigadeName ?? '' }));

          if (!missing.length) continue;

          const tenantName = await this.getTenantName(tenantId);
          await this.sendShiftAlertEmail(tenantName, shift.shiftType, missing, graceEndTime, emails);

          // Mark as sent
          await this.reportConfigService.updateAnomalySchedule(
            { [lastKey]: today },
            tenantId,
          );

          this.logger.log(`Shift alert sent: ${shift.shiftType} · tenant ${tenantId ?? 'global'} · ${missing.length} workers`);
        } catch (err) {
          this.logger.error(`Shift alert failed: ${shift.shiftType} · tenant ${tenantId}: ${err}`);
        }
      }
    }
  }

  // ─── Cron: every minute — check-out missing alerts ───────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async checkShiftCheckoutAlerts(): Promise<void> {
    const allConfigs = await this.reportConfigService.getAllConfigs();
    const today = todayLocal();
    const nowMinutes = currentLocalMinutes();

    for (const cfg of allConfigs) {
      const anomaly = this.reportConfigService.parseAnomalySchedule(cfg);
      if (!anomaly.checkOutAlertEnabled) continue;

      const emails: string[] = JSON.parse(cfg.emailsJson ?? '[]');
      if (!emails.length) continue;

      const tenantId = cfg.tenantId ?? undefined;
      const shifts = await this.shiftSettingsService.getAll(tenantId);

      for (const shift of shifts) {
        const lastKey = shift.shiftType === 'day'
          ? 'checkOutDayLastAlertDate'
          : 'checkOutNightLastAlertDate';
        if (anomaly[lastKey] === today) continue; // already sent today

        const [h, m] = shift.endTime.split(':').map(Number);
        const endMins = h * 60 + m;

        // Fire in the 1-minute window right after shift ends
        if (nowMinutes < endMins || nowMinutes > endMins + 1) continue;

        try {
          const wFilter: any = { shift: shift.shiftType, status: WorkerStatus.Active };
          if (tenantId) wFilter.tenantId = tenantId;
          const shiftWorkers = await this.workerRepo.find({ where: wFilter });
          if (!shiftWorkers.length) continue;

          const workerIds = shiftWorkers.map(w => w.workerId).filter(Boolean);
          const startMs = new Date(`${today}T00:00:00`).getTime();
          const endMs   = new Date(`${today}T23:59:59.999`).getTime();

          // Workers with CHECK_IN
          const ciQb = this.eventRepo.createQueryBuilder('e')
            .where('e."eventTime" BETWEEN :start AND :end', { start: startMs, end: endMs })
            .andWhere('e."eventType" = :t', { t: EventType.CHECK_IN })
            .andWhere('e."employeeNumber" IN (:...wids)', { wids: workerIds });
          if (tenantId) ciQb.andWhere('e."tenantId" = :tid', { tid: tenantId });
          else ciQb.andWhere('e."tenantId" IS NULL');
          const checkIns = await ciQb.getMany();
          const ciSet = new Set(checkIns.map(e => e.employeeNumber));

          // Workers with CHECK_OUT
          const coQb = this.eventRepo.createQueryBuilder('e')
            .where('e."eventTime" BETWEEN :start AND :end', { start: startMs, end: endMs })
            .andWhere('e."eventType" = :t', { t: EventType.CHECK_OUT })
            .andWhere('e."employeeNumber" IN (:...wids)', { wids: workerIds });
          if (tenantId) coQb.andWhere('e."tenantId" = :tid', { tid: tenantId });
          else coQb.andWhere('e."tenantId" IS NULL');
          const checkOuts = await coQb.getMany();
          const coSet = new Set(checkOuts.map(e => e.employeeNumber));

          // Workers who checked in but didn't check out
          const missing: MissingCheckOutWorker[] = [];
          const latestIn = new Map<string, number>();
          for (const e of checkIns) {
            const ts = Number(e.eventTime);
            if (!latestIn.has(e.employeeNumber) || ts > latestIn.get(e.employeeNumber)!) {
              latestIn.set(e.employeeNumber, ts);
            }
          }
          for (const w of shiftWorkers) {
            if (ciSet.has(w.workerId) && !coSet.has(w.workerId)) {
              missing.push({ workerId: w.workerId, name: w.name, team: w.brigadeName ?? '', checkInTime: latestIn.get(w.workerId) ?? 0 });
            }
          }

          if (!missing.length) continue;

          const tenantName = await this.getTenantName(tenantId);
          await this.sendMissingCheckOutEmail(tenantName, today, missing, emails);

          await this.reportConfigService.updateAnomalySchedule(
            { [lastKey]: today },
            tenantId,
          );

          this.logger.log(`Checkout alert sent: ${shift.shiftType} · tenant ${tenantId ?? 'global'} · ${missing.length} workers`);
        } catch (err) {
          this.logger.error(`Checkout alert failed: ${shift.shiftType} · tenant ${tenantId}: ${err}`);
        }
      }
    }
  }
}
