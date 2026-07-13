import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake');
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { APP_TZ } from '../common/date-utils';
import { ReportType } from '../report-config/report-config.entity';

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return m > 0 ? `${h} sag ${m} min` : `${h} sag`;
}

function fmtTime(ms: number | null): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDateTm(turkmenMonth: boolean, dateStr: string): string {
  if (!dateStr) return dateStr;
  const [, m, d] = dateStr.split('-');
  if (!turkmenMonth) return dateStr;
  const months = [
    'Ýanwar', 'Fewral', 'Mart', 'Aprel', 'Maý', 'Iýun',
    'Iýul', 'Awgust', 'Sentýabr', 'Oktýabr', 'Noýabr', 'Dekabr',
  ];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

// ─── Daily report types ─────────────────────────────────────────────────────────

const REPORT_LABELS: Record<ReportType, string> = {
  daily_all: 'Ähli işçiler',
  daily_staff: 'Staff Personal',
  daily_shift_day: 'Gündiz Shift',
  daily_shift_night: 'Gije Shift',
  daily_attended: 'Diňe gelenler',
  daily_absent: 'Diňe gelmedikler',
};

type Row = {
  name: string;
  workerId: string;
  profession: string;
  brigade: string;
  shift: string;
  isStaff: boolean;
  checkIn: number | null;
  checkOut: number | null;
  totalMs: number;
};

// ─── Range report types ─────────────────────────────────────────────────────────

export type RangeRow = {
  workerId: string;
  name: string;
  profession: string;
  brigade: string;
  totalMs: number;
  daysPresent: number;
};

// ─── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  //  DAILY REPORT  (existing logic, unchanged)
  // ════════════════════════════════════════════════════════════════════════════

  private async buildRows(date: string, reportType: ReportType = 'daily_all'): Promise<Row[]> {
    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $1
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [date],
      );

    const empNums = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];
    const attendedWorkers = empNums.length > 0
      ? await this.workerRepo.find({ where: { workerId: In(empNums) } })
      : [];
    const workerMap = new Map(attendedWorkers.map(w => [w.workerId, w]));

    const rows: Row[] = [];
    const presentEntityIds = new Set<string>();
    const byWorker = new Map<string, { eventType: string; eventTime: number }[]>();

    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorker.set(ev.employeeNumber, arr);
    }

    for (const [empNum, evList] of byWorker) {
      const w = workerMap.get(empNum);
      if (w) presentEntityIds.add(w.id);

      let firstIn: number | null = null;
      let lastOut: number | null = null;
      let totalMs = 0;
      let clockIn: number | null = null;

      for (const ev of evList) {
        if (ev.eventType === 'CHECK_IN') {
          if (firstIn === null) firstIn = ev.eventTime;
          if (clockIn === null) clockIn = ev.eventTime;
        } else {
          if (clockIn !== null) { totalMs += ev.eventTime - clockIn; clockIn = null; }
          lastOut = ev.eventTime;
        }
      }
      rows.push({
        name: w?.name ?? empNum,
        workerId: empNum,
        profession: w?.profession ?? '—',
        brigade: w?.brigadeName ?? '—',
        shift: w?.shift ?? '—',
        isStaff: w?.isStaff ?? false,
        checkIn: firstIn,
        checkOut: lastOut,
        totalMs,
      });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const allActive = await this.workerRepo.find({ where: { status: 'Active' as any } });
    for (const w of allActive) {
      if (!presentEntityIds.has(w.id)) {
        rows.push({
          name: w.name,
          workerId: w.workerId,
          profession: w.profession,
          brigade: w.brigadeName ?? '—',
          shift: w.shift ?? '—',
          isStaff: w.isStaff ?? false,
          checkIn: null,
          checkOut: null,
          totalMs: 0,
        });
      }
    }

    if (reportType === 'daily_staff')       return rows.filter(r => r.isStaff);
    if (reportType === 'daily_shift_day')   return rows.filter(r => r.shift === 'day');
    if (reportType === 'daily_shift_night') return rows.filter(r => r.shift === 'night');
    if (reportType === 'daily_attended')    return rows.filter(r => r.checkIn !== null);
    if (reportType === 'daily_absent')      return rows.filter(r => r.checkIn === null);
    return rows;
  }

  async generateReport(
    date: string,
    reportType: ReportType = 'daily_all',
    isManual = false,
  ): Promise<{ xlsx: Buffer; html: string }> {
    const rows = await this.buildRows(date, reportType);
    const xlsx = await this.buildXlsx(date, reportType, rows);
    const html = this.buildEmailHtml(date, reportType, rows, isManual);
    return { xlsx, html };
  }

  private async buildXlsx(date: string, reportType: ReportType, rows: Row[]): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const attended = rows.filter(r => r.checkIn !== null);
    const absent   = rows.filter(r => r.checkIn === null);
    const pct = rows.length > 0 ? Math.round((attended.length / rows.length) * 100) : 0;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Hasabat');
    const COLS = 9;

    ws.columns = [
      { width: 5  },
      { width: 30 },
      { width: 12 },
      { width: 20 },
      { width: 18 },
      { width: 9  },
      { width: 10 },
      { width: 10 },
      { width: 14 },
    ];

    const titleRow = ws.addRow(['Esta WorkForce — Günlük Hasabat']);
    ws.mergeCells(titleRow.number, 1, titleRow.number, COLS);
    const titleCell = titleRow.getCell(1);
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    const statsRow = ws.addRow([
      `Sene: ${date}   |   Hasabat: ${REPORT_LABELS[reportType]}   |   Jemi: ${rows.length}   |   Geldi: ${attended.length}   |   Gelmedi: ${absent.length}   |   Göterimi: ${pct}%`,
    ]);
    ws.mergeCells(statsRow.number, 1, statsRow.number, COLS);
    const statsCell = statsRow.getCell(1);
    statsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    statsCell.font = { size: 10, color: { argb: 'FF475569' } };
    statsCell.alignment = { horizontal: 'center', vertical: 'middle' };
    statsRow.height = 20;

    ws.addRow([]);

    const addSectionHeader = (label: string, argb: string) => {
      const r = ws.addRow([label]);
      ws.mergeCells(r.number, 1, r.number, COLS);
      const c = r.getCell(1);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      r.height = 22;
    };

    const COL_HEADERS = ['#', 'İşçi adı', 'Sicil No', 'Görev', 'Ekip', 'Shift', 'Giriş', 'Çykyş', 'Jemi sag'];
    const addColHeaders = () => {
      const r = ws.addRow(COL_HEADERS);
      r.eachCell((cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
      });
      r.height = 18;
    };

    const addDataRows = (list: Row[], startIdx: number, isPresent: boolean) => {
      list.forEach((row, i) => {
        const r = ws.addRow([
          startIdx + i + 1,
          row.name,
          row.workerId,
          row.profession,
          row.brigade,
          row.shift === 'day' ? 'Gündiz' : row.shift === 'night' ? 'Gije' : '—',
          fmtTime(row.checkIn),
          fmtTime(row.checkOut),
          fmtMs(row.totalMs),
        ]);
        const bg = i % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
        r.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.font = { size: 9 };
          cell.alignment = { vertical: 'middle' };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        });
        if (isPresent && row.checkIn) {
          r.getCell(7).font = { size: 9, bold: true, color: { argb: 'FF16A34A' } };
        }
        r.height = 16;
      });
    };

    if (reportType !== 'daily_absent') {
      addSectionHeader(`GELENLER  (${attended.length} adam)`, 'FF16A34A');
      addColHeaders();
      addDataRows(attended, 0, true);
    }

    if (reportType !== 'daily_attended') {
      ws.addRow([]);
      addSectionHeader(`GELMEDIKLER  (${absent.length} adam)`, 'FFDC2626');
      addColHeaders();
      addDataRows(absent, attended.length, false);
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  private buildEmailHtml(date: string, reportType: ReportType, rows: Row[], isManual: boolean): string {
    const attended = rows.filter(r => r.checkIn !== null);
    const absent   = rows.filter(r => r.checkIn === null);
    const pct = rows.length > 0 ? Math.round((attended.length / rows.length) * 100) : 0;

    const tableRows = rows.slice(0, 30).map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${i + 1}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.name}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.workerId}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.profession}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:${r.checkIn ? '#16a34a' : '#dc2626'}">${r.checkIn ? fmtTime(r.checkIn) : '—'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:${r.checkIn ? '#16a34a' : '#dc2626'}">${r.checkIn ? 'Geldi' : 'Gelmedi'}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:680px;margin:24px auto">
  <div style="background:#1e3a5f;padding:22px 28px;border-radius:10px 10px 0 0">
    <div style="color:#ffffff;font-size:22px;font-weight:700">Esta WorkForce</div>
    <div style="color:#93c5fd;font-size:13px;margin-top:4px">Günlük Hasabat — ${REPORT_LABELS[reportType]}</div>
  </div>
  <div style="background:#ffffff;padding:24px 28px">
    <p style="color:#64748b;font-size:13px;margin-top:0">Sene: <strong style="color:#1e293b">${date}</strong></p>
    <div style="display:flex;gap:12px;margin-bottom:22px">
      <div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#1d4ed8">${rows.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Jemi işçi</div>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#16a34a">${attended.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Geldi</div>
      </div>
      <div style="flex:1;background:#fef2f2;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#dc2626">${absent.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Gelmedi</div>
      </div>
      <div style="flex:1;background:#fefce8;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#ca8a04">${pct}%</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Göterimi</div>
      </div>
    </div>
    <div style="font-weight:600;font-size:13px;color:#1e3a5f;margin-bottom:10px">
      Işçileriň sanawy${rows.length > 30 ? ` (ilkinji 30 görkezilýär, jemi ${rows.length})` : ''}:
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#334155;color:#ffffff">
          <th style="padding:8px;text-align:left;font-size:11px">#</th>
          <th style="padding:8px;text-align:left;font-size:11px">İşçi adı</th>
          <th style="padding:8px;text-align:left;font-size:11px">Sicil No</th>
          <th style="padding:8px;text-align:left;font-size:11px">Görev</th>
          <th style="padding:8px;text-align:left;font-size:11px">Giriş</th>
          <th style="padding:8px;text-align:left;font-size:11px">Status</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="font-size:11px;color:#94a3b8;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0">
      Bu habar ${isManual ? 'el bilen iberildi' : 'awtomatik iberildi'} — Esta WorkForce Ulgamy
    </p>
  </div>
</div>
</body>
</html>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RANGE REPORT  (new — date-range + worker filter)
  // ════════════════════════════════════════════════════════════════════════════

  async getRangeData(
    startDate: string,
    endDate: string,
    workerIds?: string[],
  ): Promise<{
    rows: RangeRow[];
    startDate: string;
    endDate: string;
    totalWorkers: number;
    totalMs: number;
    daysInRange: number;
  }> {
    const rows = await this.buildRangeRows(startDate, endDate, workerIds);
    const daysInRange = this.daysBetween(startDate, endDate);
    const totalMs = rows.reduce((s, r) => s + r.totalMs, 0);
    return { rows, startDate, endDate, totalWorkers: rows.length, totalMs, daysInRange };
  }

  async generateRangeReport(
    startDate: string,
    endDate: string,
    workerIds?: string[],
    isMonthly = false,
  ): Promise<{ xlsx: Buffer; html: string; subject: string }> {
    const rows = await this.buildRangeRows(startDate, endDate, workerIds);
    const xlsx = await this.buildRangeXlsx(startDate, endDate, rows, isMonthly);
    const html = this.buildRangeEmailHtml(startDate, endDate, rows, isMonthly);

    const label = isMonthly
      ? `Aýlyk Hasabat (${startDate} — ${endDate})`
      : `İş Sagatlaryny Hasabaty (${startDate} — ${endDate})`;
    const subject = `Esta WorkForce — ${label}`;

    return { xlsx, html, subject };
  }

  private daysBetween(start: string, end: string): number {
    const a = new Date(start).getTime();
    const b = new Date(end).getTime();
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }

  private async buildRangeRows(
    startDate: string,
    endDate: string,
    filterWorkerIds?: string[],
  ): Promise<RangeRow[]> {
    // Fetch all events in the date range
    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') BETWEEN $1 AND $2
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [startDate, endDate],
      );

    // Load worker info
    const empNums = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];
    const workers = empNums.length > 0
      ? await this.workerRepo.find({ where: { workerId: In(empNums) } })
      : [];
    const workerMap = new Map(workers.map(w => [w.workerId, w]));

    // Group events per worker
    type Ev = { eventType: string; eventTime: number; date: string };
    const byWorker = new Map<string, Ev[]>();
    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({
        eventType: ev.eventType,
        eventTime: Number(ev.eventTime),
        date: new Date(Number(ev.eventTime)).toISOString().split('T')[0],
      });
      byWorker.set(ev.employeeNumber, arr);
    }

    const rows: RangeRow[] = [];

    for (const [empNum, evList] of byWorker) {
      // Apply worker filter
      if (filterWorkerIds && filterWorkerIds.length > 0) {
        if (!filterWorkerIds.includes(empNum)) continue;
      }

      const w = workerMap.get(empNum);

      // Compute total hours + unique days present
      let totalMs = 0;
      let clockIn: number | null = null;
      const uniqueDates = new Set<string>();

      for (const ev of evList) {
        uniqueDates.add(ev.date);
        if (ev.eventType === 'CHECK_IN') {
          if (clockIn === null) clockIn = ev.eventTime;
        } else {
          if (clockIn !== null) {
            totalMs += ev.eventTime - clockIn;
            clockIn = null;
          }
        }
      }

      rows.push({
        workerId: empNum,
        name: w?.name ?? empNum,
        profession: w?.profession ?? '—',
        brigade: w?.brigadeName ?? '—',
        totalMs,
        daysPresent: uniqueDates.size,
      });
    }

    // If filterWorkerIds specified, add workers that had no attendance (0 hours)
    if (filterWorkerIds && filterWorkerIds.length > 0) {
      const present = new Set(rows.map(r => r.workerId));
      const missing = filterWorkerIds.filter(id => !present.has(id));
      if (missing.length > 0) {
        const missingWorkers = await this.workerRepo.find({ where: { workerId: In(missing) } });
        for (const w of missingWorkers) {
          rows.push({
            workerId: w.workerId,
            name: w.name,
            profession: w.profession,
            brigade: w.brigadeName ?? '—',
            totalMs: 0,
            daysPresent: 0,
          });
        }
      }
    }

    rows.sort((a, b) => b.totalMs - a.totalMs); // Sort by total hours descending
    return rows;
  }

  private async buildRangeXlsx(
    startDate: string,
    endDate: string,
    rows: RangeRow[],
    isMonthly: boolean,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const totalMs = rows.reduce((s, r) => s + r.totalMs, 0);
    const totalH = Math.floor(totalMs / 3600000);
    const worked = rows.filter(r => r.totalMs > 0);
    const avgMs = worked.length > 0 ? Math.floor(totalMs / worked.length) : 0;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Esta WorkForce';
    wb.created = new Date();
    const ws = wb.addWorksheet('İş Sagatlaryny');
    const COLS = 8;

    ws.columns = [
      { width: 5  }, // #
      { width: 32 }, // İşçi adı
      { width: 13 }, // Sicil No
      { width: 22 }, // Görev
      { width: 20 }, // Ekip
      { width: 13 }, // İşlän gün
      { width: 15 }, // Jemi sag
      { width: 17 }, // Ortaça günlik
    ];

    const titleText = isMonthly
      ? 'Esta WorkForce — Aýlyk İş Sagatlaryny Hasabaty'
      : 'Esta WorkForce — İş Sagatlaryny Hasabaty';

    // ── Title ───────────────────────────────────────────────────────────────
    const titleRow = ws.addRow([titleText]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, COLS);
    Object.assign(titleRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } },
      font: { bold: true, size: 15, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    titleRow.height = 34;

    // ── Subtitle ─────────────────────────────────────────────────────────────
    const subRow = ws.addRow([`Döwür: ${startDate} — ${endDate}`]);
    ws.mergeCells(subRow.number, 1, subRow.number, COLS);
    Object.assign(subRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5E8E' } },
      font: { size: 11, color: { argb: 'FFCFE2FF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    subRow.height = 22;

    // ── Stats ─────────────────────────────────────────────────────────────────
    const statsData = [
      ['Jemi işçi', rows.length],
      ['İşlän işçi', worked.length],
      ['Jemi sagat', fmtMs(totalMs)],
      ['Ortaça (işçi başyna)', fmtMs(avgMs)],
    ];
    for (let i = 0; i < statsData.length; i += 2) {
      const pair = statsData.slice(i, i + 2);
      const r = ws.addRow([
        pair[0]?.[0], pair[0]?.[1],
        '', '',
        pair[1]?.[0], pair[1]?.[1],
      ]);
      ws.mergeCells(r.number, 1, r.number, 2);
      ws.mergeCells(r.number, 5, r.number, 6);
      r.eachCell((c: any) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
        c.font = { size: 10 };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      r.height = 18;
    }

    ws.addRow([]); // spacer

    // ── Column headers ────────────────────────────────────────────────────────
    const hdr = ws.addRow(['#', 'İşçi adı', 'Sicil No', 'Görev', 'Ekip', 'İşlän gün', 'Jemi sag', 'Ortaça gün']);
    hdr.eachCell((c: any) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { bottom: { style: 'medium', color: { argb: 'FF93C5FD' } } };
    });
    hdr.height = 22;

    // ── Data rows ─────────────────────────────────────────────────────────────
    rows.forEach((row, i) => {
      const avgDayMs = row.daysPresent > 0 ? Math.floor(row.totalMs / row.daysPresent) : 0;
      const r = ws.addRow([
        i + 1,
        row.name,
        row.workerId,
        row.profession,
        row.brigade,
        row.daysPresent > 0 ? `${row.daysPresent} gün` : '—',
        fmtMs(row.totalMs),
        fmtMs(avgDayMs),
      ]);
      const bg = i % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
      r.eachCell((c: any) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c.font = { size: 9 };
        c.alignment = { vertical: 'middle' };
        c.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      });
      // Highlight total hours cell
      if (row.totalMs > 0) {
        r.getCell(7).font = { size: 9, bold: true, color: { argb: 'FF1E3A5F' } };
      }
      r.height = 17;
    });

    // ── Totals footer ─────────────────────────────────────────────────────────
    ws.addRow([]);
    const footRow = ws.addRow([
      '', 'JEMI', '', '', '',
      `${[...new Set(rows.map(r => r.daysPresent))].reduce((a, b) => Math.max(a, b), 0)} gün (maks)`,
      fmtMs(totalMs), '',
    ]);
    footRow.eachCell((c: any) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    footRow.height = 20;

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  private buildRangeEmailHtml(
    startDate: string,
    endDate: string,
    rows: RangeRow[],
    isMonthly: boolean,
  ): string {
    const totalMs = rows.reduce((s, r) => s + r.totalMs, 0);
    const worked = rows.filter(r => r.totalMs > 0);
    const avgMs = worked.length > 0 ? Math.floor(totalMs / worked.length) : 0;

    const tableRows = rows.slice(0, 50).map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${i + 1}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600">${r.name}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.workerId}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.profession}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px">${r.brigade}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center">${r.daysPresent > 0 ? `${r.daysPresent} gün` : '—'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;color:${r.totalMs > 0 ? '#1e3a5f' : '#94a3b8'}">${fmtMs(r.totalMs)}</td>
      </tr>`).join('');

    const subtitle = isMonthly ? 'Aýlyk İş Sagatlaryny Hasabaty' : 'İş Sagatlaryny Hasabaty';

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:720px;margin:24px auto">
  <div style="background:#1e3a5f;padding:22px 28px;border-radius:10px 10px 0 0">
    <div style="color:#ffffff;font-size:22px;font-weight:700">Esta WorkForce</div>
    <div style="color:#93c5fd;font-size:13px;margin-top:4px">${subtitle}</div>
  </div>
  <div style="background:#ffffff;padding:24px 28px">
    <p style="color:#64748b;font-size:13px;margin-top:0">
      Döwür: <strong style="color:#1e293b">${startDate}</strong> — <strong style="color:#1e293b">${endDate}</strong>
    </p>
    <div style="display:flex;gap:12px;margin-bottom:22px">
      <div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#1d4ed8">${rows.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Jemi işçi</div>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#16a34a">${worked.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">İşlän</div>
      </div>
      <div style="flex:1;background:#eef2ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:#4f46e5">${fmtMs(totalMs)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Jemi sagat</div>
      </div>
      <div style="flex:1;background:#fef9c3;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:#854d0e">${fmtMs(avgMs)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Ortaça (işçi başyna)</div>
      </div>
    </div>
    <div style="font-weight:600;font-size:13px;color:#1e3a5f;margin-bottom:10px">
      Jikme-jik sanawy${rows.length > 50 ? ` (ilkinji 50, jemi ${rows.length})` : ''}:
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#1e3a5f;color:#ffffff">
          <th style="padding:8px;text-align:left;font-size:11px">#</th>
          <th style="padding:8px;text-align:left;font-size:11px">İşçi adı</th>
          <th style="padding:8px;text-align:left;font-size:11px">Sicil No</th>
          <th style="padding:8px;text-align:left;font-size:11px">Görev</th>
          <th style="padding:8px;text-align:left;font-size:11px">Ekip</th>
          <th style="padding:8px;text-align:center;font-size:11px">İşlän gün</th>
          <th style="padding:8px;text-align:left;font-size:11px">Jemi sagat</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="font-size:11px;color:#94a3b8;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0">
      ${isMonthly ? 'Bu hasabat awtomatik usulda iberildi' : 'Bu hasabat el bilen iberildi'} — Esta WorkForce Ulgamy
    </p>
  </div>
</div>
</body>
</html>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PDF (existing)
  // ════════════════════════════════════════════════════════════════════════════

  async generateDailyPdf(date: string): Promise<Buffer> {
    const rows = await this.buildRows(date, 'daily_all');

    const fonts = {
      Roboto: {
        normal: 'node_modules/pdfmake/build/vfs_fonts.js',
        bold: 'node_modules/pdfmake/build/vfs_fonts.js',
        italics: 'node_modules/pdfmake/build/vfs_fonts.js',
        bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
      },
    };

    const printer = new PdfPrinter(fonts);

    const tableBody = [
      [
        { text: '#', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'İşçi adı', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Sicil No', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Görev', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Ekip', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Giriş', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Çykyş', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: 'Jemi sag', bold: true, fillColor: '#1e3a5f', color: 'white' },
      ],
      ...rows.map((r, i) => [
        { text: String(i + 1), fontSize: 8 },
        { text: r.name, fontSize: 8 },
        { text: r.workerId, fontSize: 8 },
        { text: r.profession, fontSize: 8 },
        { text: r.brigade, fontSize: 8 },
        { text: fmtTime(r.checkIn), fontSize: 8, color: r.checkIn ? '#16a34a' : '#ef4444' },
        { text: fmtTime(r.checkOut), fontSize: 8 },
        { text: fmtMs(r.totalMs), fontSize: 8 },
      ]),
    ];

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 40, 20, 30],
      content: [
        { text: 'Esta WorkForce — Günlük Hasabat', style: 'header' },
        { text: `Sene: ${date}   |   Jemi işçi: ${rows.length}   |   Gelen: ${rows.filter(r => r.checkIn).length}`, style: 'subheader' },
        {
          table: {
            headerRows: 1,
            widths: [18, '*', 50, 80, 70, 38, 38, 45],
            body: tableBody,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1',
            fillColor: (rowIndex: number) => rowIndex > 0 && rowIndex % 2 === 0 ? '#f8fafc' : null,
          },
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true, color: '#1e3a5f', marginBottom: 4 },
        subheader: { fontSize: 10, color: '#475569', marginBottom: 10 },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (c: Buffer) => chunks.push(c));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}
