import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import * as XLSX from 'xlsx';
import { AttendanceEvent, EventType } from './attendance-event.entity';
import { Worker, WorkerStatus } from '../workers/worker.entity';
import { SyncEventsDto } from './dto/sync-events.dto';
import { APP_TZ } from '../common/date-utils';
import { LateArrivalsService } from './late-arrivals.service';
import { MissingCheckoutsService } from './missing-checkouts.service';
import { AttendanceOverridesService } from '../attendance-overrides/attendance-overrides.service';
import { buildDailyAttendance } from '../common/attendance-pairing.util';
import { computeCredited, groupAdjustmentsByWorkerDate } from '../common/credited-hours.util';
import { WorkAdjustment, AdjustmentStatus } from '../work-adjustments/work-adjustment.entity';
import { GeofenceService } from '../geofence/geofence.service';
import { haversineMeters } from '../common/geo.util';

@Injectable()
export class AttendanceEventsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly repo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    private readonly lateArrivalsService: LateArrivalsService,
    private readonly missingCheckoutsService: MissingCheckoutsService,
    private readonly attendanceOverridesService: AttendanceOverridesService,
    @InjectRepository(WorkAdjustment)
    private readonly adjRepo: Repository<WorkAdjustment>,
    private readonly geofenceService: GeofenceService,
  ) {}

  getLateArrivals(foremanWorkerEntityId?: string, staffFilter?: 'staff' | 'workers', tenantId?: string) {
    return this.lateArrivalsService.getLateArrivals(foremanWorkerEntityId, staffFilter, tenantId);
  }

  exportLateArrivalsExcel(foremanWorkerEntityId?: string, staffFilter?: 'staff' | 'workers', tenantId?: string) {
    return this.lateArrivalsService.exportLateArrivalsExcel(foremanWorkerEntityId, staffFilter, tenantId);
  }

  getMissingCheckouts(foremanWorkerEntityId?: string) {
    return this.missingCheckoutsService.getMissingCheckouts(foremanWorkerEntityId);
  }

  async syncEvents(dto: SyncEventsDto, tenantId?: string, deviceId?: string) {
    const results: { localId: number; serverId: string | null; status: string }[] = [];
    const warnings: { employeeNumber: string; workerName: string; type: string; lastEventTime: number }[] = [];
    let synced = 0;
    let failed = 0;

    // Resolved once per sync batch — constant for the whole call since it
    // only depends on tenantId/deviceId, not on individual events. An empty
    // array means no zones are configured (globally or for this device) and
    // every scan in this batch is unrestricted.
    const effectiveZones = await this.geofenceService.getEffectiveZones(tenantId ?? '', deviceId ?? null);

    for (const item of dto.events) {
      try {
        const eventType = item.eventType === 'CHECK_IN' ? EventType.CHECK_IN : EventType.CHECK_OUT;

        // Resolve employeeNumber: if empty, try cardUid → worker mapping (scoped to tenant)
        let employeeNumber = item.employeeNumber ?? '';
        let workerName = '';
        if (!employeeNumber && item.cardUid) {
          const byCard = await this.workerRepo.findOne({
            where: { nfcCardUid: item.cardUid, ...(tenantId ? { tenantId } : {}) },
          });
          if (byCard) { employeeNumber = byCard.workerId; workerName = byCard.name; }
        } else if (employeeNumber) {
          const w = await this.workerRepo.findOne({ where: { workerId: employeeNumber, ...(tenantId ? { tenantId } : {}) } });
          if (w) workerName = w.name;
        }

        // Geofence evaluation: null when no zones apply to this device/tenant
        // (unrestricted, nothing to evaluate) or when the scan carries no
        // location — never treated as "out of bounds" in either case, so a
        // missing GPS fix never blocks or falsely flags a scan.
        let outOfGeofence: boolean | null = null;
        if (effectiveZones.length > 0 && item.latitude != null && item.longitude != null) {
          outOfGeofence = !effectiveZones.some(
            (zone) => haversineMeters(item.latitude as number, item.longitude as number, zone.latitude, zone.longitude) <= zone.radiusMeters,
          );
        }

        const event = this.repo.create({
          workerServerId: item.workerServerId ?? undefined,
          employeeNumber,
          cardUid: item.cardUid,
          eventType,
          eventTime: item.eventTime,
          source: item.source,
          mobileLocalId: item.localId,
          tenantId: tenantId ?? null,
          deviceId: deviceId ?? null,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          outOfGeofence,
        });
        const saved = await this.repo.save(event) as AttendanceEvent;
        results.push({ localId: item.localId, serverId: saved.id, status: 'SYNCED' });
        synced++;

        // Cross-device double-scan detection: if CHECK_IN and worker already has open session today
        if (eventType === EventType.CHECK_IN && employeeNumber) {
          const todayStart = new Date(item.eventTime);
          todayStart.setHours(0, 0, 0, 0);
          const recentEvents: { eventType: string; eventTime: string }[] = await this.repo.query(
            `SELECT "eventType", "eventTime" FROM attendance_events
             WHERE "employeeNumber" = $1
               AND "id" != $2
               AND "eventTime" >= $3
               AND "eventTime" <= $4
             ORDER BY "eventTime" ASC`,
            [employeeNumber, saved.id, todayStart.getTime(), item.eventTime],
          );
          // Check if there is an open CHECK_IN (no subsequent CHECK_OUT)
          let openCheckIn: number | null = null;
          for (const ev of recentEvents) {
            if (ev.eventType === 'CHECK_IN') openCheckIn = Number(ev.eventTime);
            else openCheckIn = null;
          }
          if (openCheckIn !== null) {
            warnings.push({
              employeeNumber,
              workerName: workerName || employeeNumber,
              type: 'ALREADY_CHECKED_IN',
              lastEventTime: openCheckIn,
            });
          }
        }

        // Extra-scan detection: a CHECK_OUT with no open check-in — i.e. the
        // worker was already checked out earlier today with no new CHECK_IN
        // in between (typically overtime/mesai: scanned out at shift-end,
        // stayed on, now scanned out again for real). Informational only —
        // buildDailyAttendance() already folds this extra time into the
        // day's total; this just lets the operator know at scan time.
        if (eventType === EventType.CHECK_OUT && employeeNumber) {
          const todayStart = new Date(item.eventTime);
          todayStart.setHours(0, 0, 0, 0);
          const recentEvents: { eventType: string; eventTime: string }[] = await this.repo.query(
            `SELECT "eventType", "eventTime" FROM attendance_events
             WHERE "employeeNumber" = $1
               AND "id" != $2
               AND "eventTime" >= $3
               AND "eventTime" <= $4
             ORDER BY "eventTime" ASC`,
            [employeeNumber, saved.id, todayStart.getTime(), item.eventTime],
          );
          if (recentEvents.length > 0 && recentEvents[recentEvents.length - 1].eventType === 'CHECK_OUT') {
            warnings.push({
              employeeNumber,
              workerName: workerName || employeeNumber,
              type: 'ALREADY_CHECKED_OUT',
              lastEventTime: Number(recentEvents[recentEvents.length - 1].eventTime),
            });
          }
        }

        // Geofence warning: informational only, same as the duplicate-scan
        // warnings above — the scan above is already saved in full either
        // way, this just tells the operator they're outside every allowed
        // zone for this device/operator right now.
        if (outOfGeofence && employeeNumber) {
          warnings.push({
            employeeNumber,
            workerName: workerName || employeeNumber,
            type: 'OUTSIDE_GEOFENCE',
            lastEventTime: item.eventTime,
          });
        }
      } catch {
        results.push({ localId: item.localId, serverId: null, status: 'FAILED' });
        failed++;
      }
    }

    return { synced, failed, results, warnings };
  }

  async findAll(date?: string, limit = 500, tenantId?: string) {
    // If tenantId is set, get tenant's workerIds first to filter events
    let tenantWorkerIds: string[] | undefined;
    if (tenantId) {
      const tenantWorkers = await this.workerRepo.find({ where: { tenantId }, select: ['workerId'] });
      tenantWorkerIds = tenantWorkers.map(w => w.workerId);
      if (tenantWorkerIds.length === 0) return [];
    }

    const qb = this.repo.createQueryBuilder('ae')
      .orderBy('ae.eventTime', 'DESC')
      .take(limit);

    if (date) {
      qb.where(`DATE(to_timestamp(ae.eventTime / 1000.0) AT TIME ZONE '${APP_TZ}') = :date`, { date });
    }
    if (tenantWorkerIds) {
      const clause = `ae.employeeNumber = ANY(:ids)`;
      date
        ? qb.andWhere(clause, { ids: tenantWorkerIds })
        : qb.where(clause, { ids: tenantWorkerIds });
    }

    const events = await qb.getMany();
    const employeeNumbers = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];

    const workers = employeeNumbers.length > 0
      ? await this.workerRepo.find({ where: employeeNumbers.map(workerId => ({ workerId, ...(tenantId ? { tenantId } : {}) })) })
      : [];
    const workerMap = new Map(workers.map(w => [w.workerId, w.name]));

    return events.map(e => ({
      ...e,
      workerName: workerMap.get(e.employeeNumber) || e.employeeNumber || 'Unknown',
    }));
  }

  async getDailySummary(date?: string, tenantId?: string) {
    const now = new Date();
    const targetDate = date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.repo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $1
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [targetDate],
      );

    const employeeNumbers = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];
    const workers = employeeNumbers.length > 0
      ? await this.workerRepo.find({ where: employeeNumbers.map(workerId => ({ workerId, ...(tenantId ? { tenantId } : {}) })) })
      : [];
    const workerMap = new Map(workers.map(w => [w.workerId, w.name]));

    const byWorker = new Map<string, { eventType: string; eventTime: number }[]>();
    for (const ev of events) {
      const arr = byWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byWorker.set(ev.employeeNumber, arr);
    }

    const results: {
      employeeNumber: string;
      workerName: string;
      sessions: { checkIn: number; checkOut: number | null }[];
      totalMs: number;
    }[] = [];

    for (const [employeeNumber, evList] of byWorker) {
      const sessions: { checkIn: number; checkOut: number | null }[] = [];
      let totalMs = 0;
      let clockIn: number | null = null;

      for (const ev of evList) {
        if (ev.eventType === 'CHECK_IN') {
          if (clockIn === null) clockIn = ev.eventTime;
        } else {
          if (clockIn !== null) {
            sessions.push({ checkIn: clockIn, checkOut: ev.eventTime });
            totalMs += ev.eventTime - clockIn;
            clockIn = null;
          }
        }
      }
      if (clockIn !== null) {
        sessions.push({ checkIn: clockIn, checkOut: null });
      }

      results.push({
        employeeNumber,
        workerName: workerMap.get(employeeNumber) || employeeNumber,
        sessions,
        totalMs,
      });
    }

    return results.sort((a, b) => b.totalMs - a.totalMs);
  }

  async getWorkerAttendanceSummary(
    workerEntityId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const worker = await this.workerRepo.findOne({ where: { id: workerEntityId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const params: (string)[] = [worker.workerId];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') <= $${params.length}`;
    }

    const events: { eventType: string; eventTime: string; date: string }[] =
      await this.repo.query(
        `SELECT "eventType", "eventTime",
                DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}')::text as date
         FROM attendance_events
         WHERE "employeeNumber" = $1${dateFilter}
         ORDER BY "eventTime" ASC`,
        params,
      );

    // Pair check-in/check-out chronologically across the whole range (not
    // pre-bucketed by calendar date), so an overnight/night-shift session
    // that crosses midnight is attributed correctly instead of silently
    // coming out as 0 — see attendance-pairing.util.ts.
    const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
    const evList = events
      .map(ev => ({ eventType: ev.eventType, eventTime: Number(ev.eventTime) }))
      .sort((a, b) => a.eventTime - b.eventTime);
    const dailyMap = buildDailyAttendance(evList, (t) => new Date(t + TZ_OFFSET_MS).toISOString().split('T')[0]);

    let totalMs = 0;
    const days: {
      date: string;
      totalMs: number;
      checkIn: number | null;
      checkOut: number | null;
      sessions: { checkIn: number; checkOut: number | null }[];
      extraScan: boolean;
    }[] = [];

    for (const [date, day] of dailyMap) {
      totalMs += day.ms;
      days.push({
        date, totalMs: day.ms, checkIn: day.checkIn, checkOut: day.checkOut,
        sessions: day.checkIn !== null ? [{ checkIn: day.checkIn, checkOut: day.checkOut }] : [],
        extraScan: day.extraScan ?? false,
      });
    }

    days.sort((a, b) => (a.date as string).localeCompare(b.date as string));

    // Apply attendance overrides (admin-corrected check-in/check-out times)
    const overrides = await this.attendanceOverridesService.getForWorkerRange(workerEntityId, startDate, endDate);
    const overrideMap = new Map(overrides.map(o => [o.date, o]));

    let correctedTotalMs = 0;
    const correctedDays = days.map(day => {
      const ov = overrideMap.get(day.date);
      if (!ov) {
        correctedTotalMs += day.totalMs;
        return { ...day, overrideApplied: false };
      }
      const overrideMs = (ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0;
      correctedTotalMs += overrideMs;
      return {
        date: day.date,
        totalMs: overrideMs,
        checkIn: ov.checkInMs ?? null,
        checkOut: ov.checkOutMs ?? null,
        sessions: day.sessions,
        extraScan: day.extraScan,
        overrideApplied: true,
        overrideNote: ov.note,
      };
    });

    // Also add override-only days (overrides for dates with no scan events)
    for (const [date, ov] of overrideMap) {
      if (!correctedDays.find(d => d.date === date)) {
        const overrideMs = (ov.checkInMs && ov.checkOutMs) ? ov.checkOutMs - ov.checkInMs : 0;
        correctedTotalMs += overrideMs;
        correctedDays.push({
          date,
          totalMs: overrideMs,
          checkIn: ov.checkInMs ?? null,
          checkOut: ov.checkOutMs ?? null,
          sessions: [],
          extraScan: false,
          overrideApplied: true,
          overrideNote: ov.note,
        });
      }
    }
    correctedDays.sort((a, b) => a.date.localeCompare(b.date));

    // Apply admin-entered credited-hours adjustments (WorkAdjustment) on top
    // of the override-corrected values. This is the same computeCredited()
    // used by Work Time / the day-view admin screen / the range reports, so
    // a correction made anywhere shows up everywhere consistently. The
    // override-corrected value is kept as `actualMs` so the true underlying
    // number is never lost, only the "official" totalMs changes.
    const adjustments = await this.adjRepo.find({ where: { workerEntityId, status: AdjustmentStatus.ACTIVE } });
    const relevantAdjustments = adjustments.filter(a => (!startDate || a.workDate >= startDate) && (!endDate || a.workDate <= endDate));
    const adjByDate = groupAdjustmentsByWorkerDate(relevantAdjustments);

    let creditedTotalMs = 0;
    const finalDays = correctedDays.map(day => {
      const adjs = adjByDate.get(`${workerEntityId}:${day.date}`) ?? [];
      const creditedMs = adjs.length ? computeCredited(Math.floor(day.totalMs / 60000), adjs) * 60000 : day.totalMs;
      creditedTotalMs += creditedMs;
      return adjs.length
        ? { ...day, actualMs: day.totalMs, totalMs: creditedMs, adjustmentApplied: true }
        : { ...day, actualMs: day.totalMs, adjustmentApplied: false };
    });

    // Also add adjustment-only days (credited hours on a day with no scan/override at all)
    for (const [key, adjs] of adjByDate) {
      const date = key.split(':')[1];
      if (finalDays.find(d => d.date === date)) continue;
      const creditedMs = computeCredited(0, adjs) * 60000;
      creditedTotalMs += creditedMs;
      finalDays.push({
        date, totalMs: creditedMs, actualMs: 0, checkIn: null, checkOut: null,
        sessions: [], overrideApplied: false, adjustmentApplied: true,
      } as any);
    }
    finalDays.sort((a, b) => a.date.localeCompare(b.date));

    return {
      worker: {
        id: worker.id,
        workerId: worker.workerId,
        name: worker.name,
        profession: worker.profession,
        brigadeName: worker.brigadeName,
        status: worker.status,
        mesaiSistemi: worker.mesaiSistemi,
        shift: worker.shift,
        hireDate: worker.hireDate,
        phone: worker.phone,
        mobileRole: worker.mobileRole,
        extraSaat: worker.extraSaat,
        nfcCardUid: worker.nfcCardUid,
      },
      days: finalDays,
      totalMs: creditedTotalMs,
    };
  }

  /**
   * Total active workforce + how many of them have scanned in (CHECK_IN) today,
   * scoped to the tenant. Used by the NFC device app's home-screen stats row —
   * this is a plain tenant-wide server computation, so every device polling it
   * sees the same numbers regardless of which physical device a worker scanned
   * their card on (no per-device "scanned" state to keep in sync).
   */
  async getTodayStats(tenantId: string): Promise<{ totalActive: number; scannedToday: number }> {
    const totalActive = await this.workerRepo.count({
      where: { tenantId, status: Not(WorkerStatus.Terminated) as any },
    });

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const rows: { employeeNumber: string }[] = await this.repo.query(
      `SELECT DISTINCT ae."employeeNumber"
       FROM attendance_events ae
       INNER JOIN workers w ON w."workerId" = ae."employeeNumber" AND w."tenantId" = $2
       WHERE DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $1
         AND ae."eventType" = 'CHECK_IN'
         AND ae."employeeNumber" IS NOT NULL AND ae."employeeNumber" != ''`,
      [todayStr, tenantId],
    );

    return { totalActive, scannedToday: rows.length };
  }

  /**
   * Per-device (= per-operator, since each scanner device is assigned to one
   * operator worker) scan counts for the Scanner Devices admin page: how
   * many distinct workers — and raw scan events — each device has recorded,
   * all-time and today. Only events synced after the deviceId column was
   * added carry a deviceId, so older history isn't attributed to any device
   * (deliberately excluded here, not misattributed to one).
   */
  async getDeviceScanStats(tenantId: string): Promise<{
    deviceId: string;
    totalWorkers: number;
    todayWorkers: number;
    totalScans: number;
    todayScans: number;
  }[]> {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const rows: {
      deviceId: string;
      total_scans: string;
      total_workers: string;
      today_scans: string;
      today_workers: string;
    }[] = await this.repo.query(
      `SELECT
         ae."deviceId" as "deviceId",
         COUNT(*) as total_scans,
         COUNT(DISTINCT ae."employeeNumber") as total_workers,
         COUNT(*) FILTER (
           WHERE DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $2
         ) as today_scans,
         COUNT(DISTINCT ae."employeeNumber") FILTER (
           WHERE DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $2
         ) as today_workers
       FROM attendance_events ae
       WHERE ae."tenantId" = $1 AND ae."deviceId" IS NOT NULL
       GROUP BY ae."deviceId"`,
      [tenantId, todayStr],
    );

    return rows.map(r => ({
      deviceId: r.deviceId,
      totalScans: Number(r.total_scans),
      totalWorkers: Number(r.total_workers),
      todayScans: Number(r.today_scans),
      todayWorkers: Number(r.today_workers),
    }));
  }

  /**
   * Tenant-wide scan summary (deduped across every device) for the small
   * dashboard strip at the top of the Scanner Devices page — distinct from
   * getDeviceScanStats, which breaks the same underlying data down per device.
   */
  async getTenantScanSummary(tenantId: string): Promise<{
    totalWorkersEverScanned: number;
    todayWorkersScanned: number;
  }> {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const rows: { total_workers: string; today_workers: string }[] = await this.repo.query(
      `SELECT
         COUNT(DISTINCT ae."employeeNumber") as total_workers,
         COUNT(DISTINCT ae."employeeNumber") FILTER (
           WHERE DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $2
         ) as today_workers
       FROM attendance_events ae
       WHERE ae."tenantId" = $1`,
      [tenantId, todayStr],
    );

    return {
      totalWorkersEverScanned: Number(rows[0]?.total_workers ?? 0),
      todayWorkersScanned: Number(rows[0]?.today_workers ?? 0),
    };
  }

  /**
   * Per-operator (= per-device), per-day, per-worker scan log for the
   * Scanner Devices page's "Operator Journaly" tab — lets an admin see which
   * operator scanned which workers on which days, e.g. to spot an operator
   * who isn't scanning their whole crew, or to audit a disputed day.
   * Grouped (not one row per raw scan) since a worker can be scanned many
   * times a day; scanCount/firstScan/lastScan summarize that per worker-day.
   */
  async getOperatorScanLog(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    deviceId: string;
    date: string;
    workerId: string;
    scanCount: number;
    firstScan: number;
    lastScan: number;
  }[]> {
    const rows: {
      deviceId: string;
      date: string;
      workerId: string;
      scan_count: string;
      first_scan: string;
      last_scan: string;
    }[] = await this.repo.query(
      `SELECT
         ae."deviceId" as "deviceId",
         DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') as "date",
         ae."employeeNumber" as "workerId",
         COUNT(*) as scan_count,
         MIN(ae."eventTime") as first_scan,
         MAX(ae."eventTime") as last_scan
       FROM attendance_events ae
       WHERE ae."tenantId" = $1
         AND ae."deviceId" IS NOT NULL
         AND DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') BETWEEN $2 AND $3
       GROUP BY ae."deviceId", DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}'), ae."employeeNumber"
       ORDER BY "date" DESC, ae."deviceId" ASC`,
      [tenantId, startDate, endDate],
    );

    return rows.map(r => ({
      deviceId: r.deviceId,
      date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
      workerId: r.workerId,
      scanCount: Number(r.scan_count),
      firstScan: Number(r.first_scan),
      lastScan: Number(r.last_scan),
    }));
  }

  /**
   * Raw per-scan GPS points (only scans that have a location captured), for
   * the tenant-admin operator scan-locations map. Each row is one scan, not
   * pre-aggregated — the frontend clusters nearby points and, on a pin
   * click, lists exactly which workers were scanned there.
   */
  async getScanLocations(
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<{
    deviceId: string;
    employeeNumber: string;
    workerName: string;
    eventType: string;
    eventTime: number;
    latitude: number;
    longitude: number;
    outOfGeofence: boolean | null;
  }[]> {
    const params: string[] = [tenantId];
    let dateFilter = '';
    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND DATE(to_timestamp(ae."eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') <= $${params.length}`;
    }

    const rows: {
      deviceId: string;
      employeeNumber: string;
      eventType: string;
      eventTime: string;
      latitude: string;
      longitude: string;
      outOfGeofence: boolean | null;
    }[] = await this.repo.query(
      `SELECT ae."deviceId" as "deviceId", ae."employeeNumber" as "employeeNumber",
              ae."eventType" as "eventType", ae."eventTime" as "eventTime",
              ae."latitude" as "latitude", ae."longitude" as "longitude",
              ae."outOfGeofence" as "outOfGeofence"
       FROM attendance_events ae
       WHERE ae."tenantId" = $1
         AND ae."deviceId" IS NOT NULL
         AND ae."latitude" IS NOT NULL
         AND ae."longitude" IS NOT NULL
         ${dateFilter}
       ORDER BY ae."eventTime" DESC
       LIMIT 5000`,
      params,
    );

    const employeeNumbers = [...new Set(rows.map(r => r.employeeNumber).filter(Boolean))];
    const workers = employeeNumbers.length > 0
      ? await this.workerRepo.find({ where: employeeNumbers.map(workerId => ({ workerId, tenantId })) })
      : [];
    const workerMap = new Map(workers.map(w => [w.workerId, w.name]));

    return rows.map(r => ({
      deviceId: r.deviceId,
      employeeNumber: r.employeeNumber,
      workerName: workerMap.get(r.employeeNumber) || r.employeeNumber || 'Unknown',
      eventType: r.eventType,
      eventTime: Number(r.eventTime),
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      outOfGeofence: r.outOfGeofence,
    }));
  }

  async exportEventsExcel(date?: string, tenantId?: string): Promise<Buffer> {
    const events = await this.findAll(date, 5000, tenantId) as any[];

    const fmtTime = (ts: number) => {
      if (!ts) return '';
      return new Date(Number(ts)).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: APP_TZ,
      });
    };

    const rows = events.map((ev, i) => ({
      '#': i + 1,
      'Işçi Ady': ev.workerName || '?',
      'Sicil No': ev.employeeNumber || '',
      'Kart UID': ev.cardUid || '',
      'Hadysa': ev.eventType === 'CHECK_IN' ? 'Giriş' : 'Çykyş',
      'Wagt': fmtTime(ev.eventTime),
      'Çeşme': ev.source || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scans');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

}
