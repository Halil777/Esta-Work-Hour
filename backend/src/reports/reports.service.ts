import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require('pdfmake');

// Absolute, cwd-independent path to pdfmake's bundled Roboto TTFs — resolved
// via the package's own package.json so it works regardless of the process's
// working directory (dev, Docker, PM2, …).
const PDFMAKE_FONTS_DIR = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'build', 'fonts', 'Roboto');
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { APP_TZ } from '../common/date-utils';
import { ReportType } from '../report-config/report-config.entity';
import { AttendanceOverridesService } from '../attendance-overrides/attendance-overrides.service';

// ─── Formatters ────────────────────────────────────────────────────────────────

function fmtMs(ms: number, lang: Lang = 'tr'): string {
  if (!ms || ms <= 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const hLabel = lang === 'ru' ? 'ч' : lang === 'en' ? 'h' : 'sa';
  const mLabel = lang === 'ru' ? 'мин' : lang === 'en' ? 'min' : 'dk';
  return m > 0 ? `${h} ${hLabel} ${m} ${mLabel}` : `${h} ${hLabel}`;
}

// Europe/Moscow = UTC+3, no DST since 2014. Computed manually to avoid Windows IANA-tz issues.
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function fmtTime(ms: number | null): string {
  if (!ms) return '—';
  const d = new Date(Number(ms) + TZ_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function fmtDecimalHours(ms: number): number {
  if (!ms || ms <= 0) return 0;
  return Math.round((ms / 3600000) * 100) / 100;
}

function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

type Lang = 'en' | 'ru' | 'tr';

function getL(lang: Lang = 'tr', tenantName = 'WorkForce') {
  const L = {
    en: {
      dailyTitle: `${tenantName} — Daily Attendance Report`,
      rangeTitle: (monthly: boolean) => `${tenantName} — ${monthly ? 'Monthly' : 'Work Hours'} Report`,
      period: 'Period', date: 'Date', report: 'Report',
      totalWorkers: 'Total Workers', workedWorkers: 'Worked',
      totalHours: 'Total Hours', avgPerWorker: 'Avg per worker',
      colWorker: 'Worker Name', colTabNo: 'Tab No', colProfession: 'Profession', colTeam: 'Team',
      colShift: 'Shift', colCheckIn: 'Check In', colCheckOut: 'Check Out', colTotalHours: 'Total Hours',
      colDaysWorked: 'Days Worked', colAvgDay: 'Avg/Day',
      sectionPresent: (n: number) => `PRESENT  (${n} workers)`,
      sectionAbsent: (n: number) => `ABSENT  (${n} workers)`,
      shiftDay: 'Day', shiftNight: 'Night',
      footer: 'TOTAL',
      came: 'Present', notCame: 'Absent', pct: 'Percentage',
      total: 'Total', days: (n: number) => `${n} days`,
      grandTotal: 'Grand Total',
      generatedAt: 'Generated',
      reportLabels: {
        daily_all: 'All Workers', daily_staff: 'Staff Only',
        daily_shift_day: 'Day Shift', daily_shift_night: 'Night Shift',
        daily_attended: 'Present Only', daily_absent: 'Absent Only',
      },
    },
    ru: {
      dailyTitle: `${tenantName} — Ежедневный отчёт`,
      rangeTitle: (monthly: boolean) => `${tenantName} — ${monthly ? 'Месячный отчёт' : 'Отчёт рабочих часов'}`,
      period: 'Период', date: 'Дата', report: 'Отчёт',
      totalWorkers: 'Всего работников', workedWorkers: 'Работавших',
      totalHours: 'Всего часов', avgPerWorker: 'Ср. на работника',
      colWorker: 'Имя работника', colTabNo: 'Таб. №', colProfession: 'Должность', colTeam: 'Бригада',
      colShift: 'Смена', colCheckIn: 'Приход', colCheckOut: 'Уход', colTotalHours: 'Всего часов',
      colDaysWorked: 'Дней работал', colAvgDay: 'Ср. в день',
      sectionPresent: (n: number) => `ПРИСУТСТВОВАЛИ  (${n} чел.)`,
      sectionAbsent: (n: number) => `ОТСУТСТВОВАЛИ  (${n} чел.)`,
      shiftDay: 'День', shiftNight: 'Ночь',
      footer: 'ИТОГО',
      came: 'Пришёл', notCame: 'Не пришёл', pct: 'Процент',
      total: 'Всего', days: (n: number) => `${n} дн.`,
      grandTotal: 'Общий итог',
      generatedAt: 'Сформирован',
      reportLabels: {
        daily_all: 'Все работники', daily_staff: 'Только персонал',
        daily_shift_day: 'Дневная смена', daily_shift_night: 'Ночная смена',
        daily_attended: 'Только присутствующие', daily_absent: 'Только отсутствующие',
      },
    },
    tr: {
      dailyTitle: `${tenantName} — Günlük Devam Raporu`,
      rangeTitle: (monthly: boolean) => `${tenantName} — ${monthly ? 'Aylık' : 'Çalışma Saatleri'} Raporu`,
      period: 'Dönem', date: 'Tarih', report: 'Rapor',
      totalWorkers: 'Toplam İşçi', workedWorkers: 'Çalışan İşçi',
      totalHours: 'Toplam Saat', avgPerWorker: 'İşçi Başına Ortalama',
      colWorker: 'İşçi Adı', colTabNo: 'Sicil No', colProfession: 'Meslek', colTeam: 'Ekip',
      colShift: 'Vardiya', colCheckIn: 'Giriş', colCheckOut: 'Çıkış', colTotalHours: 'Toplam Saat',
      colDaysWorked: 'Çalışılan Gün', colAvgDay: 'Günlük Ort.',
      sectionPresent: (n: number) => `GELDİ  (${n} kişi)`,
      sectionAbsent: (n: number) => `GELMEDİ  (${n} kişi)`,
      shiftDay: 'Gündüz', shiftNight: 'Gece',
      footer: 'TOPLAM',
      came: 'Geldi', notCame: 'Gelmedi', pct: 'Yüzde',
      total: 'Toplam', days: (n: number) => `${n} gün`,
      grandTotal: 'Genel Toplam',
      generatedAt: 'Oluşturulma Tarihi',
      reportLabels: {
        daily_all: 'Tüm İşçiler', daily_staff: 'Sadece Personel',
        daily_shift_day: 'Gündüz Vardiyası', daily_shift_night: 'Gece Vardiyası',
        daily_attended: 'Sadece Gelenler', daily_absent: 'Sadece Gelmeyenler',
      },
    },
  };
  return L[lang] ?? L.tr;
}

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
    private readonly attendanceOverridesService: AttendanceOverridesService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  //  DAILY REPORT  (existing logic, unchanged)
  // ════════════════════════════════════════════════════════════════════════════

  private async buildRows(date: string, reportType: ReportType = 'daily_all', tenantId?: string): Promise<Row[]> {
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
      ? await this.workerRepo.find({ where: empNums.map(workerId => ({ workerId, ...(tenantId ? { tenantId } : {}) })) })
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

    // Load overrides for this date (keyed by workerEntityId)
    const overridesForDate = await this.attendanceOverridesService.getForDate(date, tenantId);
    const overrideByEntityId = new Map<string, { checkInMs: number | null; checkOutMs: number | null }>(
      overridesForDate.map(o => [o.workerEntityId, { checkInMs: o.checkInMs ? Number(o.checkInMs) : null, checkOutMs: o.checkOutMs ? Number(o.checkOutMs) : null }]),
    );

    for (const [empNum, evList] of byWorker) {
      const w = workerMap.get(empNum);
      if (w) presentEntityIds.add(w.id);

      // Apply override if one exists for this worker+date
      const ov = w ? overrideByEntityId.get(w.id) : undefined;
      let firstIn: number | null;
      let lastOut: number | null;
      let totalMs: number;

      if (ov) {
        firstIn = ov.checkInMs;
        lastOut = ov.checkOutMs;
        totalMs = (ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0;
      } else {
        firstIn = null;
        lastOut = null;
        totalMs = 0;
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

    const allActive = await this.workerRepo.find({ where: { status: 'Active' as any, ...(tenantId ? { tenantId } : {}) } });
    for (const w of allActive) {
      if (!presentEntityIds.has(w.id)) {
        // Check if override exists for this absent worker
        const ov = overrideByEntityId.get(w.id);
        rows.push({
          name: w.name,
          workerId: w.workerId,
          profession: w.profession,
          brigade: w.brigadeName ?? '—',
          shift: w.shift ?? '—',
          isStaff: w.isStaff ?? false,
          checkIn: ov?.checkInMs ?? null,
          checkOut: ov?.checkOutMs ?? null,
          totalMs: ov && ov.checkInMs && ov.checkOutMs ? ov.checkOutMs - ov.checkInMs : 0,
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
    tenantId?: string,
    tenantName = 'WorkForce',
    lang: Lang = 'tr',
  ): Promise<{ xlsx: Buffer; html: string }> {
    const rows = await this.buildRows(date, reportType, tenantId);
    const xlsx = await this.buildXlsx(date, reportType, rows, tenantName, lang);
    const html = this.buildEmailHtml(date, reportType, rows, isManual, tenantName, lang);
    return { xlsx, html };
  }

  private async buildXlsx(date: string, reportType: ReportType, rows: Row[], tenantName = 'WorkForce', lang: Lang = 'tr'): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const L = getL(lang, tenantName);
    const attended = rows.filter(r => r.checkIn !== null);
    const absent   = rows.filter(r => r.checkIn === null);
    const pct = rows.length > 0 ? Math.round((attended.length / rows.length) * 100) : 0;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(L.report);
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

    const titleRow = ws.addRow([L.dailyTitle]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, COLS);
    const titleCell = titleRow.getCell(1);
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 30;

    const statsRow = ws.addRow([
      `${L.date}: ${date}   |   ${L.report}: ${L.reportLabels[reportType]}   |   ${L.total}: ${rows.length}   |   ${L.came}: ${attended.length}   |   ${L.notCame}: ${absent.length}   |   ${L.pct}: ${pct}%`,
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

    const COL_HEADERS = ['#', L.colWorker, L.colTabNo, L.colProfession, L.colTeam, L.colShift, L.colCheckIn, L.colCheckOut, L.colTotalHours];
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
          row.shift === 'day' ? L.shiftDay : row.shift === 'night' ? L.shiftNight : '—',
          fmtTime(row.checkIn),
          fmtTime(row.checkOut),
          fmtMs(row.totalMs, lang),
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
      addSectionHeader(L.sectionPresent(attended.length), 'FF16A34A');
      addColHeaders();
      addDataRows(attended, 0, true);
    }

    if (reportType !== 'daily_attended') {
      ws.addRow([]);
      addSectionHeader(L.sectionAbsent(absent.length), 'FFDC2626');
      addColHeaders();
      addDataRows(absent, attended.length, false);
    }

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  private buildEmailHtml(date: string, reportType: ReportType, rows: Row[], isManual: boolean, tenantName = 'WorkForce', lang: Lang = 'tr'): string {
    const L = getL(lang, tenantName);
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
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:${r.checkIn ? '#16a34a' : '#dc2626'}">${r.checkIn ? L.came : L.notCame}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:680px;margin:24px auto">
  <div style="background:#1e3a5f;padding:22px 28px;border-radius:10px 10px 0 0">
    <div style="color:#ffffff;font-size:22px;font-weight:700">${tenantName}</div>
    <div style="color:#93c5fd;font-size:13px;margin-top:4px">${L.date}: ${date} — ${L.reportLabels[reportType]}</div>
  </div>
  <div style="background:#ffffff;padding:24px 28px">
    <div style="display:flex;gap:12px;margin-bottom:22px">
      <div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#1d4ed8">${rows.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${L.total}</div>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#16a34a">${attended.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${L.came}</div>
      </div>
      <div style="flex:1;background:#fef2f2;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#dc2626">${absent.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${L.notCame}</div>
      </div>
      <div style="flex:1;background:#fefce8;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:30px;font-weight:700;color:#ca8a04">${pct}%</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${L.pct}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#334155;color:#ffffff">
          <th style="padding:8px;text-align:left;font-size:11px">#</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colWorker}</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colTabNo}</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colProfession}</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colCheckIn}</th>
          <th style="padding:8px;text-align:left;font-size:11px">Status</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
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
    tenantId?: string,
  ): Promise<{
    rows: RangeRow[];
    startDate: string;
    endDate: string;
    totalWorkers: number;
    totalMs: number;
    daysInRange: number;
  }> {
    const rows = await this.buildRangeRows(startDate, endDate, workerIds, tenantId);
    const daysInRange = this.daysBetween(startDate, endDate);
    const totalMs = rows.reduce((s, r) => s + r.totalMs, 0);
    return { rows, startDate, endDate, totalWorkers: rows.length, totalMs, daysInRange };
  }

  async generateRangeReport(
    startDate: string,
    endDate: string,
    workerIds?: string[],
    isMonthly = false,
    tenantId?: string,
    tenantName = 'WorkForce',
    lang: Lang = 'tr',
  ): Promise<{ xlsx: Buffer; html: string; subject: string }> {
    const L = getL(lang, tenantName);
    const rows = await this.buildRangeRows(startDate, endDate, workerIds, tenantId);
    const matrix = await this.buildRangeDailyMatrix(startDate, endDate, workerIds, tenantId);
    const xlsx = await this.buildRangeXlsx(startDate, endDate, matrix, isMonthly, tenantName, lang);
    const html = this.buildRangeEmailHtml(startDate, endDate, rows, isMonthly, tenantName, lang);

    const subject = `${L.rangeTitle(isMonthly)} (${startDate} — ${endDate})`;

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
    tenantId?: string,
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
      ? await this.workerRepo.find({ where: empNums.map(workerId => ({ workerId, ...(tenantId ? { tenantId } : {}) })) })
      : [];
    const workerMap = new Map(workers.map(w => [w.workerId, w]));

    // Load all overrides for this date range
    const workerEntityIds = workers.map(w => w.id);
    const overrides = await this.attendanceOverridesService.getForWorkerIdsRange(workerEntityIds, startDate, endDate, tenantId);
    // Key: `${workerEntityId}:${date}` → { checkInMs, checkOutMs }
    const overrideMap = new Map(
      overrides.map(o => [`${o.workerEntityId}:${o.date}`, { checkInMs: o.checkInMs ? Number(o.checkInMs) : null, checkOutMs: o.checkOutMs ? Number(o.checkOutMs) : null }]),
    );

    // Group events per worker
    type Ev = { eventType: string; eventTime: number; date: string };
    const byWorker = new Map<string, Ev[]>();
    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({
        eventType: ev.eventType,
        eventTime: Number(ev.eventTime),
        date: new Date(Number(ev.eventTime) + TZ_OFFSET_MS).toISOString().split('T')[0],
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

      // Group events by date
      const byDate = new Map<string, Ev[]>();
      for (const ev of evList) {
        const arr = byDate.get(ev.date) ?? [];
        arr.push(ev);
        byDate.set(ev.date, arr);
      }

      // Compute total hours + unique days present, applying overrides per day
      let totalMs = 0;
      const uniqueDates = new Set<string>();

      for (const [date, dayEvs] of byDate) {
        uniqueDates.add(date);
        const ovKey = w ? `${w.id}:${date}` : null;
        const ov = ovKey ? overrideMap.get(ovKey) : undefined;
        if (ov) {
          totalMs += (ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0;
        } else {
          let clockIn: number | null = null;
          for (const ev of dayEvs) {
            if (ev.eventType === 'CHECK_IN') {
              if (clockIn === null) clockIn = ev.eventTime;
            } else {
              if (clockIn !== null) { totalMs += ev.eventTime - clockIn; clockIn = null; }
            }
          }
        }
      }

      // Also add days covered by overrides but not in scan events
      if (w) {
        for (const [key, ov] of overrideMap) {
          if (!key.startsWith(`${w.id}:`)) continue;
          const ovDate = key.split(':')[1];
          if (!uniqueDates.has(ovDate)) {
            uniqueDates.add(ovDate);
            totalMs += (ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0;
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
        const missingWorkers = await this.workerRepo.find({ where: missing.map(workerId => ({ workerId, ...(tenantId ? { tenantId } : {}) })) });
        for (const w of missingWorkers) {
          // Check if this worker has overrides in the range
          const workerOverrides = overrides.filter(o => o.workerEntityId === w.id);
          const overrideTotalMs = workerOverrides.reduce((sum, o) => {
            return sum + ((o.checkInMs && o.checkOutMs) ? Number(o.checkOutMs) - Number(o.checkInMs) : 0);
          }, 0);
          rows.push({
            workerId: w.workerId,
            name: w.name,
            profession: w.profession,
            brigade: w.brigadeName ?? '—',
            totalMs: overrideTotalMs,
            daysPresent: workerOverrides.filter(o => o.checkInMs || o.checkOutMs).length,
          });
        }
      }
    }

    rows.sort((a, b) => b.totalMs - a.totalMs); // Sort by total hours descending
    return rows;
  }

  // Builds a date x worker matrix of daily worked hours (ms), used by the
  // range Excel export. Unlike buildRangeRows (period totals per worker),
  // this keeps per-day granularity: rows = calendar dates, columns = workers.
  private async buildRangeDailyMatrix(
    startDate: string,
    endDate: string,
    filterWorkerIds?: string[],
    tenantId?: string,
  ): Promise<{
    dates: string[];
    workers: { workerId: string; name: string; totalsByDate: Map<string, number>; totalMs: number }[];
  }> {
    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') BETWEEN $1 AND $2
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [startDate, endDate],
      );

    const empNumsFromEvents = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];
    const empNumSet = new Set(empNumsFromEvents);
    if (filterWorkerIds && filterWorkerIds.length > 0) {
      for (const id of filterWorkerIds) empNumSet.add(id);
    }
    const empNums = [...empNumSet];

    const workers = empNums.length > 0
      ? await this.workerRepo.find({ where: empNums.map(workerId => ({ workerId, ...(tenantId ? { tenantId } : {}) })) })
      : [];
    const workerMap = new Map(workers.map(w => [w.workerId, w]));

    const workerEntityIds = workers.map(w => w.id);
    const overrides = await this.attendanceOverridesService.getForWorkerIdsRange(workerEntityIds, startDate, endDate, tenantId);
    const overrideMap = new Map(
      overrides.map(o => [`${o.workerEntityId}:${o.date}`, { checkInMs: o.checkInMs ? Number(o.checkInMs) : null, checkOutMs: o.checkOutMs ? Number(o.checkOutMs) : null }]),
    );

    type Ev = { eventType: string; eventTime: number };
    const byWorkerDate = new Map<string, Ev[]>();
    for (const ev of events) {
      const date = new Date(Number(ev.eventTime) + TZ_OFFSET_MS).toISOString().split('T')[0];
      const key = `${ev.employeeNumber}:${date}`;
      const arr = byWorkerDate.get(key) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorkerDate.set(key, arr);
    }

    const dates: string[] = [];
    {
      let cursor = new Date(`${startDate}T00:00:00Z`).getTime();
      const end = new Date(`${endDate}T00:00:00Z`).getTime();
      while (cursor <= end) {
        dates.push(new Date(cursor).toISOString().split('T')[0]);
        cursor += 86400000;
      }
    }

    const filteredEmpNums = (filterWorkerIds && filterWorkerIds.length > 0)
      ? empNums.filter(id => filterWorkerIds.includes(id))
      : empNumsFromEvents;

    const resultWorkers = filteredEmpNums.map(empNum => {
      const w = workerMap.get(empNum);
      const totalsByDate = new Map<string, number>();
      let totalMs = 0;
      for (const date of dates) {
        const ovKey = w ? `${w.id}:${date}` : null;
        const ov = ovKey ? overrideMap.get(ovKey) : undefined;
        let dayMs = 0;
        if (ov) {
          dayMs = (ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0;
        } else {
          const evs = byWorkerDate.get(`${empNum}:${date}`) ?? [];
          let clockIn: number | null = null;
          for (const ev of evs) {
            if (ev.eventType === 'CHECK_IN') {
              if (clockIn === null) clockIn = ev.eventTime;
            } else {
              if (clockIn !== null) { dayMs += ev.eventTime - clockIn; clockIn = null; }
            }
          }
        }
        if (dayMs > 0) totalsByDate.set(date, dayMs);
        totalMs += dayMs;
      }
      return { workerId: empNum, name: w?.name ?? empNum, totalsByDate, totalMs };
    });

    resultWorkers.sort((a, b) => a.name.localeCompare(b.name));

    return { dates, workers: resultWorkers };
  }

  private async buildRangeXlsx(
    startDate: string,
    endDate: string,
    matrix: { dates: string[]; workers: { workerId: string; name: string; totalsByDate: Map<string, number>; totalMs: number }[] },
    isMonthly: boolean,
    tenantName = 'WorkForce',
    lang: Lang = 'tr',
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const L = getL(lang, tenantName);
    const { dates, workers } = matrix;
    const FIXED_COLS = 3; // #, Sicil No, Ad Familiya
    const totalCols = FIXED_COLS + dates.length + 1; // + Jemi (period total) column
    const hourUnit = lang === 'ru' ? '\u0447' : lang === 'en' ? 'h' : 'sa';
    const hourNumFmt = `0.##" ${hourUnit}"`;

    const wb = new ExcelJS.Workbook();
    wb.creator = tenantName;
    wb.created = new Date();
    const ws = wb.addWorksheet(L.report, {
      properties: { tabColor: { argb: 'FF1E3A5F' } },
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
    });

    ws.columns = [
      { width: 5 },
      { width: 13 },
      { width: 26 },
      ...dates.map(() => ({ width: 11 })),
      { width: 13 },
    ];

    // ── Title band ─────────────────────────────────────────────────────────────
    const titleRow = ws.addRow([L.rangeTitle(isMonthly)]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
    Object.assign(titleRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } },
      font: { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    titleRow.height = 32;

    const subRow = ws.addRow([`${L.period}: ${startDate}  -  ${endDate}`]);
    ws.mergeCells(subRow.number, 1, subRow.number, totalCols);
    Object.assign(subRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5E8E' } },
      font: { name: 'Calibri', size: 11, color: { argb: 'FFCFE2FF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    subRow.height = 20;

    ws.addRow([]);

    // ── KPI summary band ─────────────────────────────────────────────────────────
    const workedWorkers = workers.filter(w => w.totalMs > 0);
    const grandTotalMs = workers.reduce((s, w) => s + w.totalMs, 0);
    const avgMs = workedWorkers.length > 0 ? Math.floor(grandTotalMs / workedWorkers.length) : 0;

    const kpis: { label: string; value: string; color: string; bg: string }[] = [
      { label: L.totalWorkers, value: String(workers.length), color: 'FF1D4ED8', bg: 'FFEFF6FF' },
      { label: L.workedWorkers, value: String(workedWorkers.length), color: 'FF16A34A', bg: 'FFF0FDF4' },
      { label: L.totalHours, value: fmtMs(grandTotalMs, lang), color: 'FF4F46E5', bg: 'FFEEF2FF' },
      { label: L.avgPerWorker, value: fmtMs(avgMs, lang), color: 'FFB45309', bg: 'FFFEF9C3' },
    ];
    const kpiSpan = Math.max(1, Math.floor(totalCols / kpis.length));
    const kpiLabelRow = ws.addRow([]);
    const kpiValueRow = ws.addRow([]);
    kpis.forEach((kpi, idx) => {
      const startCol = idx * kpiSpan + 1;
      const endCol = idx === kpis.length - 1 ? totalCols : startCol + kpiSpan - 1;
      ws.mergeCells(kpiLabelRow.number, startCol, kpiLabelRow.number, endCol);
      ws.mergeCells(kpiValueRow.number, startCol, kpiValueRow.number, endCol);
      const lc = kpiLabelRow.getCell(startCol);
      lc.value = kpi.label;
      lc.font = { name: 'Calibri', size: 9, color: { argb: 'FF64748B' } };
      lc.alignment = { horizontal: 'center', vertical: 'middle' };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
      const vc = kpiValueRow.getCell(startCol);
      vc.value = kpi.value;
      vc.font = { name: 'Calibri', size: 15, bold: true, color: { argb: kpi.color } };
      vc.alignment = { horizontal: 'center', vertical: 'middle' };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
      if (idx < kpis.length - 1) {
        kpiLabelRow.getCell(endCol).border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
        kpiValueRow.getCell(endCol).border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
      }
    });
    kpiLabelRow.height = 16;
    kpiValueRow.height = 24;

    ws.addRow([]);

    // ── Table header: # | Sicil No | Ad Familiya | 01.08.2026 | ... | TOPLAM ──────
    const sundayFlags = dates.map(d => new Date(`${d}T00:00:00Z`).getUTCDay() === 0);
    const isDateCol = (colNumber: number) => colNumber > FIXED_COLS && colNumber <= FIXED_COLS + dates.length;

    const headerValues = ['#', L.colTabNo, L.colWorker, ...dates.map(d => d.split('-').reverse().join('.')), L.footer];
    const headerRow = ws.addRow(headerValues);
    headerRow.eachCell((c: any, colNumber: number) => {
      const sunday = isDateCol(colNumber) && sundayFlags[colNumber - FIXED_COLS - 1];
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sunday ? 'FF7F1D1D' : 'FF1E3A5F' } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = {
        top: { style: 'thin', color: { argb: 'FF1E3A5F' } },
        bottom: { style: 'medium', color: { argb: 'FF93C5FD' } },
        left: { style: 'thin', color: { argb: 'FF33547A' } },
        right: { style: 'thin', color: { argb: 'FF33547A' } },
      };
    });
    headerRow.height = 22;

    // ── Data rows: one per worker, cells = daily hours, last col = period total ────
    const firstDataRowNum = headerRow.number + 1;
    workers.forEach((w, i) => {
      const rowValues = [
        i + 1, w.workerId, w.name,
        ...dates.map(d => {
          const ms = w.totalsByDate.get(d) ?? 0;
          return ms > 0 ? fmtDecimalHours(ms) : null;
        }),
        w.totalMs > 0 ? fmtDecimalHours(w.totalMs) : null,
      ];
      const r = ws.addRow(rowValues);
      const bg = i % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
      r.eachCell((c: any, colNumber: number) => {
        const sunday = isDateCol(colNumber) && sundayFlags[colNumber - FIXED_COLS - 1];
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sunday ? 'FFFDF2F2' : bg } };
        c.font = { name: 'Calibri', size: 9 };
        c.alignment = { horizontal: colNumber <= FIXED_COLS ? (colNumber === 1 ? 'center' : 'left') : 'right', vertical: 'middle' };
        c.border = {
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          left: { style: 'hair', color: { argb: 'FFEEF2F6' } },
          right: { style: 'hair', color: { argb: 'FFEEF2F6' } },
        };
        if (colNumber > FIXED_COLS) c.numFmt = hourNumFmt;
      });
      r.getCell(2).font = { name: 'Calibri', size: 9, color: { argb: 'FF64748B' } };
      r.getCell(3).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      r.getCell(totalCols).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E3A5F' } };
      r.height = 16;
    });
    const lastDataRowNum = headerRow.number + workers.length;

    // ── Footer / totals row — live SUBTOTAL formulas so filtering updates them ─────
    const footRow = ws.addRow(['', '', L.footer]);
    ws.mergeCells(footRow.number, 1, footRow.number, FIXED_COLS);
    for (let ci = FIXED_COLS + 1; ci <= totalCols; ci++) {
      const letter = colLetter(ci);
      footRow.getCell(ci).value = { formula: `SUBTOTAL(109,${letter}${firstDataRowNum}:${letter}${lastDataRowNum})` };
    }
    footRow.eachCell((c: any, colNumber: number) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      c.alignment = { horizontal: colNumber <= FIXED_COLS ? 'center' : 'right', vertical: 'middle' };
      if (colNumber > FIXED_COLS) c.numFmt = hourNumFmt;
    });
    const grandCell = footRow.getCell(totalCols);
    grandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
    grandCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    footRow.height = 22;

    // ── Generated-at footnote ───────────────────────────────────────────────────
    ws.addRow([]);
    const now = new Date(Date.now() + TZ_OFFSET_MS);
    const stamp = `${String(now.getUTCDate()).padStart(2, '0')}.${String(now.getUTCMonth() + 1).padStart(2, '0')}.${now.getUTCFullYear()} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const noteRow = ws.addRow([`${L.generatedAt}: ${stamp}  -  ${tenantName}`]);
    ws.mergeCells(noteRow.number, 1, noteRow.number, totalCols);
    noteRow.getCell(1).font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
    noteRow.getCell(1).alignment = { horizontal: 'right' };

    // ── AutoFilter — per-column dropdowns, including every date column ─────────────
    if (workers.length > 0) {
      ws.autoFilter = {
        from: { row: headerRow.number, column: 1 },
        to: { row: lastDataRowNum, column: totalCols },
      };
    }

    // ── Conditional formatting — blue heat-scale on daily hours + data bar on Jemi ──
    if (dates.length > 0 && workers.length > 0) {
      const firstDateColLetter = colLetter(FIXED_COLS + 1);
      const lastDateColLetter = colLetter(FIXED_COLS + dates.length);
      ws.addConditionalFormatting({
        ref: `${firstDateColLetter}${firstDataRowNum}:${lastDateColLetter}${lastDataRowNum}`,
        rules: [
          {
            type: 'colorScale',
            cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
            color: [{ argb: 'FFEFF6FF' }, { argb: 'FF7DB3F5' }, { argb: 'FF1E3A5F' }],
          },
        ],
      });
      const jemiLetter = colLetter(totalCols);
      ws.addConditionalFormatting({
        ref: `${jemiLetter}${firstDataRowNum}:${jemiLetter}${lastDataRowNum}`,
        rules: [
          {
            type: 'dataBar',
            minLength: 0, maxLength: 100,
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: 'FF60A5FA' },
          },
        ],
      });
    }

    // ── Freeze panes: header + identity columns always visible while scrolling ──────
    ws.views = [{ state: 'frozen', xSplit: FIXED_COLS, ySplit: headerRow.number, showGridLines: false }];

    // ── Print setup: repeat header row + identity columns on every printed page ─────
    ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;
    ws.pageSetup.printTitlesColumn = 'A:C';

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  private buildRangeEmailHtml(
    startDate: string,
    endDate: string,
    rows: RangeRow[],
    isMonthly: boolean,
    tenantName = 'WorkForce',
    lang: Lang = 'tr',
  ): string {
    const L = getL(lang, tenantName);
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
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center">${r.daysPresent > 0 ? L.days(r.daysPresent) : '—'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:700;color:${r.totalMs > 0 ? '#1e3a5f' : '#94a3b8'}">${fmtMs(r.totalMs, lang)}</td>
      </tr>`).join('');

    const autoSentLabel = lang === 'ru'
      ? 'Этот отчёт отправлен автоматически'
      : lang === 'en'
        ? 'This report was sent automatically'
        : 'Bu rapor otomatik olarak gönderildi';
    const manualSentLabel = lang === 'ru'
      ? 'Этот отчёт отправлен вручную'
      : lang === 'en'
        ? 'This report was sent manually'
        : 'Bu rapor manuel olarak gönderildi';
    const detailLabel = lang === 'ru'
      ? `Подробный список${rows.length > 50 ? ` (первые 50 из ${rows.length})` : ''}:`
      : lang === 'en'
        ? `Detailed list${rows.length > 50 ? ` (first 50 of ${rows.length})` : ''}:`
        : `Ayrıntılı liste${rows.length > 50 ? ` (ilk 50, toplam ${rows.length})` : ''}:`;

    return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:720px;margin:24px auto">
  <div style="background:#1e3a5f;padding:22px 28px;border-radius:10px 10px 0 0">
    <div style="color:#ffffff;font-size:22px;font-weight:700">${tenantName}</div>
    <div style="color:#93c5fd;font-size:13px;margin-top:4px">${L.rangeTitle(isMonthly)}</div>
  </div>
  <div style="background:#ffffff;padding:24px 28px">
    <p style="color:#64748b;font-size:13px;margin-top:0">
      ${L.period}: <strong style="color:#1e293b">${startDate}</strong> — <strong style="color:#1e293b">${endDate}</strong>
    </p>
    <div style="display:flex;gap:12px;margin-bottom:22px">
      <div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#1d4ed8">${rows.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${L.totalWorkers}</div>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:700;color:#16a34a">${worked.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${L.workedWorkers}</div>
      </div>
      <div style="flex:1;background:#eef2ff;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:#4f46e5">${fmtMs(totalMs, lang)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${L.totalHours}</div>
      </div>
      <div style="flex:1;background:#fef9c3;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:20px;font-weight:700;color:#854d0e">${fmtMs(avgMs, lang)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${L.avgPerWorker}</div>
      </div>
    </div>
    <div style="font-weight:600;font-size:13px;color:#1e3a5f;margin-bottom:10px">
      ${detailLabel}
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#1e3a5f;color:#ffffff">
          <th style="padding:8px;text-align:left;font-size:11px">#</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colWorker}</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colTabNo}</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colProfession}</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colTeam}</th>
          <th style="padding:8px;text-align:center;font-size:11px">${L.colDaysWorked}</th>
          <th style="padding:8px;text-align:left;font-size:11px">${L.colTotalHours}</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <p style="font-size:11px;color:#94a3b8;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0">
      ${isMonthly ? autoSentLabel : manualSentLabel} — ${tenantName}
    </p>
  </div>
</div>
</body>
</html>`;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PDF (existing)
  // ════════════════════════════════════════════════════════════════════════════

  async generateDailyPdf(date: string, tenantId?: string, tenantName = 'WorkForce', lang: Lang = 'tr'): Promise<Buffer> {
    const L = getL(lang, tenantName);
    const rows = await this.buildRows(date, 'daily_all', tenantId);

    const fonts = {
      Roboto: {
        normal: path.join(PDFMAKE_FONTS_DIR, 'Roboto-Regular.ttf'),
        bold: path.join(PDFMAKE_FONTS_DIR, 'Roboto-Medium.ttf'),
        italics: path.join(PDFMAKE_FONTS_DIR, 'Roboto-Italic.ttf'),
        bolditalics: path.join(PDFMAKE_FONTS_DIR, 'Roboto-MediumItalic.ttf'),
      },
    };

    const printer = new PdfPrinter(fonts);

    const tableBody = [
      [
        { text: '#', bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: L.colWorker, bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: L.colTabNo, bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: L.colProfession, bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: L.colTeam, bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: L.colCheckIn, bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: L.colCheckOut, bold: true, fillColor: '#1e3a5f', color: 'white' },
        { text: L.colTotalHours, bold: true, fillColor: '#1e3a5f', color: 'white' },
      ],
      ...rows.map((r, i) => [
        { text: String(i + 1), fontSize: 8 },
        { text: r.name, fontSize: 8 },
        { text: r.workerId, fontSize: 8 },
        { text: r.profession, fontSize: 8 },
        { text: r.brigade, fontSize: 8 },
        { text: fmtTime(r.checkIn), fontSize: 8, color: r.checkIn ? '#16a34a' : '#ef4444' },
        { text: fmtTime(r.checkOut), fontSize: 8 },
        { text: fmtMs(r.totalMs, lang), fontSize: 8 },
      ]),
    ];

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [20, 40, 20, 30],
      content: [
        { text: L.dailyTitle, style: 'header' },
        { text: `${L.date}: ${date}   |   ${L.totalWorkers}: ${rows.length}   |   ${L.came}: ${rows.filter(r => r.checkIn).length}`, style: 'subheader' },
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
