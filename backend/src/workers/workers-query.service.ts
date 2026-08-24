import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { Worker, WorkerStatus } from './worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { APP_TZ, todayLocal, yesterdayLocal } from '../common/date-utils';
import { computeWorkStats, WorkStats } from './utils/work-stats.util';

export type WorkerWithTodayStats = Worker & {
  lastCheckIn: number | null;
  lastCheckOut: number | null;
  todayHoursMs: number | null;
};

export type FindAllParams = {
  search?: string;
  brigadeId?: string;
  status?: string;
  foremanId?: string;
  mobileRole?: string;
  mesaiSistemi?: string;
  startDate?: string;
  endDate?: string;
  noScan?: boolean;
  hasScan?: boolean;
  tenantId?: string;
};

/**
 * Read-side of the workers module: listing/searching workers (with today's
 * attendance stats attached), fetching one worker, and listing terminated
 * workers. No writes happen here.
 */
@Injectable()
export class WorkersQueryService {
  constructor(
    @InjectRepository(Worker)
    private readonly repo: Repository<Worker>,
    @InjectRepository(AttendanceEvent)
    private readonly attendanceRepo: Repository<AttendanceEvent>,
  ) {}

  async findAll(params: FindAllParams = {}): Promise<WorkerWithTodayStats[]> {
    const { search, brigadeId, status, foremanId, mobileRole, mesaiSistemi, startDate, endDate, noScan, hasScan, tenantId } = params;
    const where: any[] = [];
    const statusFilter = status && status !== 'all' ? (status as WorkerStatus) : undefined;
    const brigadeFilter = brigadeId && brigadeId !== 'all' ? brigadeId : undefined;
    const foremanFilter = foremanId && foremanId !== 'all' ? foremanId : undefined;
    const mobileRoleFilter = mobileRole && mobileRole !== 'all' ? mobileRole : undefined;

    const mesaiFilter = mesaiSistemi && mesaiSistemi !== 'all' ? mesaiSistemi : undefined;

    const baseCondition: any = {
      // By default exclude Terminated; only show if explicitly filtered
      ...(statusFilter ? { status: statusFilter } : { status: Not(WorkerStatus.Terminated) }),
      ...(brigadeFilter ? { brigadeId: brigadeFilter } : {}),
      ...(foremanFilter ? { foremanId: foremanFilter } : {}),
      ...(mobileRoleFilter ? { mobileRole: mobileRoleFilter } : {}),
      ...(mesaiFilter ? { mesaiSistemi: mesaiFilter } : {}),
      ...(tenantId ? { tenantId } : {}),
    };

    if (search) {
      for (const cond of [{ name: ILike(`%${search}%`) }, { workerId: ILike(`%${search}%`) }]) {
        where.push({ ...cond, ...baseCondition });
      }
    } else {
      where.push(baseCondition);
    }

    const workers = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    if (workers.length === 0) return [];

    const workerIds = workers.map(w => w.workerId).filter(Boolean);
    if (workerIds.length === 0) return workers as WorkerWithTodayStats[];

    let allRecentEvents: { employeeNumber: string; eventType: string; eventTime: string }[];

    if (startDate && endDate) {
      // Date range filter: get events within the given range
      allRecentEvents = await this.attendanceRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE "employeeNumber" = ANY($1)
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') >= $2
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') <= $3
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [workerIds, startDate, endDate],
      );
    } else {
      // Current work day: today if local hour >= 07:00, else yesterday
      const workDate = new Date().getHours() >= 7 ? todayLocal() : yesterdayLocal();
      allRecentEvents = await this.attendanceRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE "employeeNumber" = ANY($1)
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $2
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [workerIds, workDate],
      );
    }

    const eventsByWorker = new Map<string, { eventType: string; eventTime: number }[]>();
    for (const ev of allRecentEvents) {
      const arr = eventsByWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      eventsByWorker.set(ev.employeeNumber, arr);
    }

    const statsByWorker = new Map<string, WorkStats>();
    for (const [empNum, events] of eventsByWorker) {
      statsByWorker.set(empNum, computeWorkStats(events));
    }

    const result = workers.map(w => {
      const stats = statsByWorker.get(w.workerId);
      return {
        ...w,
        lastCheckIn: stats?.firstIn ?? null,
        lastCheckOut: stats?.lastOut ?? null,
        todayHoursMs: stats?.totalMs ?? null,
      };
    });

    // noScan filter: workers with no attendance events in the period
    if (noScan) {
      return result.filter(w => !eventsByWorker.has(w.workerId));
    }

    // hasScan filter: workers WITH attendance events in the period
    if (hasScan) {
      return result.filter(w => eventsByWorker.has(w.workerId));
    }

    return result;
  }

  async findOne(id: string): Promise<Worker> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid worker id');
    }
    const worker = await this.repo.findOneBy({ id });
    if (!worker) throw new NotFoundException(`Worker ${id} not found`);
    return worker;
  }

  async findTerminated(search?: string, tenantId?: string): Promise<Worker[]> {
    const tenantFilter = tenantId ? { tenantId } : {};
    const where: any[] = [];
    if (search) {
      where.push({ status: WorkerStatus.Terminated, name: ILike(`%${search}%`), ...tenantFilter });
      where.push({ status: WorkerStatus.Terminated, workerId: ILike(`%${search}%`), ...tenantFilter });
    } else {
      where.push({ status: WorkerStatus.Terminated, ...tenantFilter });
    }
    return this.repo.find({ where, order: { terminatedAt: 'DESC' } });
  }
}
