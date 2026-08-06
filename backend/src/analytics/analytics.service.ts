import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { AttendanceEvent, EventType } from '../attendance-events/attendance-event.entity';
import { Worker, WorkerStatus } from '../workers/worker.entity';
import { Tenant } from '../tenants/tenant.entity';
import { ReportConfigService } from '../report-config/report-config.service';
import { APP_TZ, todayLocal, yesterdayLocal } from '../common/date-utils';

export interface AttendanceChartPoint {
  date: string;
  present: number;
  absent: number;
  total: number;
}

export interface TopWorkerItem {
  workerId: string;
  name: string;
  totalHours: number;
  daysPresent: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  private readonly transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USER ?? '', pass: process.env.MAIL_PASS ?? '' },
  });

  constructor(
    @InjectRepository(AttendanceEvent) private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(Worker) private readonly workerRepo: Repository<Worker>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly reportConfigService: ReportConfigService,
  ) {}

  // ─── Attendance chart: per-day present/absent counts ─────────────────────────

  async getAttendanceChart(startDate: string, endDate: string, tenantId?: string): Promise<AttendanceChartPoint[]> {
    const startMs = new Date(`${startDate}T00:00:00`).getTime();
    const endMs   = new Date(`${endDate}T23:59:59.999`).getTime();

    const qb = this.eventRepo.createQueryBuilder('e')
      .where('e."eventTime" >= :startMs AND e."eventTime" <= :endMs', { startMs, endMs })
      .andWhere('e."eventType" = :type', { type: EventType.CHECK_IN });

    if (tenantId) {
      qb.andWhere('e."tenantId" = :tenantId', { tenantId });
    } else {
      qb.andWhere('e."tenantId" IS NULL');
    }

    const events = await qb.getMany();

    const workerFilter: any = tenantId
      ? { tenantId, status: WorkerStatus.Active }
      : { status: WorkerStatus.Active };
    const totalWorkers = await this.workerRepo.count({ where: workerFilter });

    // Group by local date
    const dayMap = new Map<string, Set<string>>();
    for (const ev of events) {
      const day = new Date(Number(ev.eventTime)).toLocaleDateString('en-CA', { timeZone: APP_TZ });
      if (!dayMap.has(day)) dayMap.set(day, new Set());
      dayMap.get(day)!.add(ev.employeeNumber);
    }

    // Enumerate every day in range
    const result: AttendanceChartPoint[] = [];
    const cursor = new Date(`${startDate}T12:00:00`);
    const last   = new Date(`${endDate}T12:00:00`);
    while (cursor <= last) {
      const day = cursor.toLocaleDateString('en-CA', { timeZone: APP_TZ });
      const present = dayMap.get(day)?.size ?? 0;
      result.push({ date: day, present, absent: Math.max(0, totalWorkers - present), total: totalWorkers });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  // ─── Top workers by total hours ───────────────────────────────────────────────

  async getTopWorkers(startDate: string, endDate: string, limit: number, tenantId?: string): Promise<TopWorkerItem[]> {
    const startMs = new Date(`${startDate}T00:00:00`).getTime();
    const endMs   = new Date(`${endDate}T23:59:59.999`).getTime();

    const qb = this.eventRepo.createQueryBuilder('e')
      .where('e."eventTime" >= :startMs AND e."eventTime" <= :endMs', { startMs, endMs })
      .orderBy('e."employeeNumber"', 'ASC')
      .addOrderBy('e."eventTime"', 'ASC');

    if (tenantId) {
      qb.andWhere('e."tenantId" = :tenantId', { tenantId });
    } else {
      qb.andWhere('e."tenantId" IS NULL');
    }

    const events = await qb.getMany();

    // Group by employee
    const grouped = new Map<string, AttendanceEvent[]>();
    for (const ev of events) {
      if (!ev.employeeNumber) continue;
      if (!grouped.has(ev.employeeNumber)) grouped.set(ev.employeeNumber, []);
      grouped.get(ev.employeeNumber)!.push(ev);
    }

    // Pair CHECK_IN → CHECK_OUT, sum hours
    const workerStats = new Map<string, { totalMs: number; daysPresent: Set<string> }>();
    for (const [empNo, evts] of grouped) {
      let totalMs = 0;
      const daysPresent = new Set<string>();
      for (let i = 0; i < evts.length; i++) {
        if (evts[i].eventType === EventType.CHECK_IN) {
          const checkInMs = Number(evts[i].eventTime);
          daysPresent.add(new Date(checkInMs).toLocaleDateString('en-CA', { timeZone: APP_TZ }));
          for (let j = i + 1; j < evts.length; j++) {
            if (evts[j].eventType === EventType.CHECK_OUT) {
              totalMs += Number(evts[j].eventTime) - checkInMs;
              i = j;
              break;
            }
          }
        }
      }
      workerStats.set(empNo, { totalMs, daysPresent });
    }

    if (workerStats.size === 0) return [];

    const empNos = [...workerStats.keys()];
    const workerFilter: any = tenantId ? { workerId: In(empNos), tenantId } : { workerId: In(empNos) };
    const workers = await this.workerRepo.find({ where: workerFilter });
    const nameMap = new Map(workers.map(w => [w.workerId, w.name]));

    return [...workerStats.entries()]
      .map(([empNo, data]) => ({
        workerId: empNo,
        name: nameMap.get(empNo) ?? empNo,
        totalHours: Math.round(data.totalMs / 360000) / 10, // 1 decimal
        daysPresent: data.daysPresent.size,
      }))
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, limit);
  }

  // ─── Dashboard schedule ───────────────────────────────────────────────────────

  getDashboardSchedule(tenantId?: string) {
    return this.reportConfigService.getDashboardSchedule(tenantId);
  }

  updateDashboardSchedule(schedule: any, tenantId?: string) {
    return this.reportConfigService.updateDashboardSchedule(schedule, tenantId);
  }

  // ─── Email sending ────────────────────────────────────────────────────────────

  async sendDashboardEmailNow(
    startDate: string,
    endDate: string,
    tenantId?: string,
    tenantName = 'WorkForce',
    customEmails?: string[],
  ): Promise<void> {
    const [chart, topWorkers, schedule] = await Promise.all([
      this.getAttendanceChart(startDate, endDate, tenantId),
      this.getTopWorkers(startDate, endDate, 10, tenantId),
      this.getDashboardSchedule(tenantId),
    ]);

    const emails = customEmails?.length ? customEmails : schedule.emails;
    if (!emails.length) throw new Error('No recipient emails configured');

    const html = this.buildEmailHtml(tenantName, startDate, endDate, chart, topWorkers);

    await this.transporter.sendMail({
      from: `"${tenantName}" <${process.env.MAIL_USER}>`,
      to: emails.join(', '),
      subject: `${tenantName} — Dashboard Report (${startDate} – ${endDate})`,
      html,
    });
  }

  private buildEmailHtml(
    tenantName: string,
    startDate: string,
    endDate: string,
    chart: AttendanceChartPoint[],
    topWorkers: TopWorkerItem[],
  ): string {
    const avgPresent = chart.length ? Math.round(chart.reduce((s, d) => s + d.present, 0) / chart.length) : 0;
    const total      = chart[0]?.total ?? 0;

    const chartRows = chart.map(d => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${d.date}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#22c55e;font-weight:600">${d.present}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#ef4444">${d.absent}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#64748b">${d.total}</td>
      </tr>`).join('');

    const topRows = topWorkers.map((w, i) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#64748b">${i + 1}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600">${w.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#6366f1;font-weight:600">${w.totalHours}h</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#64748b">${w.daysPresent} days</td>
      </tr>`).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;background:#f8fafc;margin:0;padding:24px">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:22px">${tenantName}</h1>
    <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">Dashboard Report · ${startDate} – ${endDate}</p>
  </div>
  <div style="padding:24px 32px">
    <div style="display:flex;gap:16px;margin-bottom:24px">
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#22c55e">${avgPresent}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Avg present / day</div>
      </div>
      <div style="flex:1;background:#fef2f2;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#ef4444">${total - avgPresent}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Avg absent / day</div>
      </div>
      <div style="flex:1;background:#f5f3ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#6366f1">${total}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Total workers</div>
      </div>
    </div>
    <h2 style="font-size:15px;font-weight:700;color:#1e293b;margin:0 0 12px">Daily Attendance</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Date</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Present</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Absent</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Total</th>
      </tr></thead>
      <tbody>${chartRows}</tbody>
    </table>
    <h2 style="font-size:15px;font-weight:700;color:#1e293b;margin:0 0 12px">Top Workers by Hours</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b">#</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Worker</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Hours</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Days</th>
      </tr></thead>
      <tbody>${topRows}</tbody>
    </table>
  </div>
  <div style="padding:16px 32px;background:#f8fafc;font-size:12px;color:#94a3b8;text-align:center">
    Sent automatically by ${tenantName} · WorkHour System
  </div>
</div>
</body></html>`;
  }

  // ─── Cron: auto-send dashboard emails ────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async checkAndSendDashboard(): Promise<void> {
    const currentTime = (() => {
      const n = new Date();
      return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
    })();
    const today = todayLocal();

    const allConfigs = await this.reportConfigService.getAllConfigs();
    for (const cfg of allConfigs) {
      let schedule: any;
      try { schedule = JSON.parse(cfg.dashboardScheduleJson); } catch { continue; }
      if (!schedule?.enabled) continue;
      if (schedule.time !== currentTime) continue;
      if (schedule.lastSentDate === today) continue;

      const tenantId = cfg.tenantId ?? undefined;

      // Get tenant name
      let tenantName = 'WorkForce';
      if (tenantId) {
        const t = await this.tenantRepo.findOneBy({ id: tenantId });
        if (t) tenantName = t.name;
      }

      try {
        const startDate = yesterdayLocal();
        const endDate   = yesterdayLocal();
        await this.sendDashboardEmailNow(startDate, endDate, tenantId, tenantName, schedule.emails);
        await this.reportConfigService.updateDashboardLastSent(today, tenantId);
        this.logger.log(`Dashboard email sent for tenant ${tenantId ?? 'global'} → ${schedule.emails.join(', ')}`);
      } catch (err) {
        this.logger.error(`Dashboard email failed for tenant ${tenantId}: ${err}`);
      }
    }
  }
}
