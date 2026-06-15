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

  log(entityType: string, entityId: string, action: string, changedBy: string, before?: any, after?: any) {
    const entry = this.repo.create({
      entityType,
      entityId,
      action,
      changedBy,
      before: before ?? null,
      after: after ?? null,
    });
    return this.repo.save(entry);
  }

  findAll(limit = 200) {
    return this.repo.find({ order: { changedAt: 'DESC' }, take: limit });
  }
}
