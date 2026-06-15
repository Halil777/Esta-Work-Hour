import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AttendanceEvent, EventType } from './attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { SyncEventsDto } from './dto/sync-events.dto';

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
}
