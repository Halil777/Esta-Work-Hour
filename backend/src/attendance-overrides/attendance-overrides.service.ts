import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceOverride } from './attendance-override.entity';

@Injectable()
export class AttendanceOverridesService {
  constructor(
    @InjectRepository(AttendanceOverride)
    private readonly repo: Repository<AttendanceOverride>,
  ) {}

  async upsert(
    workerEntityId: string,
    date: string,
    checkInMs: number | null,
    checkOutMs: number | null,
    note: string | null,
    createdBy: string,
  ): Promise<AttendanceOverride> {
    let existing = await this.repo.findOneBy({ workerEntityId, date });
    if (existing) {
      existing.checkInMs = checkInMs;
      existing.checkOutMs = checkOutMs;
      existing.note = note;
      existing.createdBy = createdBy;
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({ workerEntityId, date, checkInMs, checkOutMs, note, createdBy }),
    );
  }

  async getForWorkerRange(workerEntityId: string, startDate?: string, endDate?: string): Promise<AttendanceOverride[]> {
    const qb = this.repo.createQueryBuilder('o')
      .where('o.workerEntityId = :id', { id: workerEntityId });
    if (startDate) qb.andWhere('o.date >= :s', { s: startDate });
    if (endDate)   qb.andWhere('o.date <= :e', { e: endDate });
    return qb.getMany();
  }

  async delete(workerEntityId: string, date: string): Promise<void> {
    await this.repo.delete({ workerEntityId, date });
  }
}
