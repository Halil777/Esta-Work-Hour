import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceEvent } from './attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { APP_TZ, todayLocal } from '../common/date-utils';

@Injectable()
export class MissingCheckoutsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  async getMissingCheckouts(foremanWorkerEntityId?: string) {
    const today = todayLocal();
    const cutoffMs = Date.now() - 14 * 60 * 60 * 1000;

    const lastEvents: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT DISTINCT ON ("employeeNumber") "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $1
         ORDER BY "employeeNumber", "eventTime" DESC`,
        [today],
      );

    const stuck = lastEvents.filter(
      ev => ev.eventType === 'CHECK_IN' && Number(ev.eventTime) < cutoffMs,
    );
    if (stuck.length === 0) return [];

    const employeeNumbers = stuck.map(e => e.employeeNumber);

    let workerQb = this.workerRepo.createQueryBuilder('w')
      .where('w."workerId" = ANY(:nums)', { nums: employeeNumbers });
    if (foremanWorkerEntityId) {
      workerQb = workerQb.andWhere('w."foremanId" = :fid', { fid: foremanWorkerEntityId });
    }
    const workers = await workerQb.getMany();
    if (workers.length === 0) return [];

    const workerEntityIds = workers.map(w => w.id);
    const hasRequestRows: { workerEntityId: string }[] = await this.eventRepo.query(
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
