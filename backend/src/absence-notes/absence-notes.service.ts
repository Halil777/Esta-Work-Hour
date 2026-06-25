import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbsenceNote } from './absence-note.entity';

@Injectable()
export class AbsenceNotesService {
  constructor(
    @InjectRepository(AbsenceNote)
    private readonly repo: Repository<AbsenceNote>,
  ) {}

  async upsert(
    workerEntityId: string,
    workerName: string,
    workerId: string,
    date: string,
    note: string,
    createdBy: string,
    createdByName: string,
  ): Promise<AbsenceNote> {
    let existing = await this.repo.findOneBy({ workerEntityId, date });
    if (existing) {
      existing.note = note;
      existing.createdBy = createdBy;
      existing.createdByName = createdByName;
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({ workerEntityId, workerName, workerId, date, note, createdBy, createdByName }),
    );
  }

  async getForDate(date: string): Promise<AbsenceNote[]> {
    return this.repo.findBy({ date });
  }

  async getForWorker(workerEntityId: string): Promise<AbsenceNote[]> {
    return this.repo.find({
      where: { workerEntityId },
      order: { date: 'DESC' },
      take: 90,
    });
  }

  async deleteNote(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
