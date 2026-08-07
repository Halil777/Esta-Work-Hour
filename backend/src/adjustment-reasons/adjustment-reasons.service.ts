import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdjustmentReason } from './adjustment-reason.entity';

const DEFAULT_REASONS = [
  { name: 'Evacuation',            description: 'Site evacuation due to emergency' },
  { name: 'Company Holiday',       description: 'Company-declared holiday' },
  { name: 'Official Holiday',      description: 'Official public holiday' },
  { name: 'Site Closure',          description: 'Site was closed' },
  { name: 'Weather Condition',     description: 'Adverse weather conditions' },
  { name: 'Transport Problem',     description: 'Transportation issue' },
  { name: 'Power Failure',         description: 'Power outage' },
  { name: 'Safety Incident',       description: 'Safety-related shutdown' },
  { name: 'Management Decision',   description: 'Decision by management' },
  { name: 'Rest Day Work',         description: 'Worked on a rest day' },
  { name: 'Shift Change',          description: 'Shift schedule change' },
  { name: 'Technical Problem',     description: 'Technical issue' },
  { name: 'Attendance Correction', description: 'Manual attendance correction' },
  { name: 'Other',                 description: null },
];

@Injectable()
export class AdjustmentReasonsService {
  constructor(
    @InjectRepository(AdjustmentReason)
    private readonly repo: Repository<AdjustmentReason>,
  ) {}

  async findAll(tenantId: string): Promise<AdjustmentReason[]> {
    const existing = await this.repo.find({ where: { tenantId }, order: { name: 'ASC' } });
    if (existing.length === 0) {
      const seeds = DEFAULT_REASONS.map(r =>
        this.repo.create({ tenantId, name: r.name, description: r.description ?? null, isActive: true }),
      );
      return this.repo.save(seeds);
    }
    return existing;
  }

  async create(tenantId: string, name: string, description: string | null): Promise<AdjustmentReason> {
    return this.repo.save(this.repo.create({ tenantId, name, description, isActive: true }));
  }

  async update(
    id: string,
    tenantId: string,
    dto: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<AdjustmentReason> {
    const r = await this.repo.findOneBy({ id, tenantId });
    if (!r) throw new NotFoundException('Reason not found');
    Object.assign(r, dto);
    return this.repo.save(r);
  }
}
