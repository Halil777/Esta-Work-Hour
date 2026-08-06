import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as XLSX from 'xlsx';
import { AttendanceEvent, EventType } from './attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { SyncEventsDto } from './dto/sync-events.dto';
import { APP_TZ } from '../common/date-utils';
import { LateArrivalsService } from './late-arrivals.service';
import { MissingCheckoutsService } from './missing-checkouts.service';

@Injectable()
export class AttendanceEventsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly repo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    private readonly lateArrivalsService: LateArrivalsService,
    private readonly missingCheckoutsService: MissingCheckoutsService,
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

  async syncEvents(dto: SyncEventsDto, tenantId?: string) {
    const results: { localId: number; serverId: string | null; status: string }[] = [];
    const warnings: { employeeNumber: string; workerName: string; type: string; lastEventTime: number }[] = [];
    let synced = 0;
    let failed = 0;

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

        const event = this.repo.create({
          workerServerId: item.workerServerId ?? undefined,
          employeeNumber,
          cardUid: item.cardUid,
          eventType,
          eventTime: item.eventTime,
          source: item.source,
          mobileLocalId: item.localId,
          tenantId: tenantId ?? null,
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
