import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardAssignmentHistory } from './card-assignment-history.entity';
import { Worker } from '../workers/worker.entity';

type RecordOptions = {
  source: string;
  changedBy?: string | null;
  note?: string | null;
  tenantId?: string | null;
};

@Injectable()
export class CardAssignmentHistoryService {
  constructor(
    @InjectRepository(CardAssignmentHistory)
    private readonly repo: Repository<CardAssignmentHistory>,
  ) {}

  /**
   * Logs an nfcCardUid change on `worker` — a no-op when the card didn't
   * actually change (e.g. an unrelated field edit went through the same
   * update() path). Called from both the manual worker-edit path and the
   * card-reports resolution path, so every route that can move a card
   * ends up in the same trail.
   */
  async recordChange(
    worker: Pick<Worker, 'id' | 'name' | 'tenantId'>,
    previousCardUid: string | null,
    newCardUid: string | null,
    opts: RecordOptions,
  ) {
    if (previousCardUid === newCardUid) return null;

    const entry = this.repo.create({
      tenantId: opts.tenantId ?? worker.tenantId ?? null,
      workerEntityId: worker.id,
      workerName: worker.name,
      action: newCardUid ? 'ASSIGNED' : 'CLEARED',
      previousCardUid,
      newCardUid,
      source: opts.source,
      changedBy: opts.changedBy ?? null,
      note: opts.note ?? null,
    });
    return this.repo.save(entry);
  }

  async findForWorker(workerEntityId: string, tenantId?: string) {
    return this.repo.find({
      where: { workerEntityId, ...(tenantId ? { tenantId } : {}) },
      order: { createdAt: 'DESC' },
    });
  }
}
