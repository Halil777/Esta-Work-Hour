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
import { ShiftSettingsService } from '../shift-settings/shift-settings.service';
import { buildDailyAttendance } from '../common/attendance-pairing.util';
import { computeCredited, groupAdjustmentsByWorkerDate } from '../common/credited-hours.util';
import { WorkAdjustment, AdjustmentStatus } from '../work-adjustments/work-adjustment.entity';

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

// Returns an Excel time-duration value (a fraction of a 24h day, e.g. 13h55m
// -> 13.9166.../24) snapped to the nearest whole minute, meant to be shown
// with a '[h]:mm' number format so it reads as "13:55" instead of a raw
// decimal like 13.91 — the underlying total minutes are unchanged, only the
// display format changes to match how the admin panel shows elapsed time.
function msToExcelDuration(ms: number): number {
  if (!ms || ms <= 0) return 0;
  const roundedMs = Math.round(ms / 60000) * 60000;
  return roundedMs / 86400000;
}

// Plain decimal hours (e.g. 11, 9.5, 0.75) rounded to the nearest minute then
// to 2 decimal places — meant to be shown with a '0.##' number format so a
// clean grace-snapped value reads as "11", not a clock-like "11:00". Used on
// the Planlanan Saat (policy hours) sheet, where the whole point is to
// surface plain hour counts rather than elapsed clock durations.
function msToHoursNumber(ms: number): number {
  if (!ms || ms <= 0) return 0;
  const roundedMs = Math.round(ms / 60000) * 60000;
  return Math.round((roundedMs / 3600000) * 100) / 100;
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

// Black + gold brand palette for the range-report workbook (matches the
// company's shield/lion mark). Shared by every sheet the workbook builds.
const BRAND = {
  black: 'FF0D0D0D',
  blackSoft: 'FF171717',
  gold: 'FFD4AF37',
  goldBright: 'FFF0D273',
  goldSoft: 'FFE8C568',
  goldDeep: 'FF8B6914',
  goldLine: 'FF33291A',
  cream: 'FFFAF0D7',
  creamSoft: 'FFFCEFC7',
  hairline: 'FFEEE0BE',
  hairlineSoft: 'FFF5EBD0',
  ink: 'FF1A1A1A',
  mutedGold: 'FF9C8A5C',
  dayBadgeBg: 'FFF3D9A6',
  dayBadgeText: 'FF6B4A0A',
  nightBadgeBg: 'FF241D0A',
  nightBadgeText: 'FFE8C568',
};

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
      scanSheetName: 'Check In-Out',
      scanTitle: (tenantName: string) => `${tenantName} — Check-In/Check-Out Log`,
      policySheetName: 'Scheduled Hours',
      policyTitle: (tenantName: string) => `${tenantName} — Scheduled Hours Report`,
      policyNote: 'Hours adjusted to the scheduled shift window within the grace-period tolerance.',
      colNormal: 'Normal', colShortfall: 'Shortfall', colOvertime: 'Overtime',
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
      scanSheetName: 'Приход-Уход',
      scanTitle: (tenantName: string) => `${tenantName} — Записи прихода-ухода`,
      policySheetName: 'Плановые часы',
      policyTitle: (tenantName: string) => `${tenantName} — Отчёт по плановым часам`,
      policyNote: 'Часы, скорректированные по графику смены в пределах допуска (grace).',
      colNormal: 'Норма', colShortfall: 'Недоработка', colOvertime: 'Переработка',
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
      scanSheetName: 'Giriş-Çıkış',
      scanTitle: (tenantName: string) => `${tenantName} — Giriş-Çıkış Kayıtları`,
      policySheetName: 'Planlanan Saat',
      policyTitle: (tenantName: string) => `${tenantName} — Planlanan Çalışma Saatleri Raporu`,
      policyNote: 'Tolerans (grace) payı içinde, planlanan vardiya saatine göre düzeltilmiş saatler.',
      colNormal: 'Normal', colShortfall: 'Eksik', colOvertime: 'Mesai',
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
  /** Officially counted total for the period: admin-corrected (credited) minutes
   *  where an adjustment exists for a day, raw scan-based minutes otherwise.
   *  This is the number shown everywhere as "the" total (reports table, PDF,
   *  emailed HTML digest, Excel main sheet). */
  totalMs: number;
  /** True scan-based total, with no admin corrections applied — always kept
   *  alongside the credited total, never discarded. */
  rawTotalMs: number;
  daysPresent: number;
};

type RangeMatrix = {
  dates: string[];
  workers: {
    workerId: string;
    name: string;
    shift: string | null;
    totalsByDate: Map<string, number>;
    totalMs: number;
    scansByDate: Map<string, { checkIn: number | null; checkOut: number | null }>;
    /** Grace-adjusted "policy" hours: scan noise within the shift's grace
     *  window is snapped to the scheduled shift boundary; deviations beyond
     *  grace reflect the actual scan (see computePolicyMs). Not capped at
     *  the standard shift length — a day can exceed it (real overtime). */
    policyByDate: Map<string, number>;
    policyTotalMs: number;
    /** Admin-corrected (credited) minutes per day: an active WorkAdjustment's
     *  effect on that day's raw minutes, or the raw minutes unchanged when no
     *  adjustment exists. This is the "official" number the main hours sheet
     *  reports — never a replacement for the raw scan record, which stays
     *  available via totalsByDate/scansByDate. */
    creditedByDate: Map<string, number>;
    creditedTotalMs: number;
    /** Sum over the period of min(policyMs, standard) per day — the "normal"
     *  hours a day counts for, capped at the shift's standard duration. */
    normalTotalMs: number;
    /** Sum over the period of max(0, standard - policyMs) on days the
     *  worker scanned but fell short of the standard (excludes absences). */
    shortfallTotalMs: number;
    /** Sum over the period of max(0, policyMs - standard) — hours worked
     *  beyond the standard shift length (overtime). */
    overtimeTotalMs: number;
  }[];
};

/** Per-shift-type settings needed to compute grace-adjusted policy hours. */
type ShiftPolicy = { startTime: string; standardMinutes: number; graceMinutes: number };

/** Epoch ms for `HH:mm` local time (APP_TZ) on the given YYYY-MM-DD date. */
function scheduledEpoch(dateStr: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const utcMidnight = new Date(`${dateStr}T00:00:00Z`).getTime();
  return utcMidnight + (h * 60 + m) * 60000 - TZ_OFFSET_MS;
}

/**
 * Computes grace-adjusted "policy" minutes for one worker-day.
 * - No scan pair -> 0.
 * - No shift assigned / no policy configured -> falls back to the raw diff.
 * - Otherwise: scheduled start = policy.startTime on dateStr; scheduled end =
 *   scheduled start + policy.standardMinutes (this naturally spans midnight
 *   for a night shift, without needing a separate "next day" date string).
 *   If the actual scan is within grace of a boundary, that boundary is used
 *   (absorbing early/late scan noise both ways); otherwise the actual scan
 *   is used, so a real shortfall or a real overrun still shows through.
 */
function computePolicyMs(
  dateStr: string,
  policy: ShiftPolicy | undefined,
  rawCheckIn: number | null,
  rawCheckOut: number | null,
): number {
  if (rawCheckIn === null || rawCheckOut === null) return 0;
  if (!policy) return Math.max(0, rawCheckOut - rawCheckIn);
  const graceMs = policy.graceMinutes * 60000;
  const schedStart = scheduledEpoch(dateStr, policy.startTime);
  const schedEnd = schedStart + policy.standardMinutes * 60000;
  const effStart = Math.abs(rawCheckIn - schedStart) <= graceMs ? schedStart : rawCheckIn;
  const effEnd = Math.abs(rawCheckOut - schedEnd) <= graceMs ? schedEnd : rawCheckOut;
  return Math.max(0, effEnd - effStart);
}

// ─── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(WorkAdjustment)
    private readonly adjRepo: Repository<WorkAdjustment>,
    private readonly attendanceOverridesService: AttendanceOverridesService,
    private readonly shiftSettingsService: ShiftSettingsService,
  ) {}

  /** Active admin adjustments for a set of workers over a date range, grouped by `${workerEntityId}:${workDate}`. */
  private async loadAdjustmentsByWorkerDate(
    workerEntityIds: string[],
    startDate: string,
    endDate: string,
    tenantId?: string,
  ): Promise<Map<string, WorkAdjustment[]>> {
    if (workerEntityIds.length === 0) return new Map();
    const qb = this.adjRepo
      .createQueryBuilder('a')
      .where('a.workerEntityId IN (:...ids)', { ids: workerEntityIds })
      .andWhere('a.workDate BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('a.status = :status', { status: AdjustmentStatus.ACTIVE });
    if (tenantId) qb.andWhere('a.tenantId = :tenantId', { tenantId });
    const adjustments = await qb.getMany();
    return groupAdjustmentsByWorkerDate(adjustments);
  }

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

    // Admin-entered corrections for this date range — the source of the
    // "credited" total reported everywhere alongside the raw scan total.
    const adjustmentsByWorkerDate = await this.loadAdjustmentsByWorkerDate(workerEntityIds, startDate, endDate, tenantId);

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

      // Pair check-in/check-out chronologically across the whole range (not
      // pre-bucketed by calendar date), so an overnight/night-shift session
      // that crosses midnight is attributed correctly instead of silently
      // coming out as 0 — see attendance-pairing.util.ts.
      const daily = buildDailyAttendance(evList, (t) => new Date(t + TZ_OFFSET_MS).toISOString().split('T')[0]);

      // Compute raw + credited total hours and unique days present, applying
      // overrides per day, then admin adjustments (if any) on top.
      let rawTotalMs = 0;
      let creditedTotalMs = 0;
      const uniqueDates = new Set<string>();

      for (const [date, day] of daily) {
        uniqueDates.add(date);
        const ovKey = w ? `${w.id}:${date}` : null;
        const ov = ovKey ? overrideMap.get(ovKey) : undefined;
        const dayMs = ov ? ((ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0) : day.ms;
        rawTotalMs += dayMs;
        const adjs = w ? (adjustmentsByWorkerDate.get(`${w.id}:${date}`) ?? []) : [];
        creditedTotalMs += computeCredited(Math.floor(dayMs / 60000), adjs) * 60000;
      }

      if (w) {
        // Also add days covered by overrides but not in scan events
        for (const [key, ov] of overrideMap) {
          if (!key.startsWith(`${w.id}:`)) continue;
          const ovDate = key.split(':')[1];
          if (!uniqueDates.has(ovDate)) {
            uniqueDates.add(ovDate);
            const dayMs = (ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0;
            rawTotalMs += dayMs;
            const adjs = adjustmentsByWorkerDate.get(`${w.id}:${ovDate}`) ?? [];
            creditedTotalMs += computeCredited(Math.floor(dayMs / 60000), adjs) * 60000;
          }
        }
        // Also add days that only have an admin adjustment (e.g. a fully
        // absent day the admin still chose to credit some hours to) — raw
        // stays 0 for that day, credited reflects the correction.
        for (const [key, adjs] of adjustmentsByWorkerDate) {
          if (!key.startsWith(`${w.id}:`)) continue;
          const adjDate = key.split(':')[1];
          if (uniqueDates.has(adjDate)) continue;
          uniqueDates.add(adjDate);
          creditedTotalMs += computeCredited(0, adjs) * 60000;
        }
      }

      rows.push({
        workerId: empNum,
        name: w?.name ?? empNum,
        profession: w?.profession ?? '—',
        brigade: w?.brigadeName ?? '—',
        totalMs: creditedTotalMs,
        rawTotalMs,
        daysPresent: uniqueDates.size,
      });
    }

    // If filterWorkerIds specified, add workers that had no attendance (0 hours)
    if (filterWorkerIds && filterWorkerIds.length > 0) {
      const present = new Set(rows.map(r => r.workerId));
      const missing = filterWorkerIds.filter(id => !present.has(id));
      if (missing.length > 0) {
        const missingWorkers = await this.workerRepo.find({ where: missing.map(workerId => ({ workerId, ...(tenantId ? { tenantId } : {}) })) });
        const missingAdjustments = await this.loadAdjustmentsByWorkerDate(missingWorkers.map(w => w.id), startDate, endDate, tenantId);
        for (const w of missingWorkers) {
          // Check if this worker has overrides in the range
          const workerOverrides = overrides.filter(o => o.workerEntityId === w.id);
          const rawByDate = new Map(workerOverrides.map(o => [
            o.date,
            (o.checkInMs && o.checkOutMs) ? Number(o.checkOutMs) - Number(o.checkInMs) : 0,
          ]));
          const dateSet = new Set<string>(rawByDate.keys());
          for (const key of missingAdjustments.keys()) {
            if (key.startsWith(`${w.id}:`)) dateSet.add(key.split(':')[1]);
          }
          let overrideTotalMs = 0;
          let creditedTotalMs = 0;
          for (const d of dateSet) {
            const dayMs = rawByDate.get(d) ?? 0;
            overrideTotalMs += dayMs;
            const adjs = missingAdjustments.get(`${w.id}:${d}`) ?? [];
            creditedTotalMs += computeCredited(Math.floor(dayMs / 60000), adjs) * 60000;
          }
          rows.push({
            workerId: w.workerId,
            name: w.name,
            profession: w.profession,
            brigade: w.brigadeName ?? '—',
            totalMs: creditedTotalMs,
            rawTotalMs: overrideTotalMs,
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
  ): Promise<RangeMatrix> {
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

    // Admin-entered corrections — drive creditedByDate/creditedTotalMs below.
    const adjustmentsByWorkerDate = await this.loadAdjustmentsByWorkerDate(workerEntityIds, startDate, endDate, tenantId);

    type Ev = { eventType: string; eventTime: number };
    const byWorker = new Map<string, Ev[]>();
    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorker.set(ev.employeeNumber, arr);
    }
    // Pair chronologically per worker (not pre-bucketed by calendar date) so
    // overnight/night-shift sessions crossing midnight pair correctly.
    const dailyByEmp = new Map<string, ReturnType<typeof buildDailyAttendance>>();
    for (const [empNum, evList] of byWorker) {
      dailyByEmp.set(empNum, buildDailyAttendance(evList, (t) => new Date(t + TZ_OFFSET_MS).toISOString().split('T')[0]));
    }

    // Shift-type settings for grace-adjusted "policy" hours.
    const shiftSettingsList = await this.shiftSettingsService.getAll(tenantId);
    const policyByType = new Map<string, ShiftPolicy>(
      shiftSettingsList.map(s => [s.shiftType, { startTime: s.startTime, standardMinutes: s.standardMinutes, graceMinutes: s.graceMinutes }]),
    );

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
      const creditedByDate = new Map<string, number>();
      const scansByDate = new Map<string, { checkIn: number | null; checkOut: number | null }>();
      const policyByDate = new Map<string, number>();
      const daily = dailyByEmp.get(empNum);
      const policy = w?.shift ? policyByType.get(w.shift) : undefined;
      const standardMs = (policy?.standardMinutes ?? 0) * 60000;
      let totalMs = 0;
      let creditedTotalMs = 0;
      let policyTotalMs = 0;
      let normalTotalMs = 0;
      let shortfallTotalMs = 0;
      let overtimeTotalMs = 0;
      for (const date of dates) {
        const ovKey = w ? `${w.id}:${date}` : null;
        const ov = ovKey ? overrideMap.get(ovKey) : undefined;
        let dayMs = 0;
        let policyMs = 0;
        let checkIn: number | null = null;
        let checkOut: number | null = null;
        if (ov) {
          dayMs = (ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0;
          policyMs = dayMs; // a manual override already represents the intended ground truth
          checkIn = ov.checkInMs;
          checkOut = ov.checkOutMs;
        } else {
          const d = daily?.get(date);
          if (d) {
            dayMs = d.ms;
            checkIn = d.checkIn;
            checkOut = d.checkOut;
          }
          policyMs = computePolicyMs(date, policy, checkIn, checkOut);
        }
        const adjs = w ? (adjustmentsByWorkerDate.get(`${w.id}:${date}`) ?? []) : [];
        const creditedMs = computeCredited(Math.floor(dayMs / 60000), adjs) * 60000;
        if (dayMs > 0) totalsByDate.set(date, dayMs);
        if (creditedMs > 0) creditedByDate.set(date, creditedMs);
        if (policyMs > 0) policyByDate.set(date, policyMs);
        if (checkIn !== null || checkOut !== null) scansByDate.set(date, { checkIn, checkOut });
        totalMs += dayMs;
        creditedTotalMs += creditedMs;
        policyTotalMs += policyMs;
        if (policyMs > 0 && standardMs > 0) {
          normalTotalMs += Math.min(policyMs, standardMs);
          if (policyMs < standardMs) shortfallTotalMs += standardMs - policyMs;
          if (policyMs > standardMs) overtimeTotalMs += policyMs - standardMs;
        } else {
          normalTotalMs += policyMs; // no standard configured (or no shift) -> nothing to split
        }
      }
      return {
        workerId: empNum, name: w?.name ?? empNum, shift: w?.shift ?? null,
        totalsByDate, totalMs, scansByDate, policyByDate, policyTotalMs,
        creditedByDate, creditedTotalMs,
        normalTotalMs, shortfallTotalMs, overtimeTotalMs,
      };
    });

    resultWorkers.sort((a, b) => a.name.localeCompare(b.name));

    return { dates, workers: resultWorkers };
  }

  private async buildRangeXlsx(
    startDate: string,
    endDate: string,
    matrix: RangeMatrix,
    isMonthly: boolean,
    tenantName = 'WorkForce',
    lang: Lang = 'tr',
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = tenantName;
    wb.created = new Date();

    this.addHoursSheet(wb, startDate, endDate, matrix, isMonthly, tenantName, lang);
    this.addPolicyHoursSheet(wb, startDate, endDate, matrix, tenantName, lang);
    this.addScanTimesSheet(wb, startDate, endDate, matrix, tenantName, lang);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  // ── Sheet 1: "Çalışma Saatleri" — the filterable, totalled, heat-mapped hours grid ──
  private addHoursSheet(
    wb: any,
    startDate: string,
    endDate: string,
    matrix: RangeMatrix,
    isMonthly: boolean,
    tenantName: string,
    lang: Lang,
  ): void {
    const L = getL(lang, tenantName);
    const { dates, workers } = matrix;
    const FIXED_COLS = 4; // #, Sicil No, Ad Familiya, Vardiya
    const totalCols = FIXED_COLS + dates.length + 1; // + Jemi (period total) column

    const ws = wb.addWorksheet(L.report, {
      properties: { tabColor: { argb: BRAND.gold } },
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
      { width: 9 },
      ...dates.map(() => ({ width: 7 })),
      { width: 9 },
    ];

    // ── Title band ─────────────────────────────────────────────────────────────
    const titleRow = ws.addRow([L.rangeTitle(isMonthly)]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
    Object.assign(titleRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.black } },
      font: { name: 'Calibri', bold: true, size: 16, color: { argb: BRAND.gold } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    titleRow.height = 32;

    const subRow = ws.addRow([`${L.period}: ${startDate}  -  ${endDate}`]);
    ws.mergeCells(subRow.number, 1, subRow.number, totalCols);
    Object.assign(subRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.blackSoft } },
      font: { name: 'Calibri', size: 11, color: { argb: BRAND.goldSoft } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    subRow.height = 20;

    ws.addRow([]);

    // ── KPI summary band ─────────────────────────────────────────────────────────
    const workedWorkers = workers.filter(w => w.creditedTotalMs > 0);
    const grandTotalMs = workers.reduce((s, w) => s + w.creditedTotalMs, 0);
    const avgMs = workedWorkers.length > 0 ? Math.floor(grandTotalMs / workedWorkers.length) : 0;

    const kpis: { label: string; value: string; color: string; bg: string }[] = [
      { label: L.totalWorkers, value: String(workers.length), color: BRAND.gold, bg: BRAND.blackSoft },
      { label: L.workedWorkers, value: String(workedWorkers.length), color: BRAND.goldSoft, bg: BRAND.blackSoft },
      { label: L.totalHours, value: fmtMs(grandTotalMs, lang), color: BRAND.goldBright, bg: BRAND.blackSoft },
      { label: L.avgPerWorker, value: fmtMs(avgMs, lang), color: BRAND.goldDeep, bg: BRAND.blackSoft },
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
      lc.font = { name: 'Calibri', size: 9, color: { argb: BRAND.mutedGold } };
      lc.alignment = { horizontal: 'center', vertical: 'middle' };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
      const vc = kpiValueRow.getCell(startCol);
      vc.value = kpi.value;
      vc.font = { name: 'Calibri', size: 15, bold: true, color: { argb: kpi.color } };
      vc.alignment = { horizontal: 'center', vertical: 'middle' };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
      if (idx < kpis.length - 1) {
        kpiLabelRow.getCell(endCol).border = { right: { style: 'thin', color: { argb: BRAND.goldLine } } };
        kpiValueRow.getCell(endCol).border = { right: { style: 'thin', color: { argb: BRAND.goldLine } } };
      }
    });
    kpiLabelRow.height = 16;
    kpiValueRow.height = 24;

    ws.addRow([]);

    // ── Table header: # | Sicil No | Ad Familiya | Vardiya | 01.08 | ... | TOPLAM ──
    const sundayFlags = dates.map(d => new Date(`${d}T00:00:00Z`).getUTCDay() === 0);
    const isDateCol = (colNumber: number) => colNumber > FIXED_COLS && colNumber <= FIXED_COLS + dates.length;

    const headerValues = ['#', L.colTabNo, L.colWorker, L.colShift, ...dates.map(d => d.split('-').slice(1).reverse().join('.')), L.footer];
    const headerRow = ws.addRow(headerValues);
    headerRow.eachCell((c: any, colNumber: number) => {
      const sunday = isDateCol(colNumber) && sundayFlags[colNumber - FIXED_COLS - 1];
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sunday ? BRAND.gold : BRAND.black } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: sunday ? BRAND.black : BRAND.gold } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = {
        top: { style: 'thin', color: { argb: BRAND.black } },
        bottom: { style: 'medium', color: { argb: BRAND.gold } },
        left: { style: 'thin', color: { argb: BRAND.goldLine } },
        right: { style: 'thin', color: { argb: BRAND.goldLine } },
      };
    });
    headerRow.height = 22;

    // ── Data rows: one per worker, cells = daily hours, last col = period total ────
    const firstDataRowNum = headerRow.number + 1;
    workers.forEach((w, i) => {
      const shiftLabel = w.shift === 'day' ? L.shiftDay : w.shift === 'night' ? L.shiftNight : '\u2014';
      const rowValues = [
        i + 1, w.workerId, w.name, shiftLabel,
        ...dates.map(d => {
          const ms = w.creditedByDate.get(d) ?? 0;
          return ms > 0 ? msToExcelDuration(ms) : null;
        }),
        w.creditedTotalMs > 0 ? msToExcelDuration(w.creditedTotalMs) : null,
      ];
      const r = ws.addRow(rowValues);
      const bg = i % 2 === 0 ? BRAND.cream : 'FFFFFFFF';
      r.eachCell((c: any, colNumber: number) => {
        const sunday = isDateCol(colNumber) && sundayFlags[colNumber - FIXED_COLS - 1];
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sunday ? BRAND.creamSoft : bg } };
        c.font = { name: 'Calibri', size: 9 };
        c.alignment = { horizontal: colNumber <= FIXED_COLS ? (colNumber === 1 || colNumber === 4 ? 'center' : 'left') : 'right', vertical: 'middle' };
        c.border = {
          bottom: { style: 'hair', color: { argb: BRAND.hairline } },
          left: { style: 'hair', color: { argb: BRAND.hairlineSoft } },
          right: { style: 'hair', color: { argb: BRAND.hairlineSoft } },
        };
        if (colNumber > FIXED_COLS) c.numFmt = '[h]:mm';
      });
      r.getCell(2).font = { name: 'Calibri', size: 9, color: { argb: BRAND.mutedGold } };
      r.getCell(3).font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.ink } };
      if (w.shift === 'day' || w.shift === 'night') {
        const badge = w.shift === 'day'
          ? { bg: BRAND.dayBadgeBg, text: BRAND.dayBadgeText }
          : { bg: BRAND.nightBadgeBg, text: BRAND.nightBadgeText };
        r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
        r.getCell(4).font = { name: 'Calibri', size: 9, bold: true, color: { argb: badge.text } };
      } else {
        r.getCell(4).font = { name: 'Calibri', size: 9, color: { argb: BRAND.mutedGold } };
      }
      r.getCell(totalCols).font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.goldDeep } };
      r.height = 16;
    });
    const lastDataRowNum = headerRow.number + workers.length;

    // ── Footer / totals row — live SUBTOTAL formulas so filtering updates them ─────
    const footRow = ws.addRow(['', '', '', L.footer]);
    ws.mergeCells(footRow.number, 1, footRow.number, FIXED_COLS);
    for (let ci = FIXED_COLS + 1; ci <= totalCols; ci++) {
      const letter = colLetter(ci);
      footRow.getCell(ci).value = { formula: `SUBTOTAL(109,${letter}${firstDataRowNum}:${letter}${lastDataRowNum})` };
    }
    footRow.eachCell((c: any, colNumber: number) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.black } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: BRAND.gold } };
      c.alignment = { horizontal: colNumber <= FIXED_COLS ? 'center' : 'right', vertical: 'middle' };
      if (colNumber > FIXED_COLS) c.numFmt = '[h]:mm';
    });
    const grandCell = footRow.getCell(totalCols);
    grandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.gold } };
    grandCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: BRAND.black } };
    footRow.height = 22;

    // ── Generated-at footnote ───────────────────────────────────────────────────
    ws.addRow([]);
    const now = new Date(Date.now() + TZ_OFFSET_MS);
    const stamp = `${String(now.getUTCDate()).padStart(2, '0')}.${String(now.getUTCMonth() + 1).padStart(2, '0')}.${now.getUTCFullYear()} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const noteRow = ws.addRow([`${L.generatedAt}: ${stamp}  -  ${tenantName}`]);
    ws.mergeCells(noteRow.number, 1, noteRow.number, totalCols);
    noteRow.getCell(1).font = { name: 'Calibri', size: 8, italic: true, color: { argb: BRAND.mutedGold } };
    noteRow.getCell(1).alignment = { horizontal: 'right' };

    // ── AutoFilter — per-column dropdowns, including every date column ─────────────
    if (workers.length > 0) {
      ws.autoFilter = {
        from: { row: headerRow.number, column: 1 },
        to: { row: lastDataRowNum, column: totalCols },
      };
    }

    // ── Conditional formatting — gold heat-scale on daily hours + data bar on Jemi ──
    if (dates.length > 0 && workers.length > 0) {
      const firstDateColLetter = colLetter(FIXED_COLS + 1);
      const lastDateColLetter = colLetter(FIXED_COLS + dates.length);
      ws.addConditionalFormatting({
        ref: `${firstDateColLetter}${firstDataRowNum}:${lastDateColLetter}${lastDataRowNum}`,
        rules: [
          {
            type: 'colorScale',
            cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
            color: [{ argb: 'FFFFFBF0' }, { argb: 'FFEED9A0' }, { argb: 'FFC9A227' }],
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
            color: { argb: BRAND.gold },
          },
        ],
      });
    }

    // ── Freeze panes: header + identity columns always visible while scrolling ──────
    ws.views = [{ state: 'frozen', xSplit: FIXED_COLS, ySplit: headerRow.number, showGridLines: false }];

    // ── Print setup: repeat header row + identity columns on every printed page ─────
    ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;
    ws.pageSetup.printTitlesColumn = 'A:D';
  }

  // ── Sheet: "Planlanan Saat" — grace-adjusted policy hours, a separate tab ──────
  // Mirrors addHoursSheet's structure exactly, but every hour cell comes from
  // policyByDate/policyTotalMs (computePolicyMs) instead of the raw scan
  // totals, so admins can compare the two side by side without either
  // sheet's numbers ever being silently replaced.
  private addPolicyHoursSheet(
    wb: any,
    startDate: string,
    endDate: string,
    matrix: RangeMatrix,
    tenantName: string,
    lang: Lang,
  ): void {
    const L = getL(lang, tenantName);
    const { dates, workers } = matrix;
    const FIXED_COLS = 4; // #, Sicil No, Ad Familiya, Vardiya
    // + 3 summary columns: Normal (capped at standard) | Shortfall | Overtime —
    // reported separately instead of one blended total, per the tenant's request.
    const SUMMARY_COLS = 3;
    const totalCols = FIXED_COLS + dates.length + SUMMARY_COLS;
    const normalCol = FIXED_COLS + dates.length + 1;
    const shortfallCol = normalCol + 1;
    const overtimeCol = normalCol + 2;

    const ws = wb.addWorksheet(L.policySheetName, {
      properties: { tabColor: { argb: BRAND.goldSoft } },
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
      { width: 9 },
      ...dates.map(() => ({ width: 7 })),
      { width: 9 },
      { width: 9 },
      { width: 10 },
    ];

    // ── Title band ─────────────────────────────────────────────────────────────
    const titleRow = ws.addRow([L.policyTitle(tenantName)]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
    Object.assign(titleRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.black } },
      font: { name: 'Calibri', bold: true, size: 16, color: { argb: BRAND.gold } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    titleRow.height = 32;

    const subRow = ws.addRow([`${L.period}: ${startDate}  -  ${endDate}`]);
    ws.mergeCells(subRow.number, 1, subRow.number, totalCols);
    Object.assign(subRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.blackSoft } },
      font: { name: 'Calibri', size: 11, color: { argb: BRAND.goldSoft } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    subRow.height = 20;

    const noteRow0 = ws.addRow([L.policyNote]);
    ws.mergeCells(noteRow0.number, 1, noteRow0.number, totalCols);
    Object.assign(noteRow0.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.blackSoft } },
      font: { name: 'Calibri', italic: true, size: 9, color: { argb: BRAND.mutedGold } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    noteRow0.height = 16;

    ws.addRow([]);

    // ── KPI summary band — normal vs overtime reported separately ──────────────────
    const workedWorkers = workers.filter(w => w.policyTotalMs > 0);
    const normalGrandMs = workers.reduce((s, w) => s + w.normalTotalMs, 0);
    const overtimeGrandMs = workers.reduce((s, w) => s + w.overtimeTotalMs, 0);

    const kpis: { label: string; value: string; color: string; bg: string }[] = [
      { label: L.totalWorkers, value: String(workers.length), color: BRAND.gold, bg: BRAND.blackSoft },
      { label: L.workedWorkers, value: String(workedWorkers.length), color: BRAND.goldSoft, bg: BRAND.blackSoft },
      { label: L.colNormal, value: fmtMs(normalGrandMs, lang), color: BRAND.goldBright, bg: BRAND.blackSoft },
      { label: L.colOvertime, value: fmtMs(overtimeGrandMs, lang), color: BRAND.goldDeep, bg: BRAND.blackSoft },
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
      lc.font = { name: 'Calibri', size: 9, color: { argb: BRAND.mutedGold } };
      lc.alignment = { horizontal: 'center', vertical: 'middle' };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
      const vc = kpiValueRow.getCell(startCol);
      vc.value = kpi.value;
      vc.font = { name: 'Calibri', size: 15, bold: true, color: { argb: kpi.color } };
      vc.alignment = { horizontal: 'center', vertical: 'middle' };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bg } };
      if (idx < kpis.length - 1) {
        kpiLabelRow.getCell(endCol).border = { right: { style: 'thin', color: { argb: BRAND.goldLine } } };
        kpiValueRow.getCell(endCol).border = { right: { style: 'thin', color: { argb: BRAND.goldLine } } };
      }
    });
    kpiLabelRow.height = 16;
    kpiValueRow.height = 24;

    ws.addRow([]);

    // ── Table header: # | Sicil No | Ad Familiya | Vardiya | 01.08 | ... | Normal | Eksik | Mesai ──
    const sundayFlags = dates.map(d => new Date(`${d}T00:00:00Z`).getUTCDay() === 0);
    const isDateCol = (colNumber: number) => colNumber > FIXED_COLS && colNumber <= FIXED_COLS + dates.length;

    const headerValues = ['#', L.colTabNo, L.colWorker, L.colShift, ...dates.map(d => d.split('-').slice(1).reverse().join('.')), L.colNormal, L.colShortfall, L.colOvertime];
    const headerRow = ws.addRow(headerValues);
    headerRow.eachCell((c: any, colNumber: number) => {
      const sunday = isDateCol(colNumber) && sundayFlags[colNumber - FIXED_COLS - 1];
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sunday ? BRAND.gold : BRAND.black } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: sunday ? BRAND.black : BRAND.gold } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = {
        top: { style: 'thin', color: { argb: BRAND.black } },
        bottom: { style: 'medium', color: { argb: BRAND.gold } },
        left: { style: 'thin', color: { argb: BRAND.goldLine } },
        right: { style: 'thin', color: { argb: BRAND.goldLine } },
      };
    });
    headerRow.height = 26;

    // ── Data rows: one per worker. Daily cells show plain decimal hours (not a
    // clock-like "[h]:mm" duration) since the whole point of this sheet is a
    // clean hour count once grace has absorbed scan noise. Normal/Shortfall/
    // Overtime are reported as separate period totals rather than blended
    // into one number, so "worked less" and "worked more than standard" are
    // never hidden inside a single figure. ──────────────────────────────────
    const firstDataRowNum = headerRow.number + 1;
    workers.forEach((w, i) => {
      const shiftLabel = w.shift === 'day' ? L.shiftDay : w.shift === 'night' ? L.shiftNight : '\u2014';
      const rowValues = [
        i + 1, w.workerId, w.name, shiftLabel,
        ...dates.map(d => {
          const ms = w.policyByDate.get(d) ?? 0;
          return ms > 0 ? msToHoursNumber(ms) : null;
        }),
        w.normalTotalMs > 0 ? msToHoursNumber(w.normalTotalMs) : null,
        w.shortfallTotalMs > 0 ? msToHoursNumber(w.shortfallTotalMs) : null,
        w.overtimeTotalMs > 0 ? msToHoursNumber(w.overtimeTotalMs) : null,
      ];
      const r = ws.addRow(rowValues);
      const bg = i % 2 === 0 ? BRAND.cream : 'FFFFFFFF';
      r.eachCell((c: any, colNumber: number) => {
        const sunday = isDateCol(colNumber) && sundayFlags[colNumber - FIXED_COLS - 1];
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sunday ? BRAND.creamSoft : bg } };
        c.font = { name: 'Calibri', size: 9 };
        c.alignment = { horizontal: colNumber <= FIXED_COLS ? (colNumber === 1 || colNumber === 4 ? 'center' : 'left') : 'right', vertical: 'middle' };
        c.border = {
          bottom: { style: 'hair', color: { argb: BRAND.hairline } },
          left: { style: 'hair', color: { argb: BRAND.hairlineSoft } },
          right: { style: 'hair', color: { argb: BRAND.hairlineSoft } },
        };
        if (colNumber > FIXED_COLS) c.numFmt = '0.##';
      });
      r.getCell(2).font = { name: 'Calibri', size: 9, color: { argb: BRAND.mutedGold } };
      r.getCell(3).font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.ink } };
      if (w.shift === 'day' || w.shift === 'night') {
        const badge = w.shift === 'day'
          ? { bg: BRAND.dayBadgeBg, text: BRAND.dayBadgeText }
          : { bg: BRAND.nightBadgeBg, text: BRAND.nightBadgeText };
        r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
        r.getCell(4).font = { name: 'Calibri', size: 9, bold: true, color: { argb: badge.text } };
      } else {
        r.getCell(4).font = { name: 'Calibri', size: 9, color: { argb: BRAND.mutedGold } };
      }
      r.getCell(normalCol).font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.goldDeep } };
      // Shortfall — flagged in a soft warm tone only on the days it applies.
      if (w.shortfallTotalMs > 0) {
        r.getCell(shortfallCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6DCC8' } };
        r.getCell(shortfallCol).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF9C4A1A' } };
      }
      // Overtime — flagged bright gold, distinct from the normal-hours gold.
      if (w.overtimeTotalMs > 0) {
        r.getCell(overtimeCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.goldBright } };
        r.getCell(overtimeCol).font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.black } };
      }
      r.height = 16;
    });
    const lastDataRowNum = headerRow.number + workers.length;

    // ── Footer / totals row — live SUBTOTAL formulas so filtering updates them ─────
    const footRow = ws.addRow(['', '', '', L.footer]);
    ws.mergeCells(footRow.number, 1, footRow.number, FIXED_COLS);
    for (let ci = FIXED_COLS + 1; ci <= totalCols; ci++) {
      const letter = colLetter(ci);
      footRow.getCell(ci).value = { formula: `SUBTOTAL(109,${letter}${firstDataRowNum}:${letter}${lastDataRowNum})` };
    }
    footRow.eachCell((c: any, colNumber: number) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.black } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: BRAND.gold } };
      c.alignment = { horizontal: colNumber <= FIXED_COLS ? 'center' : 'right', vertical: 'middle' };
      if (colNumber > FIXED_COLS) c.numFmt = '0.##';
    });
    const normalGrandCell = footRow.getCell(normalCol);
    normalGrandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.gold } };
    normalGrandCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: BRAND.black } };
    footRow.height = 22;

    // ── Generated-at footnote ───────────────────────────────────────────────────
    ws.addRow([]);
    const now = new Date(Date.now() + TZ_OFFSET_MS);
    const stamp = `${String(now.getUTCDate()).padStart(2, '0')}.${String(now.getUTCMonth() + 1).padStart(2, '0')}.${now.getUTCFullYear()} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const noteRow = ws.addRow([`${L.generatedAt}: ${stamp}  -  ${tenantName}`]);
    ws.mergeCells(noteRow.number, 1, noteRow.number, totalCols);
    noteRow.getCell(1).font = { name: 'Calibri', size: 8, italic: true, color: { argb: BRAND.mutedGold } };
    noteRow.getCell(1).alignment = { horizontal: 'right' };

    // ── AutoFilter — per-column dropdowns, including every date column ─────────────
    if (workers.length > 0) {
      ws.autoFilter = {
        from: { row: headerRow.number, column: 1 },
        to: { row: lastDataRowNum, column: totalCols },
      };
    }

    // ── Conditional formatting — gold heat-scale on daily hours + data bar on Normal ──
    if (dates.length > 0 && workers.length > 0) {
      const firstDateColLetter = colLetter(FIXED_COLS + 1);
      const lastDateColLetter = colLetter(FIXED_COLS + dates.length);
      ws.addConditionalFormatting({
        ref: `${firstDateColLetter}${firstDataRowNum}:${lastDateColLetter}${lastDataRowNum}`,
        rules: [
          {
            type: 'colorScale',
            cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
            color: [{ argb: 'FFFFFBF0' }, { argb: 'FFEED9A0' }, { argb: 'FFC9A227' }],
          },
        ],
      });
      const normalLetter = colLetter(normalCol);
      ws.addConditionalFormatting({
        ref: `${normalLetter}${firstDataRowNum}:${normalLetter}${lastDataRowNum}`,
        rules: [
          {
            type: 'dataBar',
            minLength: 0, maxLength: 100,
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: BRAND.gold },
          },
        ],
      });
    }

    // ── Freeze panes: header + identity columns always visible while scrolling ──────
    ws.views = [{ state: 'frozen', xSplit: FIXED_COLS, ySplit: headerRow.number, showGridLines: false }];

    // ── Print setup: repeat header row + identity columns on every printed page ─────
    ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;
    ws.pageSetup.printTitlesColumn = 'A:D';
  }

  // ── Sheet 2: "Giriş-Çıkış" — the audit trail (actual scan times), a separate tab ──
  private addScanTimesSheet(
    wb: any,
    startDate: string,
    endDate: string,
    matrix: RangeMatrix,
    tenantName: string,
    lang: Lang,
  ): void {
    const L = getL(lang, tenantName);
    const { dates, workers } = matrix;
    const FIXED_COLS = 4; // #, Sicil No, Ad Familiya, Vardiya
    const totalCols = FIXED_COLS + dates.length * 2 + 1; // + a cross-reference Jemi (hours) column

    const ws = wb.addWorksheet(L.scanSheetName, {
      properties: { tabColor: { argb: BRAND.goldDeep } },
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
      { width: 9 },
      ...dates.flatMap(() => [{ width: 8 }, { width: 8 }]),
      { width: 9 },
    ];

    // ── Title band ─────────────────────────────────────────────────────────────
    const titleRow = ws.addRow([L.scanTitle(tenantName)]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols);
    Object.assign(titleRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.black } },
      font: { name: 'Calibri', bold: true, size: 16, color: { argb: BRAND.gold } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    titleRow.height = 32;

    const subRow = ws.addRow([`${L.period}: ${startDate}  -  ${endDate}`]);
    ws.mergeCells(subRow.number, 1, subRow.number, totalCols);
    Object.assign(subRow.getCell(1), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.blackSoft } },
      font: { name: 'Calibri', size: 11, color: { argb: BRAND.goldSoft } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    subRow.height = 20;

    ws.addRow([]);

    // ── Two-row header: a merged date label spans each Giriş/Çıkış pair ─────────────
    const sundayFlags = dates.map(d => new Date(`${d}T00:00:00Z`).getUTCDay() === 0);
    const groupHeaderRow = ws.addRow([]);
    const subHeaderRow = ws.addRow([]);

    const styleGroupCell = (cell: any, sunday: boolean) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sunday ? BRAND.gold : BRAND.black } };
      cell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: sunday ? BRAND.black : BRAND.gold } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: BRAND.black } },
        bottom: { style: 'medium', color: { argb: BRAND.gold } },
        left: { style: 'thin', color: { argb: BRAND.goldLine } },
        right: { style: 'thin', color: { argb: BRAND.goldLine } },
      };
    };

    // Fixed identity columns: value in the top row, vertically merged across both header rows.
    const fixedLabels = ['#', L.colTabNo, L.colWorker, L.colShift];
    fixedLabels.forEach((label, idx) => {
      const col = idx + 1;
      ws.mergeCells(groupHeaderRow.number, col, subHeaderRow.number, col);
      const cell = groupHeaderRow.getCell(col);
      cell.value = label;
      styleGroupCell(cell, false);
      styleGroupCell(subHeaderRow.getCell(col), false);
    });

    // One merged date label per day, with Giriş/Çıkış sub-labels underneath.
    let col = FIXED_COLS + 1;
    dates.forEach((d, i) => {
      const sunday = sundayFlags[i];
      const colIn = col;
      const colOut = col + 1;
      ws.mergeCells(groupHeaderRow.number, colIn, groupHeaderRow.number, colOut);
      const dateCell = groupHeaderRow.getCell(colIn);
      dateCell.value = d.split('-').slice(1).reverse().join('.');
      styleGroupCell(dateCell, sunday);
      styleGroupCell(groupHeaderRow.getCell(colOut), sunday);

      const inCell = subHeaderRow.getCell(colIn);
      inCell.value = L.colCheckIn;
      styleGroupCell(inCell, sunday);
      const outCell = subHeaderRow.getCell(colOut);
      outCell.value = L.colCheckOut;
      styleGroupCell(outCell, sunday);

      col += 2;
    });

    // Trailing cross-reference "TOPLAM" (hours) column, vertically merged.
    ws.mergeCells(groupHeaderRow.number, totalCols, subHeaderRow.number, totalCols);
    const totalHeaderCell = groupHeaderRow.getCell(totalCols);
    totalHeaderCell.value = L.footer;
    styleGroupCell(totalHeaderCell, false);
    styleGroupCell(subHeaderRow.getCell(totalCols), false);

    groupHeaderRow.height = 20;
    subHeaderRow.height = 18;

    // ── Data rows: one per worker, cells = that day's first check-in / last check-out ──
    const isDateSubCol = (colNumber: number) => colNumber > FIXED_COLS && colNumber <= FIXED_COLS + dates.length * 2;
    const firstDataRowNum = subHeaderRow.number + 1;
    workers.forEach((w, i) => {
      const shiftLabel = w.shift === 'day' ? L.shiftDay : w.shift === 'night' ? L.shiftNight : '\u2014';
      const rowValues: (string | number | null)[] = [i + 1, w.workerId, w.name, shiftLabel];
      dates.forEach(d => {
        const s = w.scansByDate.get(d);
        rowValues.push(fmtTime(s?.checkIn ?? null), fmtTime(s?.checkOut ?? null));
      });
      rowValues.push(w.totalMs > 0 ? msToExcelDuration(w.totalMs) : null);

      const r = ws.addRow(rowValues);
      const bg = i % 2 === 0 ? BRAND.cream : 'FFFFFFFF';
      r.eachCell((c: any, colNumber: number) => {
        const sunday = isDateSubCol(colNumber) && sundayFlags[Math.floor((colNumber - FIXED_COLS - 1) / 2)];
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sunday ? BRAND.creamSoft : bg } };
        c.font = { name: 'Calibri', size: 9 };
        c.alignment = { horizontal: colNumber <= FIXED_COLS ? (colNumber === 1 || colNumber === 4 ? 'center' : 'left') : 'right', vertical: 'middle' };
        c.border = {
          bottom: { style: 'hair', color: { argb: BRAND.hairline } },
          left: { style: 'hair', color: { argb: BRAND.hairlineSoft } },
          right: { style: 'hair', color: { argb: BRAND.hairlineSoft } },
        };
        if (colNumber === totalCols) c.numFmt = '[h]:mm';
      });
      r.getCell(2).font = { name: 'Calibri', size: 9, color: { argb: BRAND.mutedGold } };
      r.getCell(3).font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.ink } };
      if (w.shift === 'day' || w.shift === 'night') {
        const badge = w.shift === 'day'
          ? { bg: BRAND.dayBadgeBg, text: BRAND.dayBadgeText }
          : { bg: BRAND.nightBadgeBg, text: BRAND.nightBadgeText };
        r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: badge.bg } };
        r.getCell(4).font = { name: 'Calibri', size: 9, bold: true, color: { argb: badge.text } };
      } else {
        r.getCell(4).font = { name: 'Calibri', size: 9, color: { argb: BRAND.mutedGold } };
      }
      r.getCell(totalCols).font = { name: 'Calibri', size: 9, bold: true, color: { argb: BRAND.goldDeep } };
      r.height = 16;
    });
    const lastDataRowNum = subHeaderRow.number + workers.length;

    // ── Footer row: only the cross-reference hours column is summable ───────────────
    const footRow = ws.addRow(['', '', '', L.footer]);
    ws.mergeCells(footRow.number, 1, footRow.number, FIXED_COLS);
    const totalLetter = colLetter(totalCols);
    footRow.getCell(totalCols).value = { formula: `SUBTOTAL(109,${totalLetter}${firstDataRowNum}:${totalLetter}${lastDataRowNum})` };
    footRow.eachCell((c: any) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.black } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: BRAND.gold } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    const grandCell = footRow.getCell(totalCols);
    grandCell.numFmt = '[h]:mm';
    grandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.gold } };
    grandCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: BRAND.black } };
    footRow.height = 22;

    // ── Generated-at footnote ───────────────────────────────────────────────────
    ws.addRow([]);
    const now = new Date(Date.now() + TZ_OFFSET_MS);
    const stamp = `${String(now.getUTCDate()).padStart(2, '0')}.${String(now.getUTCMonth() + 1).padStart(2, '0')}.${now.getUTCFullYear()} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const noteRow = ws.addRow([`${L.generatedAt}: ${stamp}  -  ${tenantName}`]);
    ws.mergeCells(noteRow.number, 1, noteRow.number, totalCols);
    noteRow.getCell(1).font = { name: 'Calibri', size: 8, italic: true, color: { argb: BRAND.mutedGold } };
    noteRow.getCell(1).alignment = { horizontal: 'right' };

    // ── AutoFilter on the sub-header row (Giriş/Çıkış are the real column names) ─────
    if (workers.length > 0) {
      ws.autoFilter = {
        from: { row: subHeaderRow.number, column: 1 },
        to: { row: lastDataRowNum, column: totalCols },
      };
    }

    // ── Freeze panes: both header rows + identity columns always visible ────────────
    ws.views = [{ state: 'frozen', xSplit: FIXED_COLS, ySplit: subHeaderRow.number, showGridLines: false }];

    // ── Print setup: repeat both header rows + identity columns on every page ───────
    ws.pageSetup.printTitlesRow = `${groupHeaderRow.number}:${subHeaderRow.number}`;
    ws.pageSetup.printTitlesColumn = 'A:D';
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
