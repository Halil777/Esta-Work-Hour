import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardReport } from './card-report.entity';
import { Worker } from '../workers/worker.entity';

@Injectable()
export class CardReportsService {
  constructor(
    @InjectRepository(CardReport)
    private readonly repo: Repository<CardReport>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  async create(data: {
    tenantId?: string;
    cardUid: string;
    currentWorkerName?: string;
    suggestedWorkerId?: string;
    suggestedWorkerName?: string;
    deviceLabel?: string;
    note?: string;
  }) {
    const report = this.repo.create({
      tenantId: data.tenantId,
      cardUid: data.cardUid,
      currentWorkerName: data.currentWorkerName,
      suggestedWorkerId: data.suggestedWorkerId,
      suggestedWorkerName: data.suggestedWorkerName,
      deviceLabel: data.deviceLabel,
      note: data.note,
      status: 'pending',
    });
    return this.repo.save(report);
  }

  async findAll(tenantId?: string, status?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async resolve(id: string, resolvedBy: string, tenantId?: string) {
    const report = await this.repo.findOneBy({ id, ...(tenantId ? { tenantId } : {}) });
    if (!report) throw new NotFoundException('Report not found');

    // If a suggested worker is specified, link the card to them
    if (report.suggestedWorkerId) {
      const tenantFilter = tenantId ? { tenantId } : {};
      const targetWorker = await this.workerRepo.findOneBy({ workerId: report.suggestedWorkerId, ...tenantFilter });
      if (targetWorker) {
        // Clear card from any other worker that has it
        const oldOwner = await this.workerRepo.findOneBy({ nfcCardUid: report.cardUid, ...tenantFilter });
        if (oldOwner && oldOwner.id !== targetWorker.id) {
          oldOwner.nfcCardUid = null;
          await this.workerRepo.save(oldOwner);
        }
        targetWorker.nfcCardUid = report.cardUid;
        await this.workerRepo.save(targetWorker);
      }
    }

    report.status = 'resolved';
    report.resolvedAt = new Date();
    report.resolvedBy = resolvedBy;
    return this.repo.save(report);
  }

  async dismiss(id: string, tenantId?: string) {
    const report = await this.repo.findOneBy({ id, ...(tenantId ? { tenantId } : {}) });
    if (!report) throw new NotFoundException('Report not found');
    report.status = 'dismissed';
    return this.repo.save(report);
  }

  async getPendingCount(tenantId?: string) {
    const where: any = { status: 'pending' };
    if (tenantId) where.tenantId = tenantId;
    return this.repo.count({ where });
  }
}
