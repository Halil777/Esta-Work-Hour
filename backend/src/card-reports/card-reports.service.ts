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

  async resolve(id: string, resolvedBy: string, tenantId?: string, workerId?: string) {
    const report = await this.repo.findOneBy({ id, ...(tenantId ? { tenantId } : {}) });
    if (!report) throw new NotFoundException('Report not found');

    const tenantFilter = tenantId ? { tenantId } : {};

    // The admin's explicit pick (from the "assign worker" dialog) always wins;
    // it only falls back to the device's suggestion when the admin didn't
    // override it. Reports commonly arrive with no suggestion at all — the
    // scanner device can only flag a mismatch, not pick who the card
    // actually belongs to — so without this override, "resolving" a report
    // used to just flip its status without ever touching the wrong card.
    const targetWorkerId = workerId || report.suggestedWorkerId;

    if (targetWorkerId) {
      const targetWorker = await this.workerRepo.findOneBy({ workerId: targetWorkerId, ...tenantFilter });
      if (!targetWorker) {
        if (workerId) {
          // Admin explicitly chose this worker — surface the failure instead
          // of silently marking the report "resolved" with nothing fixed.
          throw new NotFoundException('Saýlanan işçi tapylmady');
        }
        // No explicit choice, and the device's suggested worker no longer
        // matches anyone (e.g. terminated since) — fall through and just
        // mark the report resolved, same as before.
      } else {
        // Clear the card from any other worker that currently holds it
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
