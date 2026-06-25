import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as XLSX from 'xlsx';
import { AttendanceEvent, EventType } from './attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { SyncEventsDto } from './dto/sync-events.dto';

// Ashgabat is UTC+5
function todayAshgabat(): string {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const TZ = 'Asia/Ashgabat';

@Injectable()
export class AttendanceEventsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly repo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  async syncEvents(dto: SyncEventsDto) {
    const results: { localId: number; serverId: string | null; status: string }[] = [];
    let synced = 0;
    let failed = 0;

    for (const item of dto.events) {
      try {
        const eventType = item.eventType === 'CHECK_IN' ? EventType.CHECK_IN : EventType.CHECK_OUT;

        // Resolve employeeNumber: if empty, try cardUid → worker mapping
        let employeeNumber = item.employeeNumber ?? '';
        if (!employeeNumber && item.cardUid) {
          const byCard = await this.workerRepo.findOne({ where: { nfcCardUid: item.cardUid } });
          if (byCard) employeeNumber = byCard.workerId;
        }

        const event = this.repo.create({
          workerServerId: item.workerServerId ?? undefined,
          employeeNumber,
          cardUid: item.cardUid,
          eventType,
          eventTime: item.eventTime,
          source: item.source,
          mobileLocalId: item.localId,
        });
        const saved = await this.repo.save(event) as AttendanceEvent;
        results.push({ localId: item.localId, serverId: saved.id, status: 'SYNCED' });
        synced++;
      } catch {
        results.push({ localId: item.localId, serverId: null, status: 'FAILED' });
        failed++;
      }
    }

    return { synced, failed, results };
  }

  async findAll(date?: string, limit = 500) {
    const qb = this.repo.createQueryBuilder('ae')
      .orderBy('ae.eventTime', 'DESC')
      .take(limit);

    if (date) {
      qb.where(`DATE(to_timestamp(ae.eventTime / 1000.0) AT TIME ZONE '${TZ}') = :date`, { date });
    }

    const events = await qb.getMany();
    const employeeNumbers = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];

    const workers = employeeNumbers.length > 0
      ? await this.workerRepo.find({ where: { workerId: In(employeeNumbers) } })
      : [];
    const workerMap = new Map(workers.map(w => [w.workerId, w.name]));

    return events.map(e => ({
      ...e,
      workerName: workerMap.get(e.employeeNumber) || e.employeeNumber || 'Unknown',
    }));
  }

  async getDailySummary(date?: string) {
    const now = new Date();
    const targetDate = date || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.repo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${TZ}') = $1
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [targetDate],
      );

    const employeeNumbers = [...new Set(events.map(e => e.employeeNumber).filter(Boolean))];
    const workers = employeeNumbers.length > 0
      ? await this.workerRepo.find({ where: { workerId: In(employeeNumbers) } })
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
      dateFilter += ` AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${TZ}') >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${TZ}') <= $${params.length}`;
    }

    const events: { eventType: string; eventTime: string; date: string }[] =
      await this.repo.query(
        `SELECT "eventType", "eventTime",
                DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${TZ}')::text as date
         FROM attendance_events
         WHERE "employeeNumber" = $1${dateFilter}
         ORDER BY "eventTime" ASC`,
        params,
      );

    const byDate = new Map<string, { eventType: string; eventTime: number }[]>();
    for (const ev of events) {
      const d = ev.date as string;
      const arr = byDate.get(d) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      byDate.set(d, arr);
    }

    let totalMs = 0;
    const days: {
      date: string;
      totalMs: number;
      checkIn: number | null;
      checkOut: number | null;
      sessions: { checkIn: number; checkOut: number | null }[];
    }[] = [];

    for (const [date, evList] of byDate) {
      const sessions: { checkIn: number; checkOut: number | null }[] = [];
      let dayTotalMs = 0;
      let clockIn: number | null = null;
      let firstIn: number | null = null;
      let lastOut: number | null = null;

      for (const ev of evList) {
        if (ev.eventType === 'CHECK_IN') {
          if (clockIn === null) clockIn = ev.eventTime;
          if (firstIn === null) firstIn = ev.eventTime;
        } else {
          if (clockIn !== null) {
            sessions.push({ checkIn: clockIn, checkOut: ev.eventTime });
            dayTotalMs += ev.eventTime - clockIn;
            clockIn = null;
          }
          lastOut = ev.eventTime;
        }
      }
      if (clockIn !== null) {
        sessions.push({ checkIn: clockIn, checkOut: null });
      }

      totalMs += dayTotalMs;
      days.push({ date, totalMs: dayTotalMs, checkIn: firstIn, checkOut: lastOut, sessions });
    }

    days.sort((a, b) => (a.date as string).localeCompare(b.date as string));

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
      days,
      totalMs,
    };
  }

  /**
   * Returns workers who should be at work but haven't checked in yet.
   * Uses shift_settings table for deadlines. Optionally filter by foreman.
   * isStaff filter: 'staff' | 'workers' | undefined (all)
   */
  async getLateArrivals(foremanWorkerEntityId?: string, staffFilter?: 'staff' | 'workers') {
    const today = todayAshgabat();
    const ashgabatNow = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const currentMinutes = ashgabatNow.getUTCHours() * 60 + ashgabatNow.getUTCMinutes();

    // Get shift settings directly via raw SQL
    const shiftSettings: { shiftType: string; startTime: string; graceMinutes: number }[] =
      await this.repo.query(`SELECT "shiftType", "startTime", "graceMinutes" FROM shift_settings`).catch(() => []);

    const settingsMap = new Map(shiftSettings.map(s => [s.shiftType, s]));
    const daySettings   = settingsMap.get('day')   ?? { startTime: '07:00', graceMinutes: 60 };
    const nightSettings = settingsMap.get('night') ?? { startTime: '18:00', graceMinutes: 60 };

    function parseMinutes(t: string): number {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }

    const dayDeadline   = parseMinutes(daySettings.startTime)   + Number(daySettings.graceMinutes);
    const nightDeadline = parseMinutes(nightSettings.startTime) + Number(nightSettings.graceMinutes);

    // Which shifts are past deadline?
    const lateShifts: string[] = [];
    if (currentMinutes >= dayDeadline)   lateShifts.push('day');
    if (currentMinutes >= nightDeadline) lateShifts.push('night');

    if (lateShifts.length === 0) return { workers: [], daySettings, nightSettings };

    // Workers who already checked in today
    const checkedIn: { employeeNumber: string }[] = await this.repo.query(
      `SELECT DISTINCT "employeeNumber"
       FROM attendance_events
       WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${TZ}') = $1
         AND "eventType" = 'CHECK_IN'`,
      [today],
    );
    const checkedInSet = new Set(checkedIn.map(r => r.employeeNumber));

    // Find workers in late shifts not yet checked in
    let qb = this.workerRepo.createQueryBuilder('w')
      .where('w.shift IN (:...shifts)', { shifts: lateShifts })
      .andWhere('w.status != :terminated', { terminated: 'Terminated' });

    if (foremanWorkerEntityId) {
      qb = qb.andWhere('w.foremanId = :fid', { fid: foremanWorkerEntityId });
    }
    if (staffFilter === 'staff') {
      qb = qb.andWhere('w.isStaff = true');
    } else if (staffFilter === 'workers') {
      qb = qb.andWhere('w.isStaff = false');
    }

    const allWorkers = await qb.getMany();
    const lateWorkers = allWorkers.filter(w => !checkedInSet.has(w.workerId));

    // Fetch absence notes for today's late workers
    const lateIds = lateWorkers.map(w => w.id);
    const absenceNotes: { workerEntityId: string; note: string; createdByName: string; createdBy: string }[] =
      lateIds.length > 0
        ? await this.repo.query(
            `SELECT "workerEntityId", note, "createdByName", "createdBy"
             FROM absence_notes
             WHERE "workerEntityId" = ANY($1) AND date = $2`,
            [lateIds, today],
          ).catch(() => [])
        : [];
    const noteMap = new Map(absenceNotes.map(n => [n.workerEntityId, n]));

    return {
      workers: lateWorkers.map(w => ({
        workerEntityId: w.id,
        workerName:     w.name,
        workerId:       w.workerId,
        profession:     w.profession,
        brigadeName:    w.brigadeName,
        shift:          w.shift,
        isStaff:        w.isStaff,
        foremanId:      w.foremanId,
        absenceNote:    noteMap.get(w.id) ?? null,
      })),
      daySettings,
      nightSettings,
      date: today,
    };
  }

  async exportLateArrivalsExcel(foremanWorkerEntityId?: string, staffFilter?: 'staff' | 'workers'): Promise<Buffer> {
    const result = await this.getLateArrivals(foremanWorkerEntityId, staffFilter);
    const rows = result.workers.map(w => ({
      'İşçi adı':      w.workerName,
      'Sicil No':       w.workerId,
      'Görev':          w.profession,
      'Ekip':           w.brigadeName,
      'Shift':          w.shift === 'day' ? 'Gündiz' : w.shift === 'night' ? 'Gije' : '—',
      'Staff':          w.isStaff ? 'Hawa' : 'Ýok',
      'Sebäp':          w.absenceNote?.note ?? '—',
      'Bellik edilen':  w.absenceNote?.createdByName ?? '—',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gelmedi');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  /**
   * Returns workers who checked in today but never checked out,
   * AND their last check-in was more than 14 hours ago,
   * AND no pending/seen/approved extra-hours request exists for them today.
   * If foremanWorkerEntityId is provided, only that foreman's workers are returned.
   */
  async getMissingCheckouts(foremanWorkerEntityId?: string) {
    const today = todayAshgabat();
    const cutoffMs = Date.now() - 14 * 60 * 60 * 1000;

    // Last event per worker today (DISTINCT ON keeps the latest row)
    const lastEvents: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.repo.query(
        `SELECT DISTINCT ON ("employeeNumber") "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${TZ}') = $1
         ORDER BY "employeeNumber", "eventTime" DESC`,
        [today],
      );

    // Keep only those whose last event is CHECK_IN and > 14h ago
    const stuck = lastEvents.filter(
      ev => ev.eventType === 'CHECK_IN' && Number(ev.eventTime) < cutoffMs,
    );
    if (stuck.length === 0) return [];

    const employeeNumbers = stuck.map(e => e.employeeNumber);

    // Look up workers; optionally filter by foreman
    let workerQb = this.workerRepo.createQueryBuilder('w')
      .where('w."workerId" = ANY(:nums)', { nums: employeeNumbers });
    if (foremanWorkerEntityId) {
      workerQb = workerQb.andWhere('w."foremanId" = :fid', { fid: foremanWorkerEntityId });
    }
    const workers = await workerQb.getMany();
    if (workers.length === 0) return [];

    // Check for existing open extra-hours requests for these workers today
    const workerEntityIds = workers.map(w => w.id);
    const hasRequestRows: { workerEntityId: string }[] = await this.repo.query(
      `SELECT DISTINCT i."workerEntityId"
       FROM extra_hours_request_items i
       INNER JOIN extra_hours_requests r ON r.id = i."requestId"
       WHERE i."workerEntityId" = ANY($1)
         AND r."workDate" = $2
         AND r.status IN ('pending', 'seen', 'approved')`,
      [workerEntityIds, today],
    );
    const hasRequestSet = new Set(hasRequestRows.map(r => r.workerEntityId));

    const stuckMap = new Map(stuck.map(e => [e.employeeNumber, Number(e.eventTime)]));

    return workers
      .filter(w => !hasRequestSet.has(w.id))
      .map(w => ({
        workerEntityId: w.id,
        workerName: w.name,
        workerId: w.workerId,
        profession: w.profession,
        brigadeName: w.brigadeName,
        checkInTime: stuckMap.get(w.workerId) ?? 0,
        hoursAgo: Math.floor((Date.now() - (stuckMap.get(w.workerId) ?? 0)) / 3600000),
        foremanWorkerEntityId: w.foremanId,
      }));
  }
}
