import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { randomUUID } from 'crypto';
import { WorkAdjustment, AdjustmentType, AdjustmentStatus } from './work-adjustment.entity';
import { WorkAdjustmentLog, AdjLogAction } from './work-adjustment-log.entity';
import { AdjustmentReason } from '../adjustment-reasons/adjustment-reason.entity';

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
}
