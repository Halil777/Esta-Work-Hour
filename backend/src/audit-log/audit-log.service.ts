import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  log(entityType: string, entityId: string, action: string, changedBy: string, before?: any, after?: any, tenantId?: string) {
    const entry = this.repo.create({
      entityType,
      entityId,
      action,
      changedBy,
      before: before ?? null,
      after: after ?? null,
      tenantId: tenantId ?? null,
    });
    return this.repo.save(entry);
  }

  findAll(limit = 200, tenantId?: string) {
    return this.repo.find({
      where: tenantId ? { tenantId } : {},
      order: { changedAt: 'DESC' },
      take: limit,
    });
  }
}
