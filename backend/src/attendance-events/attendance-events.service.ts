import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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

  getLateArrivals(foremanWorkerEntityId?: string, staffFilter?: 'staff' | 'workers') {
    return this.lateArrivalsService.getLateArrivals(foremanWorkerEntityId, staffFilter);
  }

  exportLateArrivalsExcel(foremanWorkerEntityId?: string, staffFilter?: 'staff' | 'workers') {
    return this.lateArrivalsService.exportLateArrivalsExcel(foremanWorkerEntityId, staffFilter);
  }

  getMissingCheckouts(foremanWorkerEntityId?: string) {
    return this.missingCheckoutsService.getMissingCheckouts(foremanWorkerEntityId);
  }

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
      qb.where(`DATE(to_timestamp(ae.eventTime / 1000.0) AT TIME ZONE '${APP_TZ}') = :date`, { date });
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
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $1
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

}
