import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { AttendanceOverride } from '../attendance-overrides/attendance-override.entity';
import { WorkAdjustment, AdjustmentType, AdjustmentStatus } from '../work-adjustments/work-adjustment.entity';
import { APP_TZ } from '../common/date-utils';

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
 * Applies adjustments on top of actualMinutes (in creation order).
 * SET resets the running total; ADD/BONUS add to it; SUBTRACT reduces it; MINIMUM enforces a floor.
 */
function computeCredited(actualMinutes: number, adjustments: WorkAdjustment[]): number {
  if (!adjustments.length) return actualMinutes;
  let credited = actualMinutes;
  const sorted = [...adjustments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const adj of sorted) {
    switch (adj.adjustmentType) {
      case AdjustmentType.ADD:
      case AdjustmentType.BONUS:
        credited += adj.minutes;
        break;
      case AdjustmentType.SUBTRACT:
        credited = Math.max(0, credited - adj.minutes);
        break;
      case AdjustmentType.SET:
        credited = adj.minutes;
        break;
      case AdjustmentType.MINIMUM:
        credited = Math.max(credited, adj.minutes);
        break;
    }
  }
  return Math.max(0, credited);
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

    // Group: workerId -> workDate -> events[]
    type Ev = { eventType: string; eventTime: number };
    const byWorkerDate = new Map<string, Map<string, Ev[]>>();
    for (const ev of events) {
      const date = new Date(Number(ev.eventTime) + TZ_OFFSET_MS).toISOString().split('T')[0];
      if (!byWorkerDate.has(ev.employeeNumber)) byWorkerDate.set(ev.employeeNumber, new Map());
      const dm = byWorkerDate.get(ev.employeeNumber)!;
      if (!dm.has(date)) dm.set(date, []);
      dm.get(date)!.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
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

    for (const [workerId, dateMap] of byWorkerDate) {
      const entityId = workerIdToEntityId.get(workerId);
      if (!entityId) continue;
      if (!result.has(entityId)) result.set(entityId, new Map());
      const workerResult = result.get(entityId)!;

      for (const [date, evList] of dateMap) {
        const ov = overrideMap.get(`${entityId}:${date}`);
        let totalMs = 0;
        if (ov) {
          totalMs = ov.checkInMs && ov.checkOutMs ? Number(ov.checkOutMs) - Number(ov.checkInMs) : 0;
        } else {
          let clockIn: number | null = null;
          for (const ev of evList) {
            if (ev.eventType === 'CHECK_IN') {
              if (clockIn === null) clockIn = ev.eventTime;
            } else if (clockIn !== null) {
              totalMs += ev.eventTime - clockIn;
              clockIn = null;
            }
          }
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
}
