import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Foreman } from './foreman.entity';
import { Worker } from '../workers/worker.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateForemanDto } from './dto/create-foreman.dto';
import { UpdateForemanDto } from './dto/update-foreman.dto';

@Injectable()
export class ForemanService {
  constructor(
    @InjectRepository(Foreman)
    private readonly repo: Repository<Foreman>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll() {
    const foremans = await this.repo.find({ order: { createdAt: 'DESC' } });

    const directCounts: { foremanId: string; count: string }[] =
      await this.workerRepo.query(
        `SELECT "foremanId", COUNT(*) as count FROM workers WHERE "foremanId" IS NOT NULL GROUP BY "foremanId"`,
      );
    const dcMap = new Map(directCounts.map(r => [r.foremanId, Number(r.count)]));

    return foremans.map(f => ({
      ...f,
      workerCount: dcMap.get(f.id) ?? 0,
    }));
  }

  async findOneWithWorkers(id: string) {
    const foreman = await this.repo.findOneBy({ id });
    if (!foreman) throw new NotFoundException(`Foreman ${id} not found`);
    const workers = await this.workerRepo.find({
      where: { foremanId: id },
      order: { name: 'ASC' },
    });
    return { ...foreman, workers };
  }

  async findOne(id: string) {
    const f = await this.repo.findOneBy({ id });
    if (!f) throw new NotFoundException(`Foreman ${id} not found`);
    return f;
  }

  async create(dto: CreateForemanDto, changedBy = 'Admin') {
    const foreman = this.repo.create(dto);
    const saved = await this.repo.save(foreman);
    await this.auditLog.log('Foreman', saved.id, 'CREATE', changedBy, null, saved);
    return saved;
  }

  async update(id: string, dto: UpdateForemanDto, changedBy = 'Admin') {
    const foreman = await this.findOne(id);
    const before = { ...foreman };
    Object.assign(foreman, dto);
    const saved = await this.repo.save(foreman);
    await this.auditLog.log('Foreman', id, 'UPDATE', changedBy, before, saved);
    return saved;
  }

  async remove(id: string, changedBy = 'Admin') {
    const foreman = await this.findOne(id);
    // Detach direct workers
    await this.workerRepo.createQueryBuilder()
      .update(Worker)
      .set({ foremanId: null })
      .where('"foremanId" = :id', { id })
      .execute();
    await this.auditLog.log('Foreman', id, 'DELETE', changedBy, foreman, null);
    return this.repo.remove(foreman);
  }

  async assignWorker(foremanId: string, workerId: string, changedBy = 'Admin') {
    await this.findOne(foremanId);
    const worker = await this.workerRepo.findOneBy({ id: workerId });
    if (!worker) throw new NotFoundException(`Worker ${workerId} not found`);
    if (worker.foremanId && worker.foremanId !== foremanId) {
      throw new BadRequestException('Bu işçi başga bir formene degişli');
    }
    const before = { ...worker };
    worker.foremanId = foremanId;
    const saved = await this.workerRepo.save(worker);
    await this.auditLog.log('Worker', workerId, 'UPDATE', changedBy, before, saved);
    return saved;
  }

  async unassignWorker(foremanId: string, workerId: string, changedBy = 'Admin') {
    const worker = await this.workerRepo.findOneBy({ id: workerId });
    if (!worker) throw new NotFoundException(`Worker ${workerId} not found`);
    const before = { ...worker };
    worker.foremanId = null;
    const saved = await this.workerRepo.save(worker);
    await this.auditLog.log('Worker', workerId, 'UPDATE', changedBy, before, saved);
    return saved;
  }

  async importFromExcel(buffer: Buffer, changedBy = 'Admin') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    let imported = 0;
    for (const row of rows) {
      const name = String(row['name'] || row['Name'] || row['ФИО'] || row['Имя'] || '').trim();
      if (!name) continue;
      const phone = String(row['phone'] || row['Phone'] || row['Телефон'] || '').trim() || null;
      const workerId = String(row['workerId'] || row['Worker ID'] || '').trim() || null;
      const foreman = this.repo.create({ name, phone, workerId });
      const saved = await this.repo.save(foreman);
      await this.auditLog.log('Foreman', saved.id, 'CREATE', changedBy, null, saved);
      imported++;
    }
    return { imported };
  }
}
