import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { AttendanceOverride } from '../attendance-overrides/attendance-override.entity';
import { WorkAdjustment, AdjustmentStatus } from '../work-adjustments/work-adjustment.entity';
import { APP_TZ } from '../common/date-utils';
import { buildDailyAttendance } from '../common/attendance-pairing.util';
import { computeCredited } from '../common/credited-hours.util';

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3 fixed offset (same as reports.service)

function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

function msToMinutes(ms: number): number {
  return Math.floor(ms / 60000);
}

/**
 * Adds/subtracts whole calendar days from a "YYYY-MM-DD" string. Pure
 * calendar arithmetic done in UTC so it never shifts under a local TZ/DST
 * offset — mirrors the frontend's own shiftDate() helper.
 */
function shiftDateStr(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

@Injectable()
export class WorkTimeService {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(AttendanceOverride)
    private readonly overrideRepo: Repository<AttendanceOverride>,
    @InjectRepository(WorkAdjustment)
    private readonly adjRepo: Repository<WorkAdjustment>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  //  Core: batch-build actual-minutes map for a list of workers over a date range
  //  Returns: Map< workerEntityId, Map< workDate, actualMinutes > >
  // ─────────────────────────────────────────────────────────────────────────────

  private async buildActualMap(
    workers: Worker[],
    startDate: string,
    endDate: string,
  ): Promise<Map<string, Map<string, number>>> {
    if (!workers.length) return new Map();

    const workerIdToEntityId = new Map(workers.map(w => [w.workerId, w.id]));
    const workerIds = workers.map(w => w.workerId);

    // One SQL round-trip for all scan events
    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE "employeeNumber" = ANY($1)
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') BETWEEN $2 AND $3
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [workerIds, startDate, endDate],
      );

    // Group: workerId -> chronological events. Pairing is done globally per
    // worker (see attendance-pairing.util.ts) rather than pre-bucketed by
    // calendar date, so overnight/night-shift sessions that cross midnight
    // are paired and credited correctly instead of silently coming out as 0.
    type Ev = { eventType: string; eventTime: number };
    const byWorker = new Map<string, Ev[]>();
    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorker.set(ev.employeeNumber, arr);
    }

    // Load overrides for all workers in range
    const entityIds = workers.map(w => w.id);
    const overrides = await this.overrideRepo
      .createQueryBuilder('o')
      .where('o.workerEntityId = ANY(:ids)', { ids: entityIds })
      .andWhere('o.date BETWEEN :s AND :e', { s: startDate, e: endDate })
      .getMany();

    const overrideMap = new Map(
      overrides.map(o => [`${o.workerEntityId}:${o.date}`, o]),
    );

    // Build result
    const result = new Map<string, Map<string, number>>();

    for (const [workerId, evList] of byWorker) {
      const entityId = workerIdToEntityId.get(workerId);
      if (!entityId) continue;
      if (!result.has(entityId)) result.set(entityId, new Map());
      const workerResult = result.get(entityId)!;

      const daily = buildDailyAttendance(evList, (t) => new Date(t + TZ_OFFSET_MS).toISOString().split('T')[0]);
      const datesForWorker = new Set<string>(daily.keys());
      for (const key of overrideMap.keys()) {
        if (key.startsWith(`${entityId}:`)) datesForWorker.add(key.split(':')[1]);
      }

      for (const date of datesForWorker) {
        const ov = overrideMap.get(`${entityId}:${date}`);
        let totalMs = 0;
        if (ov) {
          totalMs = ov.checkInMs && ov.checkOutMs ? Number(ov.checkOutMs) - Number(ov.checkInMs) : 0;
        } else {
          totalMs = daily.get(date)?.ms ?? 0;
        }
        workerResult.set(date, msToMinutes(totalMs));
      }
    }

    // Override-only (no scan events, but override exists)
    for (const [key, ov] of overrideMap) {
      if (!ov.checkInMs || !ov.checkOutMs) continue;
      const [entityId, date] = key.split(':');
      if (!result.has(entityId)) result.set(entityId, new Map());
      if (!result.get(entityId)!.has(date)) {
        const ms = Number(ov.checkOutMs) - Number(ov.checkInMs);
        if (ms > 0) result.get(entityId)!.set(date, msToMinutes(ms));
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Monthly summary — all active workers
  // ─────────────────────────────────────────────────────────────────────────────

  async getMonthSummary(month: string, tenantId: string) {
    const [startDate, endDate] = monthRange(month);

    const workers = await this.workerRepo.find({
      where: { tenantId, status: 'Active' as any },
      order: { name: 'ASC' },
    });

    const actualMap = await this.buildActualMap(workers, startDate, endDate);

    // All adjustments for the month
    const allAdjs = await this.adjRepo.find({
      where: { tenantId, workDate: Between(startDate, endDate), status: AdjustmentStatus.ACTIVE },
    });
    const adjByWorker = new Map<string, WorkAdjustment[]>();
    for (const adj of allAdjs) {
      const arr = adjByWorker.get(adj.workerEntityId) ?? [];
      arr.push(adj);
      adjByWorker.set(adj.workerEntityId, arr);
    }

    const rows = workers.map(w => {
      const dayMap    = actualMap.get(w.id) ?? new Map<string, number>();
      const workerAdjs = adjByWorker.get(w.id) ?? [];

      const totalActual = [...dayMap.values()].reduce((s, v) => s + v, 0);

      // All dates that have either actual or adjustment
      const allDates = new Set([...dayMap.keys(), ...workerAdjs.map(a => a.workDate)]);
      let totalCredited = 0;
      for (const date of allDates) {
        const actual  = dayMap.get(date) ?? 0;
        const dayAdjs = workerAdjs.filter(a => a.workDate === date);
        totalCredited += computeCredited(actual, dayAdjs);
      }

      return {
        workerEntityId:     w.id,
        workerId:           w.workerId,
        name:               w.name,
        profession:         w.profession,
        brigade:            w.brigadeName,
        shift:              w.shift,
        actualMinutes:      totalActual,
        adjustmentMinutes:  totalCredited - totalActual,
        creditedMinutes:    totalCredited,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        actualMinutes:     acc.actualMinutes     + r.actualMinutes,
        adjustmentMinutes: acc.adjustmentMinutes + r.adjustmentMinutes,
        creditedMinutes:   acc.creditedMinutes   + r.creditedMinutes,
      }),
      { actualMinutes: 0, adjustmentMinutes: 0, creditedMinutes: 0 },
    );

    return { month, totals, workers: rows };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Monthly timesheet for a single worker (day-by-day breakdown)
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  //  Monthly Excel timesheet — per-worker × per-day matrix
  // ─────────────────────────────────────────────────────────────────────────────

  private fmtTimeMs(ms: number | null): string {
    if (!ms) return '';
    const d = new Date(Number(ms) + TZ_OFFSET_MS);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }

  private fmtHoursMs(ms: number): string {
    if (!ms || ms <= 0) return '';
    const h  = Math.floor(ms / 3600000);
    const mi = Math.floor((ms % 3600000) / 60000);
    return `${h}:${String(mi).padStart(2, '0')}`;
  }

  async generateMonthXlsx(month: string, tenantId: string, mode: 'times' | 'hours' | 'both', lang = 'tr'): Promise<Buffer> {
    const [startDate, endDate] = monthRange(month);
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    const workers = await this.workerRepo.find({
      where: { tenantId, status: 'Active' as any },
      order: { name: 'ASC' },
    });

    const workerIds = workers.map(w => w.workerId);
    const entityIds = workers.map(w => w.id);

    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      workerIds.length > 0
        ? await this.eventRepo.query(
            `SELECT "employeeNumber", "eventType", "eventTime"
             FROM attendance_events
             WHERE "employeeNumber" = ANY($1)
               AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') BETWEEN $2 AND $3
             ORDER BY "employeeNumber", "eventTime" ASC`,
            [workerIds, startDate, endDate],
          )
        : [];

    const overrides = entityIds.length > 0
      ? await this.overrideRepo
          .createQueryBuilder('o')
          .where('o.workerEntityId = ANY(:ids)', { ids: entityIds })
          .andWhere('o.date BETWEEN :s AND :e', { s: startDate, e: endDate })
          .getMany()
      : [];

    const overrideMap     = new Map(overrides.map(o => [`${o.workerEntityId}:${o.date}`, o]));
    const workerIdToEntity = new Map(workers.map(w => [w.workerId, w.id]));

    // Group events by entityId (chronological, NOT pre-bucketed by calendar
    // date — pairing is done globally per worker via buildDailyAttendance, so
    // overnight/night-shift sessions crossing midnight pair correctly instead
    // of silently coming out as 0. See attendance-pairing.util.ts.
    type Ev = { eventType: string; eventTime: number };
    const byWorker = new Map<string, Ev[]>();
    for (const ev of events) {
      const entityId = workerIdToEntity.get(ev.employeeNumber);
      if (!entityId) continue;
      const arr = byWorker.get(entityId) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorker.set(entityId, arr);
    }

    // Build per-worker per-day map
    type DayData = { checkIn: number | null; checkOut: number | null; actualMs: number };
    const workerDayMap = new Map<string, Map<string, DayData>>();
    for (const w of workers) workerDayMap.set(w.id, new Map());

    for (const [entityId, evList] of byWorker) {
      const wdm = workerDayMap.get(entityId)!;
      const daily = buildDailyAttendance(evList, (t) => new Date(t + TZ_OFFSET_MS).toISOString().split('T')[0]);
      for (const [date, day] of daily) {
        const ov = overrideMap.get(`${entityId}:${date}`);
        if (ov) {
          const ci = ov.checkInMs  ? Number(ov.checkInMs)  : null;
          const co = ov.checkOutMs ? Number(ov.checkOutMs) : null;
          wdm.set(date, { checkIn: ci, checkOut: co, actualMs: (ci && co) ? co - ci : 0 });
        } else {
          wdm.set(date, { checkIn: day.checkIn, checkOut: day.checkOut, actualMs: day.ms });
        }
      }
    }

    // Override-only days (no scan events)
    for (const [key, ov] of overrideMap) {
      const colonIdx = key.indexOf(':');
      const entityId = key.slice(0, colonIdx);
      const date     = key.slice(colonIdx + 1);
      const wdm = workerDayMap.get(entityId);
      if (!wdm || wdm.has(date)) continue;
      const ci = ov.checkInMs  ? Number(ov.checkInMs)  : null;
      const co = ov.checkOutMs ? Number(ov.checkOutMs) : null;
      if (ci || co) wdm.set(date, { checkIn: ci, checkOut: co, actualMs: (ci && co) ? co - ci : 0 });
    }

    return this.buildTimesheetXlsx(month, y, m, daysInMonth, workers, workerDayMap, mode, lang);
  }

  private async buildTimesheetXlsx(
    month: string,
    year: number,
    monthNum: number,
    daysInMonth: number,
    workers: Worker[],
    workerDayMap: Map<string, Map<string, { checkIn: number | null; checkOut: number | null; actualMs: number }>>,
    mode: 'times' | 'hours' | 'both',
    lang = 'tr',
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');

    // ── i18n labels ────────────────────────────────────────────────────────────
    const I18N: Record<string, {
      months: string[]; days: string[]; sheetName: string;
      title: string; period: string; workerCount: string;
      modeLabel: Record<string, string>;
      regNo: string; name: string; total: string;
      checkIn: string; checkOut: string; hours: string;
    }> = {
      en: {
        months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
        days:   ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
        sheetName: 'Work Time',
        title: 'Employee Attendance Report',
        period: 'Period', workerCount: 'Workers',
        modeLabel: { times: 'Check In / Check Out', hours: 'Hours Worked', both: 'Times + Hours Worked' },
        regNo: 'Reg\nNo', name: 'Full Name', total: 'Total\nHours',
        checkIn: 'In', checkOut: 'Out', hours: 'Hrs',
      },
      ru: {
        months: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
        days:   ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
        sheetName: 'Рабочее время',
        title: 'Отчёт посещаемости работников',
        period: 'Период', workerCount: 'Работников',
        modeLabel: { times: 'Приход / Уход', hours: 'Отработано часов', both: 'Приход / Уход + Часы' },
        regNo: 'Таб.\n№', name: 'Имя', total: 'Итого\nчасов',
        checkIn: 'Прих.', checkOut: 'Уход', hours: 'Ч.',
      },
      tr: {
        months: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
        days:   ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
        sheetName: 'Mesai Takibi',
        title: 'Çalışan Devam Raporu',
        period: 'Dönem', workerCount: 'Çalışan sayısı',
        modeLabel: { times: 'Giriş / Çıkış Zamanları', hours: 'Çalışılan Saatler', both: 'Giriş / Çıkış + Saatler' },
        regNo: 'Sicil\nNo', name: 'Ad Soyad', total: 'Toplam\nSaat',
        checkIn: 'Giriş', checkOut: 'Çıkış', hours: 'Saat',
      },
    };
    const L = I18N[lang] ?? I18N['tr'];

    const MONTHS = L.months;
    const DAYS   = L.days;

    const subCols   = mode === 'hours' ? 1 : mode === 'times' ? 2 : 3;
    const fixedCols = 3; // #, Sicil No, Ad Familiýa
    const totalCols = fixedCols + daysInMonth * subCols + 1;
    const jemiCol   = totalCols;
    const hasSubHdr = mode !== 'hours';
    const frozenRows = hasSubHdr ? 4 : 3;

    const dayFirstCol = (d: number) => fixedCols + (d - 1) * subCols + 1;

    const solidFill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
    const thinBd    = (argb = 'FF94A3B8') => ({ style: 'thin'   as const, color: { argb } });
    const medBd     = (argb = 'FF93C5FD') => ({ style: 'medium' as const, color: { argb } });
    const hairBd    = (argb = 'FFE2E8F0') => ({ style: 'hair'   as const, color: { argb } });

    const BG = {
      title:     'FF1E3A5F',
      subtitle:  'FF2D5E8E',
      dayHdr:    'FF1E3A5F',
      wkndHdr:   'FF7F1D1D',
      subHdr:    'FF334155',
      wkndSub:   'FF6B2020',
      jemiHdr:   'FF0F2D4A',
      even:      'FFFAFAFA',
      odd:       'FFFFFFFF',
      wkndData:  'FFFFF8F8',
      jemiData:  'FFEFF6FF',
      white:     'FFFFFFFF',
    };

    const wb = new ExcelJS.Workbook();
    wb.created = new Date();
    const ws = wb.addWorksheet(L.sheetName, {
      views:     [{ state: 'frozen', xSplit: fixedCols, ySplit: frozenRows }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    // Column widths
    const colDefs: { width: number }[] = [{ width: 4 }, { width: 11 }, { width: 26 }];
    for (let i = 0; i < daysInMonth * subCols; i++) colDefs.push({ width: 6.5 });
    colDefs.push({ width: 10 });
    ws.columns = colDefs;

    // ── Row 1: Title ─────────────────────────────────────────────────────────
    const modeLabel = L.modeLabel[mode];
    const titleRow = ws.addRow([`${L.title} — ${MONTHS[monthNum - 1]} ${year}  (${modeLabel})`]);
    ws.mergeCells(1, 1, 1, totalCols);
    Object.assign(titleRow.getCell(1), {
      fill:      solidFill(BG.title),
      font:      { bold: true, size: 13, color: { argb: BG.white } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    titleRow.height = 30;

    // ── Row 2: Subtitle ──────────────────────────────────────────────────────
    const endDay = String(daysInMonth).padStart(2, '0');
    const subRow = ws.addRow([`${L.period}: ${month}-01 — ${month}-${endDay}   |   ${L.workerCount}: ${workers.length}`]);
    ws.mergeCells(2, 1, 2, totalCols);
    Object.assign(subRow.getCell(1), {
      fill:      solidFill(BG.subtitle),
      font:      { size: 10, color: { argb: 'FFBFDBFE' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    subRow.height = 18;

    // ── Row 3: Day-group headers ─────────────────────────────────────────────
    const dayHdrRow = ws.addRow(new Array(totalCols).fill(''));
    dayHdrRow.height = 34;

    const styleFixedHdr = (col: number, label: string) => {
      if (hasSubHdr) ws.mergeCells(3, col, 4, col);
      const c = dayHdrRow.getCell(col);
      c.value = label;
      c.fill  = solidFill(BG.dayHdr);
      c.font  = { bold: true, size: 9, color: { argb: BG.white } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border    = { top: thinBd(), left: thinBd(), right: thinBd(), bottom: thinBd() };
    };
    styleFixedHdr(1, '#');
    styleFixedHdr(2, L.regNo);
    styleFixedHdr(3, L.name);

    // Jemi header (merged rows 3-4 if needed)
    if (hasSubHdr) ws.mergeCells(3, jemiCol, 4, jemiCol);
    const jemiHdrC = dayHdrRow.getCell(jemiCol);
    jemiHdrC.value = L.total;
    jemiHdrC.fill  = solidFill(BG.jemiHdr);
    jemiHdrC.font  = { bold: true, size: 9, color: { argb: BG.white } };
    jemiHdrC.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    jemiHdrC.border    = { top: thinBd(), left: medBd(), right: thinBd(), bottom: thinBd() };

    for (let d = 1; d <= daysInMonth; d++) {
      const dow    = new Date(year, monthNum - 1, d).getDay();
      const isWknd = dow === 0 || dow === 6;
      const fc     = dayFirstCol(d);
      if (subCols > 1) ws.mergeCells(3, fc, 3, fc + subCols - 1);
      const c = dayHdrRow.getCell(fc);
      c.value = `${d}\n${DAYS[dow]}`;
      c.fill  = solidFill(isWknd ? BG.wkndHdr : BG.dayHdr);
      c.font  = { bold: true, size: 9, color: { argb: BG.white } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border    = { left: medBd(), right: hairBd('FF4B5563'), top: thinBd(), bottom: thinBd() };
    }

    // ── Row 4: Sub-headers (times / both only) ───────────────────────────────
    if (hasSubHdr) {
      const subHdrRow = ws.addRow(new Array(totalCols).fill(''));
      subHdrRow.height = 15;
      const subLabels = mode === 'times' ? [L.checkIn, L.checkOut] : [L.checkIn, L.checkOut, L.hours];

      for (let col = 1; col <= totalCols; col++) {
        const c = subHdrRow.getCell(col);
        let bg = BG.jemiHdr;
        if (col > fixedCols && col < jemiCol) {
          const dayIdx = Math.ceil((col - fixedCols) / subCols);
          const dow    = new Date(year, monthNum - 1, dayIdx).getDay();
          bg           = (dow === 0 || dow === 6) ? BG.wkndSub : BG.subHdr;
          const subIdx = (col - fixedCols - 1) % subCols;
          c.value      = subLabels[subIdx];
        }
        c.fill      = solidFill(bg);
        c.font      = { bold: true, size: 8, color: { argb: BG.white } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        const isFirstSub = col > fixedCols && col < jemiCol && (col - fixedCols - 1) % subCols === 0;
        c.border = {
          left:   isFirstSub ? medBd() : hairBd('FF4B5563'),
          bottom: { style: 'medium' as const, color: { argb: 'FF93C5FD' } },
        };
      }
    }

    // ── Data rows ────────────────────────────────────────────────────────────
    workers.forEach((worker, idx) => {
      const dayMap  = workerDayMap.get(worker.id) ?? new Map();
      const rowData: (string | number)[] = [idx + 1, worker.workerId, worker.name];
      let jemiMs = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${month}-${String(d).padStart(2, '0')}`;
        const dd      = dayMap.get(dateStr);
        const ams     = dd?.actualMs ?? 0;
        jemiMs += ams;
        if (mode === 'times') {
          rowData.push(
            dd?.checkIn  ? this.fmtTimeMs(dd.checkIn)  : '',
            dd?.checkOut ? this.fmtTimeMs(dd.checkOut) : '',
          );
        } else if (mode === 'hours') {
          rowData.push(ams > 0 ? this.fmtHoursMs(ams) : '');
        } else {
          rowData.push(
            dd?.checkIn  ? this.fmtTimeMs(dd.checkIn)  : '',
            dd?.checkOut ? this.fmtTimeMs(dd.checkOut) : '',
            ams > 0      ? this.fmtHoursMs(ams)        : '',
          );
        }
      }
      rowData.push(jemiMs > 0 ? this.fmtHoursMs(jemiMs) : '—');

      const r  = ws.addRow(rowData);
      r.height = 15;
      const bg = idx % 2 === 0 ? BG.even : BG.odd;

      r.eachCell((cell: any, col: number) => {
        let isWknd = false;
        if (col > fixedCols && col < jemiCol) {
          const dayIdx = Math.ceil((col - fixedCols) / subCols);
          const dow    = new Date(year, monthNum - 1, dayIdx).getDay();
          isWknd       = dow === 0 || dow === 6;
        }
        const cellBg = col === jemiCol ? BG.jemiData : (isWknd ? BG.wkndData : bg);
        cell.fill      = solidFill(cellBg);
        cell.font      = { size: 9 };
        cell.alignment = { horizontal: col === 3 ? 'left' : 'center', vertical: 'middle' };
        cell.border    = { bottom: hairBd() };
        const isFirstSub = col > fixedCols && col < jemiCol && (col - fixedCols - 1) % subCols === 0;
        if (isFirstSub)       cell.border = { ...cell.border, left: medBd('FFD1D5DB') };
        if (col === jemiCol)  cell.border = { ...cell.border, left: medBd('FFD1D5DB') };
        if (col === jemiCol)  cell.font   = { size: 9, bold: true, color: { argb: 'FF1E3A5F' } };
        if (col === 2)        cell.font   = { size: 9, color: { argb: 'FF475569' } };
      });
    });

    // ── Footer ───────────────────────────────────────────────────────────────
    const footData: (string | number)[] = ['', 'JEMI', `${workers.length} işgär`];
    let grandTotalMs = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      let dayMs = 0;
      for (const w of workers) dayMs += (workerDayMap.get(w.id) ?? new Map()).get(dateStr)?.actualMs ?? 0;
      grandTotalMs += dayMs;
      if (mode === 'times')       { footData.push('', ''); }
      else if (mode === 'hours')  { footData.push(dayMs > 0 ? this.fmtHoursMs(dayMs) : ''); }
      else                        { footData.push('', '', dayMs > 0 ? this.fmtHoursMs(dayMs) : ''); }
    }
    footData.push(grandTotalMs > 0 ? this.fmtHoursMs(grandTotalMs) : '—');

    const footRow = ws.addRow(footData);
    footRow.height = 20;
    footRow.eachCell((c: any, col: number) => {
      c.fill      = solidFill(BG.jemiHdr);
      c.font      = { bold: true, size: 9, color: { argb: BG.white } };
      c.alignment = { horizontal: col === 3 ? 'left' : 'center', vertical: 'middle' };
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  async getWorkerTimesheet(workerEntityId: string, month: string, tenantId: string) {
    const worker = await this.workerRepo.findOne({ where: { id: workerEntityId, tenantId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const [startDate, endDate] = monthRange(month);
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    const actualDayMap =
      (await this.buildActualMap([worker], startDate, endDate)).get(workerEntityId) ??
      new Map<string, number>();

    // Load adjustments
    const adjustments = await this.adjRepo.find({
      where: { tenantId, workerEntityId, workDate: Between(startDate, endDate), status: AdjustmentStatus.ACTIVE },
      order: { workDate: 'ASC', createdAt: 'ASC' },
    });
    const adjByDate = new Map<string, WorkAdjustment[]>();
    for (const adj of adjustments) {
      const arr = adjByDate.get(adj.workDate) ?? [];
      arr.push(adj);
      adjByDate.set(adj.workDate, arr);
    }

    // Load scan events for check-in / check-out display (first/last per day)
    const scanEvents: { eventType: string; eventTime: string; work_date: string }[] =
      await this.eventRepo.query(
        `SELECT "eventType", "eventTime",
                DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') AS work_date
         FROM attendance_events
         WHERE "employeeNumber" = $1
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') BETWEEN $2 AND $3
         ORDER BY "eventTime" ASC`,
        [worker.workerId, startDate, endDate],
      );

    const scanByDate = new Map<string, { checkIn: number | null; checkOut: number | null }>();
    for (const ev of scanEvents) {
      const d = String(ev.work_date);
      if (!scanByDate.has(d)) scanByDate.set(d, { checkIn: null, checkOut: null });
      const entry = scanByDate.get(d)!;
      if (ev.eventType === 'CHECK_IN'  && entry.checkIn  === null) entry.checkIn  = Number(ev.eventTime);
      if (ev.eventType === 'CHECK_OUT')                             entry.checkOut = Number(ev.eventTime);
    }

    // Build daily rows for every calendar day in the month
    const days: any[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const workDate       = `${month}-${String(d).padStart(2, '0')}`;
      const actualMinutes  = actualDayMap.get(workDate) ?? 0;
      const dayAdjs        = adjByDate.get(workDate) ?? [];
      const creditedMinutes = computeCredited(actualMinutes, dayAdjs);
      const scan           = scanByDate.get(workDate) ?? { checkIn: null, checkOut: null };

      days.push({
        workDate,
        actualMinutes,
        adjustmentMinutes: creditedMinutes - actualMinutes,
        creditedMinutes,
        checkIn:  scan.checkIn,
        checkOut: scan.checkOut,
        adjustments: dayAdjs.map(a => ({
          id:             a.id,
          adjustmentType: a.adjustmentType,
          minutes:        a.minutes,
          reasonId:       a.reasonId,
          reasonLabel:    a.reasonLabel,
          description:    a.description,
          sourceType:     a.sourceType,
          bulkId:         a.bulkId,
          status:         a.status,
          createdBy:      a.createdBy,
          updatedBy:      a.updatedBy,
          createdAt:      a.createdAt,
          updatedAt:      a.updatedAt,
        })),
      });
    }

    const totalActual   = days.reduce((s, d) => s + d.actualMinutes, 0);
    const totalCredited = days.reduce((s, d) => s + d.creditedMinutes, 0);

    return {
      workerEntityId,
      workerId:              worker.workerId,
      name:                  worker.name,
      profession:            worker.profession,
      brigade:               worker.brigadeName,
      shift:                 worker.shift,
      month,
      totalActualMinutes:    totalActual,
      totalAdjustmentMinutes: totalCredited - totalActual,
      totalCreditedMinutes:  totalCredited,
      days,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Single-day summary — ALL active workers on one date, with their raw scan
  //  check-in/check-out still attached. Meant to power an admin day-view where
  //  workers can be grouped by how many hours they actually worked that day
  //  (e.g. "4-5h", "5-6h", ...) and corrected in bulk or individually via
  //  work-adjustments — the actual scan record is never overwritten, only
  //  the credited total is adjusted on top of it.
  // ─────────────────────────────────────────────────────────────────────────────

  async getDaySummary(date: string, tenantId: string) {
    const workers = await this.workerRepo.find({
      where: { tenantId, status: 'Active' as any },
      order: { name: 'ASC' },
    });
    if (workers.length === 0) return { date, workers: [] };

    const workerIds = workers.map(w => w.workerId);

    // Query a 3-day window (the day before and after `date`), not just
    // `date` itself. A night-shift worker who checks in the evening of
    // `date` and checks out the morning after has their CHECK_IN and
    // CHECK_OUT on two different calendar dates — filtering the query to
    // exactly `date` only ever saw the CHECK_IN half of that pair, so the
    // old first-scan/last-scan span always came out as ~0 minutes. Fetching
    // through `date + 1` lets the CHECK_OUT be seen too; fetching from
    // `date - 1` likewise lets a session that started the evening before
    // pair correctly (it is simply attributed to that earlier date, not to
    // `date`, so it doesn't add to `date`'s total — see below). Pairing the
    // whole chronological stream per worker with buildDailyAttendance and
    // then reading the bucket for `date` (which attributes each finished
    // session to the calendar date of its CHECK_IN — see
    // attendance-pairing.util.ts) fixes this and keeps the day view
    // consistent with the monthly summary/timesheet, which already use the
    // same function.
    const prevDate = shiftDateStr(date, -1);
    const nextDate = shiftDateStr(date, 1);

    const events: { employeeNumber: string; eventType: string; eventTime: string; work_date: string }[] =
      await this.eventRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime",
                DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') AS work_date
         FROM attendance_events
         WHERE "employeeNumber" = ANY($1)
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') BETWEEN $2 AND $3
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [workerIds, prevDate, nextDate],
      );

    type Ev = { eventType: string; eventTime: number };
    const byWorker = new Map<string, Ev[]>();
    // Raw scans that fall on `date` itself, regardless of which calendar
    // date the paired session ends up credited to — used only for
    // `hasScan`, so a night-shift worker scanned out on `date` morning
    // (session credited to the previous date) still shows as scanned rather
    // than "no scan" on `date`.
    const rawTodayCount = new Map<string, number>();
    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorker.set(ev.employeeNumber, arr);
      if (String(ev.work_date) === date) {
        rawTodayCount.set(ev.employeeNumber, (rawTodayCount.get(ev.employeeNumber) ?? 0) + 1);
      }
    }

    const entityIds = workers.map(w => w.id);
    const overrides = entityIds.length > 0
      ? await this.overrideRepo
          .createQueryBuilder('o')
          .where('o.workerEntityId = ANY(:ids)', { ids: entityIds })
          .andWhere('o.date = :d', { d: date })
          .getMany()
      : [];
    const overrideByEntity = new Map(overrides.map(o => [o.workerEntityId, o]));

    const adjustments = await this.adjRepo.find({
      where: { tenantId, workDate: date, status: AdjustmentStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });
    const adjByEntity = new Map<string, WorkAdjustment[]>();
    for (const adj of adjustments) {
      const arr = adjByEntity.get(adj.workerEntityId) ?? [];
      arr.push(adj);
      adjByEntity.set(adj.workerEntityId, arr);
    }

    const rows = workers.map(w => {
      const evList = byWorker.get(w.workerId) ?? [];
      const daily = buildDailyAttendance(evList, (t) => new Date(t + TZ_OFFSET_MS).toISOString().split('T')[0]);
      const day = daily.get(date);
      const ov = overrideByEntity.get(w.id);

      let actualMinutes: number;
      let checkIn: number | null;
      let checkOut: number | null;
      if (ov) {
        const ci = ov.checkInMs ? Number(ov.checkInMs) : null;
        const co = ov.checkOutMs ? Number(ov.checkOutMs) : null;
        actualMinutes = (ci && co) ? msToMinutes(co - ci) : 0;
        checkIn = ci;
        checkOut = co;
      } else {
        actualMinutes = msToMinutes(day?.ms ?? 0);
        checkIn = day?.checkIn ?? null;
        checkOut = day?.checkOut ?? null;
      }

      const dayAdjs = adjByEntity.get(w.id) ?? [];
      const creditedMinutes = computeCredited(actualMinutes, dayAdjs);

      return {
        workerEntityId: w.id,
        workerId: w.workerId,
        name: w.name,
        profession: w.profession,
        brigade: w.brigadeName,
        shift: w.shift,
        isStaff: w.isStaff ?? false,
        mesaiSistemi: w.mesaiSistemi || 'Saatlik',
        actualMinutes,
        creditedMinutes,
        adjustmentMinutes: creditedMinutes - actualMinutes,
        checkIn,
        checkOut,
        hasScan: (rawTodayCount.get(w.workerId) ?? 0) > 0,
        adjustments: dayAdjs.map(a => ({
          id: a.id,
          adjustmentType: a.adjustmentType,
          minutes: a.minutes,
          reasonId: a.reasonId,
          reasonLabel: a.reasonLabel,
          description: a.description,
        })),
      };
    });

    return { date, workers: rows };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  Single-day Excel export — same data as getDaySummary, laid out as a flat
  //  attendance sheet, so an admin can pull the report straight from the Day
  //  View right after correcting hours there, without switching to the
  //  monthly page.
  // ─────────────────────────────────────────────────────────────────────────────

  async generateDayXlsx(date: string, tenantId: string, lang = 'tr'): Promise<Buffer> {
    const { workers } = await this.getDaySummary(date, tenantId);
    return this.buildDayXlsx(date, workers, lang);
  }

  private async buildDayXlsx(
    date: string,
    workers: {
      workerId: string;
      name: string;
      profession: string;
      brigade: string;
      shift: string | null;
      checkIn: number | null;
      checkOut: number | null;
      actualMinutes: number;
      creditedMinutes: number;
      adjustmentMinutes: number;
      adjustments: { reasonLabel: string | null; adjustmentType: string }[];
    }[],
    lang = 'tr',
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');

    const I18N: Record<string, {
      locale: string; sheetName: string; title: string; workerCount: string;
      colNum: string; colRegNo: string; colName: string; colProfession: string; colBrigade: string;
      colShift: string; colCheckIn: string; colCheckOut: string; colActual: string; colCredited: string;
      colAdjustment: string; colNote: string; shiftDay: string; shiftNight: string; total: string;
    }> = {
      en: {
        locale: 'en-US', sheetName: 'Day View',
        title: 'Daily Attendance Report', workerCount: 'Workers',
        colNum: '#', colRegNo: 'Reg No', colName: 'Full Name', colProfession: 'Profession', colBrigade: 'Brigade',
        colShift: 'Shift', colCheckIn: 'Check-In', colCheckOut: 'Check-Out', colActual: 'Actual', colCredited: 'Credited',
        colAdjustment: 'Adjustment', colNote: 'Note', shiftDay: 'Day', shiftNight: 'Night', total: 'TOTAL',
      },
      ru: {
        locale: 'ru-RU', sheetName: 'По дням',
        title: 'Отчёт посещаемости за день', workerCount: 'Работников',
        colNum: '#', colRegNo: 'Таб. №', colName: 'Имя', colProfession: 'Профессия', colBrigade: 'Бригада',
        colShift: 'Смена', colCheckIn: 'Приход', colCheckOut: 'Уход', colActual: 'Факт', colCredited: 'Зачтено',
        colAdjustment: 'Корр.', colNote: 'Примечание', shiftDay: 'День', shiftNight: 'Ночь', total: 'ИТОГО',
      },
      tr: {
        locale: 'tr-TR', sheetName: 'Gün Görünümü',
        title: 'Günlük Devam Raporu', workerCount: 'Çalışan sayısı',
        colNum: '#', colRegNo: 'Sicil No', colName: 'Ad Soyad', colProfession: 'Meslek', colBrigade: 'Brigada',
        colShift: 'Vardiya', colCheckIn: 'Giriş', colCheckOut: 'Çıkış', colActual: 'Gerçek', colCredited: 'Onaylı',
        colAdjustment: 'Düzeltme', colNote: 'Not', shiftDay: 'Gündüz', shiftNight: 'Gece', total: 'TOPLAM',
      },
    };
    const L = I18N[lang] ?? I18N['tr'];

    const dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString(L.locale, {
      timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const headers = [
      L.colNum, L.colRegNo, L.colName, L.colProfession, L.colBrigade, L.colShift,
      L.colCheckIn, L.colCheckOut, L.colActual, L.colCredited, L.colAdjustment, L.colNote,
    ];
    const totalCols = headers.length;

    const solidFill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
    const thinBd    = (argb = 'FF94A3B8') => ({ style: 'thin' as const, color: { argb } });
    const hairBd    = (argb = 'FFE2E8F0') => ({ style: 'hair' as const, color: { argb } });
    const BG = {
      title: 'FF1E3A5F', subtitle: 'FF2D5E8E', hdr: 'FF334155',
      even: 'FFFAFAFA', odd: 'FFFFFFFF', total: 'FF0F2D4A', white: 'FFFFFFFF',
    };

    const fmtSignedMin = (mins: number): string => {
      if (!mins) return '';
      const sign = mins < 0 ? '-' : '+';
      return `${sign}${this.fmtHoursMs(Math.abs(mins) * 60000)}`;
    };

    const wb = new ExcelJS.Workbook();
    wb.created = new Date();
    const ws = wb.addWorksheet(L.sheetName, {
      views:     [{ state: 'frozen', ySplit: 3 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    ws.columns = [
      { width: 4 }, { width: 11 }, { width: 24 }, { width: 16 }, { width: 14 }, { width: 10 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 28 },
    ];

    const titleRow = ws.addRow([`${L.title} — ${dateLabel}`]);
    ws.mergeCells(1, 1, 1, totalCols);
    Object.assign(titleRow.getCell(1), {
      fill:      solidFill(BG.title),
      font:      { bold: true, size: 13, color: { argb: BG.white } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    titleRow.height = 28;

    const subRow = ws.addRow([`${L.workerCount}: ${workers.length}`]);
    ws.mergeCells(2, 1, 2, totalCols);
    Object.assign(subRow.getCell(1), {
      fill:      solidFill(BG.subtitle),
      font:      { size: 10, color: { argb: 'FFBFDBFE' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    subRow.height = 18;

    const hdrRow = ws.addRow(headers);
    hdrRow.height = 20;
    hdrRow.eachCell((c: any) => {
      c.fill      = solidFill(BG.hdr);
      c.font      = { bold: true, size: 10, color: { argb: BG.white } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border    = { top: thinBd(), left: thinBd(), right: thinBd(), bottom: thinBd() };
    });

    let sumActual = 0;
    let sumCredited = 0;

    workers.forEach((w, idx) => {
      sumActual   += w.actualMinutes;
      sumCredited += w.creditedMinutes;
      const shiftLabel = w.shift === 'day' ? L.shiftDay : w.shift === 'night' ? L.shiftNight : '—';
      const note = w.adjustments.map(a => a.reasonLabel || a.adjustmentType).join(', ');

      const row = ws.addRow([
        idx + 1,
        w.workerId,
        w.name,
        w.profession || '—',
        w.brigade || '—',
        shiftLabel,
        this.fmtTimeMs(w.checkIn),
        this.fmtTimeMs(w.checkOut),
        w.actualMinutes   > 0 ? this.fmtHoursMs(w.actualMinutes * 60000)   : '',
        w.creditedMinutes > 0 ? this.fmtHoursMs(w.creditedMinutes * 60000) : '',
        fmtSignedMin(w.adjustmentMinutes),
        note,
      ]);
      row.height = 16;
      const bg = idx % 2 === 0 ? BG.even : BG.odd;
      row.eachCell((cell: any, col: number) => {
        cell.fill      = solidFill(bg);
        cell.font      = { size: 9 };
        cell.alignment = { horizontal: (col === 3 || col === 12) ? 'left' : 'center', vertical: 'middle' };
        cell.border    = { bottom: hairBd() };
      });
    });

    const footRow = ws.addRow([
      '', '', L.total, '', '', '', '', '',
      sumActual   > 0 ? this.fmtHoursMs(sumActual * 60000)   : '',
      sumCredited > 0 ? this.fmtHoursMs(sumCredited * 60000) : '',
      '', '',
    ]);
    footRow.height = 20;
    footRow.eachCell((c: any) => {
      c.fill      = solidFill(BG.total);
      c.font      = { bold: true, size: 10, color: { argb: BG.white } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }
}
