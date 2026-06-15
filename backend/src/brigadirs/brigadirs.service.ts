import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as XLSX from 'xlsx';
import { Brigadir } from './brigadir.entity';
import { Foreman } from '../foremans/foreman.entity';
import { Worker } from '../workers/worker.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateBrigadirDto } from './dto/create-brigadir.dto';
import { UpdateBrigadirDto } from './dto/update-brigadir.dto';

@Injectable()
export class BrigadirsService {
  constructor(
    @InjectRepository(Brigadir)
    private readonly repo: Repository<Brigadir>,
    @InjectRepository(Foreman)
    private readonly foremanRepo: Repository<Foreman>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    const brigadirs = await this.repo.find({ order: { createdAt: 'DESC' } });
    if (brigadirs.length === 0) return [];

    const foremanIds = [...new Set(brigadirs.map(b => b.foremanId).filter(Boolean))] as string[];
    const foremans = foremanIds.length > 0
      ? await this.foremanRepo.find({ where: { id: In(foremanIds) } })
      : [];
    const foremanMap = new Map(foremans.map(f => [f.id, f.name]));

    const wc: { brigadirId: string; count: string }[] = await this.workerRepo.query(
      `SELECT "brigadirId", COUNT(*) as count FROM workers WHERE "brigadirId" IS NOT NULL GROUP BY "brigadirId"`,
    );
    const wcMap = new Map(wc.map(r => [r.brigadirId, Number(r.count)]));

    return brigadirs.map(b => ({
      ...b,
      foremanName: b.foremanId ? (foremanMap.get(b.foremanId) ?? null) : null,
      workerCount: wcMap.get(b.id) ?? 0,
    }));
  }

  async findOneWithWorkers(id: string) {
    const brigadir = await this.repo.findOneBy({ id });
    if (!brigadir) throw new NotFoundException(`Brigadir ${id} not found`);

    const workers = await this.workerRepo.find({
      where: { brigadirId: id },
      order: { name: 'ASC' },
    });

    let foremanName: string | null = null;
    if (brigadir.foremanId) {
      const f = await this.foremanRepo.findOneBy({ id: brigadir.foremanId });
      foremanName = f?.name ?? null;
    }

    return { ...brigadir, foremanName, workers };
  }

  async create(dto: CreateBrigadirDto, changedBy = 'Admin') {
    const brigadir = this.repo.create(dto);
    const saved = await this.repo.save(brigadir);
    await this.auditLog.log('Brigadir', saved.id, 'CREATE', changedBy, null, saved);
    return saved;
  }

  async update(id: string, dto: UpdateBrigadirDto, changedBy = 'Admin') {
    const brigadir = await this.repo.findOneBy({ id });
    if (!brigadir) throw new NotFoundException(`Brigadir ${id} not found`);
    const before = { ...brigadir };
    Object.assign(brigadir, dto);
    const saved = await this.repo.save(brigadir);
    await this.auditLog.log('Brigadir', id, 'UPDATE', changedBy, before, saved);
    return saved;
  }

  async remove(id: string, changedBy = 'Admin') {
    const brigadir = await this.repo.findOneBy({ id });
    if (!brigadir) throw new NotFoundException(`Brigadir ${id} not found`);
    // Detach all workers from this brigadir
    await this.workerRepo.createQueryBuilder()
      .update(Worker)
      .set({ brigadirId: null })
      .where('"brigadirId" = :id', { id })
      .execute();
    await this.auditLog.log('Brigadir', id, 'DELETE', changedBy, brigadir, null);
    return this.repo.remove(brigadir);
  }

  async assignWorker(brigadirId: string, workerId: string, changedBy = 'Admin') {
    const brigadir = await this.repo.findOneBy({ id: brigadirId });
    if (!brigadir) throw new NotFoundException(`Brigadir ${brigadirId} not found`);

    const worker = await this.workerRepo.findOneBy({ id: workerId });
    if (!worker) throw new NotFoundException(`Worker ${workerId} not found`);

    if (worker.brigadirId && worker.brigadirId !== brigadirId) {
      throw new ConflictException(
        `Worker "${worker.name}" başga brigadira berkidilen. Ilki ol brigadirden aýyryň.`,
      );
    }

    const before = { brigadirId: worker.brigadirId };
    worker.brigadirId = brigadirId;
    await this.workerRepo.save(worker);
    await this.auditLog.log('Worker', workerId, 'UPDATE', changedBy, before, { brigadirId });
    return { ok: true, worker };
  }

  async unassignWorker(brigadirId: string, workerId: string, changedBy = 'Admin') {
    const worker = await this.workerRepo.findOneBy({ id: workerId });
    if (!worker) throw new NotFoundException(`Worker ${workerId} not found`);

    const before = { brigadirId: worker.brigadirId };
    worker.brigadirId = null;
    await this.workerRepo.save(worker);
    await this.auditLog.log('Worker', workerId, 'UPDATE', changedBy, before, { brigadirId: null });
    return { ok: true };
  }

  async importFromExcel(buffer: Buffer, changedBy = 'Admin') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    let imported = 0;
    for (const row of rows) {
      const name = String(row['name'] || row['Name'] || row['ФИО'] || row['Brigadir'] || '').trim();
      if (!name) continue;
      const phone = String(row['phone'] || row['Phone'] || row['Телефон'] || '').trim() || null;
      const workerId = String(row['workerId'] || row['Worker ID'] || '').trim() || null;
      const brigadir = this.repo.create({ name, phone, workerId });
      const saved = await this.repo.save(brigadir);
      await this.auditLog.log('Brigadir', saved.id, 'CREATE', changedBy, null, saved);
      imported++;
    }
    return { imported };
  }
}
