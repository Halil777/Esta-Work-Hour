import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { randomUUID } from 'crypto';
import { WorkAdjustment, AdjustmentType, AdjustmentStatus } from './work-adjustment.entity';
import { WorkAdjustmentLog, AdjLogAction } from './work-adjustment-log.entity';
import { AdjustmentReason } from '../adjustment-reasons/adjustment-reason.entity';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { buildDailyAttendance } from '../common/attendance-pairing.util';
import { computeCredited } from '../common/credited-hours.util';

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

export type AdjustmentAnalyticsDay = {
  date: string;
  actualMs: number;
  creditedMs: number;
  diffMs: number;
  adjustments: {
    id: string;
    adjustmentType: AdjustmentType;
    minutes: number;
    reasonLabel: string | null;
    description: string | null;
    createdBy: string;
    createdAt: Date;
  }[];
};

export type AdjustmentAnalyticsWorker = {
  workerEntityId: string;
  workerId: string;
  name: string;
  profession: string;
  brigade: string;
  adjustmentCount: number;
  totalIncreaseMs: number;
  totalDecreaseMs: number;
  netDiffMs: number;
  days: AdjustmentAnalyticsDay[];
};

export type AdjustmentAnalytics = {
  startDate: string | null;
  endDate: string | null;
  summary: {
    totalAdjustments: number;
    workersAffected: number;
    totalIncreaseMs: number;
    totalDecreaseMs: number;
    netDiffMs: number;
  };
  workers: AdjustmentAnalyticsWorker[];
};

export interface CreateAdjustmentDto {
  workerEntityId: string;
  workDate: string;          // YYYY-MM-DD
  adjustmentType: AdjustmentType;
  minutes: number;           // always positive
  reasonId?: string;
  description?: string;
}

export interface CreateBulkAdjustmentDto {
  workerEntityIds: string[];
  workDate: string;
  adjustmentType: AdjustmentType;
  minutes: number;
  reasonId?: string;
  description?: string;
}

export interface UpdateAdjustmentDto {
  adjustmentType?: AdjustmentType;
  minutes?: number;
  reasonId?: string | null;
  description?: string | null;
  changeReason?: string;
}

function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

@Injectable()
export class WorkAdjustmentsService {
  constructor(
    @InjectRepository(WorkAdjustment)
    private readonly adjRepo: Repository<WorkAdjustment>,
    @InjectRepository(WorkAdjustmentLog)
    private readonly logRepo: Repository<WorkAdjustmentLog>,
    @InjectRepository(AdjustmentReason)
    private readonly reasonRepo: Repository<AdjustmentReason>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async resolveLabel(reasonId: string | undefined | null, tenantId: string): Promise<string | null> {
    if (!reasonId) return null;
    return (await this.reasonRepo.findOneBy({ id: reasonId, tenantId }))?.name ?? null;
  }

  private async writeLog(
    adj: WorkAdjustment,
    action: AdjLogAction,
    oldValue: any,
    newValue: any,
    changedBy: string,
    changeReason: string | null,
  ): Promise<void> {
    await this.logRepo.save(
      this.logRepo.create({
        adjustmentId: adj.id,
        tenantId: adj.tenantId,
        workerEntityId: adj.workerEntityId,
        workDate: adj.workDate,
        action,
        oldValue,
        newValue,
        changedBy,
        changeReason,
      }),
    );
  }

  // ── Single create ────────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateAdjustmentDto, createdBy: string): Promise<WorkAdjustment> {
    const reasonLabel = await this.resolveLabel(dto.reasonId, tenantId);
    const adj = await this.adjRepo.save(
      this.adjRepo.create({
        tenantId,
        workerEntityId: dto.workerEntityId,
        workDate: dto.workDate,
        adjustmentType: dto.adjustmentType,
        minutes: dto.minutes,
        reasonId: dto.reasonId ?? null,
        reasonLabel,
        description: dto.description ?? null,
        sourceType: 'MANUAL',
        bulkId: null,
        status: AdjustmentStatus.ACTIVE,
        createdBy,
      }),
    );
    await this.writeLog(
      adj, AdjLogAction.CREATED, null,
      { adjustmentType: adj.adjustmentType, minutes: adj.minutes, reasonLabel, description: adj.description },
      createdBy, null,
    );
    return adj;
  }

  // ── Bulk create ──────────────────────────────────────────────────────────────

  async createBulk(tenantId: string, dto: CreateBulkAdjustmentDto, createdBy: string): Promise<WorkAdjustment[]> {
    const bulkId = randomUUID();
    const reasonLabel = await this.resolveLabel(dto.reasonId, tenantId);

    const entities = dto.workerEntityIds.map(workerEntityId =>
      this.adjRepo.create({
        tenantId,
        workerEntityId,
        workDate: dto.workDate,
        adjustmentType: dto.adjustmentType,
        minutes: dto.minutes,
        reasonId: dto.reasonId ?? null,
        reasonLabel,
        description: dto.description ?? null,
        sourceType: 'BULK',
        bulkId,
        status: AdjustmentStatus.ACTIVE,
        createdBy,
      }),
    );

    const saved = await this.adjRepo.save(entities);

    const logs = saved.map(adj =>
      this.logRepo.create({
        adjustmentId: adj.id,
        tenantId: adj.tenantId,
        workerEntityId: adj.workerEntityId,
        workDate: adj.workDate,
        action: AdjLogAction.CREATED,
        oldValue: null,
        newValue: { adjustmentType: adj.adjustmentType, minutes: adj.minutes, reasonLabel, description: adj.description, sourceType: 'BULK', bulkId },
        changedBy: createdBy,
        changeReason: null,
      }),
    );
    await this.logRepo.save(logs);
    return saved;
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  async update(id: string, tenantId: string, dto: UpdateAdjustmentDto, updatedBy: string): Promise<WorkAdjustment> {
    const adj = await this.adjRepo.findOneBy({ id, tenantId, status: AdjustmentStatus.ACTIVE });
    if (!adj) throw new NotFoundException('Adjustment not found');

    const oldValue = {
      adjustmentType: adj.adjustmentType,
      minutes: adj.minutes,
      reasonId: adj.reasonId,
      reasonLabel: adj.reasonLabel,
      description: adj.description,
    };

    if (dto.adjustmentType !== undefined) adj.adjustmentType = dto.adjustmentType;
    if (dto.minutes !== undefined) adj.minutes = dto.minutes;
    if ('reasonId' in dto) {
      adj.reasonId = dto.reasonId ?? null;
      adj.reasonLabel = await this.resolveLabel(dto.reasonId, tenantId);
    }
    if ('description' in dto) adj.description = dto.description ?? null;
    adj.updatedBy = updatedBy;

    const saved = await this.adjRepo.save(adj);
    await this.writeLog(
      saved, AdjLogAction.UPDATED, oldValue,
      { adjustmentType: saved.adjustmentType, minutes: saved.minutes, reasonId: saved.reasonId, reasonLabel: saved.reasonLabel, description: saved.description },
      updatedBy, dto.changeReason ?? null,
    );
    return saved;
  }

  // ── Cancel (soft delete) ─────────────────────────────────────────────────────

  async cancel(id: string, tenantId: string, cancelledBy: string, changeReason?: string): Promise<void> {
    const adj = await this.adjRepo.findOneBy({ id, tenantId, status: AdjustmentStatus.ACTIVE });
    if (!adj) throw new NotFoundException('Adjustment not found');
    const oldValue = { adjustmentType: adj.adjustmentType, minutes: adj.minutes, status: adj.status };
    adj.status = AdjustmentStatus.CANCELLED;
    adj.updatedBy = cancelledBy;
    await this.adjRepo.save(adj);
    await this.writeLog(adj, AdjLogAction.CANCELLED, oldValue, null, cancelledBy, changeReason ?? null);
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  async findByWorker(tenantId: string, workerEntityId: string, month?: string): Promise<WorkAdjustment[]> {
    const where: any = { tenantId, workerEntityId };
    if (month) {
      const [start, end] = monthRange(month);
      where.workDate = Between(start, end);
    }
    return this.adjRepo.find({ where, order: { workDate: 'DESC', createdAt: 'DESC' } });
  }

  async findByMonth(tenantId: string, month: string, activeOnly = true): Promise<WorkAdjustment[]> {
    const [start, end] = monthRange(month);
    const where: any = { tenantId, workDate: Between(start, end) };
    if (activeOnly) where.status = AdjustmentStatus.ACTIVE;
    return this.adjRepo.find({ where, order: { workDate: 'ASC', workerEntityId: 'ASC', createdAt: 'ASC' } });
  }

  async findForDateRange(
    tenantId: string,
    workerEntityId: string,
    startDate: string,
    endDate: string,
  ): Promise<WorkAdjustment[]> {
    return this.adjRepo.find({
      where: { tenantId, workerEntityId, workDate: Between(startDate, endDate), status: AdjustmentStatus.ACTIVE },
      order: { workDate: 'ASC', createdAt: 'ASC' },
    });
  }

  // ── Audit log ────────────────────────────────────────────────────────────────

  async findLogs(
    tenantId: string,
    filters: { workerEntityId?: string; month?: string; page?: number; limit?: number },
  ): Promise<{ data: WorkAdjustmentLog[]; total: number }> {
    const page  = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, filters.limit ?? 50);

    const qb = this.logRepo.createQueryBuilder('l').where('l.tenantId = :tid', { tid: tenantId });
    if (filters.workerEntityId) qb.andWhere('l.workerEntityId = :wid', { wid: filters.workerEntityId });
    if (filters.month) {
      const [start, end] = monthRange(filters.month);
      qb.andWhere('l.workDate BETWEEN :s AND :e', { s: start, e: end });
    }

    const [data, total] = await qb
      .orderBy('l.changedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  // ── Analytics: scan-vs-credited differences ─────────────────────────────────
  // Shows, per worker and per day, how much an admin correction changed a
  // worker's counted hours away from their raw scan time — both increases
  // ("mesaý ýaly goşulan") and decreases ("azaldylan") — over all time or a
  // custom date range. Used by the standalone analytics page.
  async getAnalytics(
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AdjustmentAnalytics> {
    const qb = this.adjRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tid', { tid: tenantId })
      .andWhere('a.status = :status', { status: AdjustmentStatus.ACTIVE });
    if (startDate) qb.andWhere('a.workDate >= :s', { s: startDate });
    if (endDate) qb.andWhere('a.workDate <= :e', { e: endDate });
    const adjustments = await qb
      .orderBy('a.workerEntityId', 'ASC')
      .addOrderBy('a.workDate', 'ASC')
      .addOrderBy('a.createdAt', 'ASC')
      .getMany();

    if (adjustments.length === 0) {
      return {
        startDate: startDate ?? null,
        endDate: endDate ?? null,
        summary: { totalAdjustments: 0, workersAffected: 0, totalIncreaseMs: 0, totalDecreaseMs: 0, netDiffMs: 0 },
        workers: [],
      };
    }

    // Group by workerEntityId -> workDate -> adjustments[] (creation order)
    const byWorkerDate = new Map<string, Map<string, WorkAdjustment[]>>();
    for (const adj of adjustments) {
      let byDate = byWorkerDate.get(adj.workerEntityId);
      if (!byDate) { byDate = new Map(); byWorkerDate.set(adj.workerEntityId, byDate); }
      const arr = byDate.get(adj.workDate) ?? [];
      arr.push(adj);
      byDate.set(adj.workDate, arr);
    }

    const workerEntityIds = [...byWorkerDate.keys()];
    const workers = await this.workerRepo.find({ where: workerEntityIds.map(id => ({ id })) });
    const workerById = new Map(workers.map(w => [w.id, w]));

    // Fetch raw scan events for every involved worker, spanning the full
    // range of dates actually touched by an adjustment (may be wider than
    // startDate/endDate if none was given).
    const workerIds = workers.map(w => w.workerId).filter(Boolean);
    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      workerIds.length > 0
        ? await this.eventRepo.query(
            `SELECT "employeeNumber", "eventType", "eventTime"
             FROM attendance_events
             WHERE "employeeNumber" = ANY($1)
             ORDER BY "employeeNumber", "eventTime" ASC`,
            [workerIds],
          )
        : [];
    const eventsByWorkerId = new Map<string, { eventType: string; eventTime: number }[]>();
    for (const ev of events) {
      const arr = eventsByWorkerId.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      eventsByWorkerId.set(ev.employeeNumber, arr);
    }
    const dailyByWorkerId = new Map<string, ReturnType<typeof buildDailyAttendance>>();
    for (const [workerId, evList] of eventsByWorkerId) {
      dailyByWorkerId.set(workerId, buildDailyAttendance(evList, (t) => new Date(t + TZ_OFFSET_MS).toISOString().split('T')[0]));
    }

    let totalIncreaseMs = 0;
    let totalDecreaseMs = 0;
    let totalAdjustments = 0;

    const resultWorkers: AdjustmentAnalyticsWorker[] = [];
    for (const [workerEntityId, byDate] of byWorkerDate) {
      const w = workerById.get(workerEntityId);
      const daily = w ? dailyByWorkerId.get(w.workerId) : undefined;

      let workerIncreaseMs = 0;
      let workerDecreaseMs = 0;
      let workerAdjCount = 0;
      const days: AdjustmentAnalyticsDay[] = [];

      for (const [date, adjs] of byDate) {
        const actualMs = daily?.get(date)?.ms ?? 0;
        const creditedMinutes = computeCredited(Math.floor(actualMs / 60000), adjs);
        const creditedMs = creditedMinutes * 60000;
        const diffMs = creditedMs - actualMs;
        if (diffMs > 0) workerIncreaseMs += diffMs;
        if (diffMs < 0) workerDecreaseMs += -diffMs;
        workerAdjCount += adjs.length;
        days.push({
          date, actualMs, creditedMs, diffMs,
          adjustments: adjs.map(a => ({
            id: a.id,
            adjustmentType: a.adjustmentType,
            minutes: a.minutes,
            reasonLabel: a.reasonLabel,
            description: a.description,
            createdBy: a.createdBy,
            createdAt: a.createdAt,
          })),
        });
      }
      days.sort((a, b) => a.date.localeCompare(b.date));

      totalIncreaseMs += workerIncreaseMs;
      totalDecreaseMs += workerDecreaseMs;
      totalAdjustments += workerAdjCount;

      resultWorkers.push({
        workerEntityId,
        workerId: w?.workerId ?? '—',
        name: w?.name ?? '—',
        profession: w?.profession ?? '—',
        brigade: w?.brigadeName ?? '—',
        adjustmentCount: workerAdjCount,
        totalIncreaseMs: workerIncreaseMs,
        totalDecreaseMs: workerDecreaseMs,
        netDiffMs: workerIncreaseMs - workerDecreaseMs,
        days,
      });
    }

    resultWorkers.sort((a, b) => (Math.abs(b.netDiffMs) - Math.abs(a.netDiffMs)) || a.name.localeCompare(b.name));

    return {
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      summary: {
        totalAdjustments,
        workersAffected: resultWorkers.length,
        totalIncreaseMs,
        totalDecreaseMs,
        netDiffMs: totalIncreaseMs - totalDecreaseMs,
      },
      workers: resultWorkers,
    };
  }
}
