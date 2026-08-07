import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceOverride } from './attendance-override.entity';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AttendanceOverridesService {
  constructor(
    @InjectRepository(AttendanceOverride)
    private readonly repo: Repository<AttendanceOverride>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async upsert(
    workerEntityId: string,
    date: string,
    checkInMs: number | null,
    checkOutMs: number | null,
    note: string | null,
    createdBy: string,
    tenantId?: string,
  ): Promise<AttendanceOverride> {
    let existing = await this.repo.findOneBy({ workerEntityId, date });

    const before = existing
      ? { checkInMs: existing.checkInMs, checkOutMs: existing.checkOutMs, note: existing.note }
      : null;

    let saved: AttendanceOverride;
    if (existing) {
      existing.checkInMs = checkInMs;
      existing.checkOutMs = checkOutMs;
      existing.note = note;
      existing.createdBy = createdBy;
      if (tenantId) existing.tenantId = tenantId;
      saved = await this.repo.save(existing);
    } else {
      saved = await this.repo.save(
        this.repo.create({ workerEntityId, date, checkInMs, checkOutMs, note, createdBy, tenantId: tenantId ?? null }),
      );
    }

    const after = { checkInMs, checkOutMs, note };
    await this.auditLogService.log(
      'attendance_override',
      `${workerEntityId}:${date}`,
      existing ? 'UPDATE' : 'CREATE',
      createdBy,
      before,
      after,
      tenantId,
    );

    return saved;
  }

  async getForWorkerRange(workerEntityId: string, startDate?: string, endDate?: string): Promise<AttendanceOverride[]> {
    const qb = this.repo.createQueryBuilder('o')
      .where('o.workerEntityId = :id', { id: workerEntityId });
    if (startDate) qb.andWhere('o.date >= :s', { s: startDate });
    if (endDate)   qb.andWhere('o.date <= :e', { e: endDate });
    return qb.getMany();
  }

  async getForDate(date: string, tenantId?: string): Promise<AttendanceOverride[]> {
    const qb = this.repo.createQueryBuilder('o').where('o.date = :date', { date });
    if (tenantId) qb.andWhere('o.tenantId = :tid', { tid: tenantId });
    else qb.andWhere('o.tenantId IS NULL');
    return qb.getMany();
  }

  async getForWorkerIdsRange(
    workerEntityIds: string[],
    startDate: string,
    endDate: string,
    tenantId?: string,
  ): Promise<AttendanceOverride[]> {
    if (!workerEntityIds.length) return [];
    const qb = this.repo.createQueryBuilder('o')
      .where('o.workerEntityId IN (:...ids)', { ids: workerEntityIds })
      .andWhere('o.date >= :s', { s: startDate })
      .andWhere('o.date <= :e', { e: endDate });
    if (tenantId) qb.andWhere('o.tenantId = :tid', { tid: tenantId });
    else qb.andWhere('o.tenantId IS NULL');
    return qb.getMany();
  }

  async delete(workerEntityId: string, date: string, deletedBy = 'Admin', tenantId?: string): Promise<void> {
    const existing = await this.repo.findOneBy({ workerEntityId, date });
    if (existing) {
      const before = { checkInMs: existing.checkInMs, checkOutMs: existing.checkOutMs, note: existing.note };
      await this.repo.delete({ workerEntityId, date });
      await this.auditLogService.log(
        'attendance_override',
        `${workerEntityId}:${date}`,
        'DELETE',
        deletedBy,
        before,
        null,
        tenantId,
      );
    }
  }
}
