import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { Worker, WorkerStatus } from './worker.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WorkerLifecycleService } from '../worker-lifecycle/worker-lifecycle.service';
import { WorkerLifecycleSource } from '../worker-lifecycle/worker-lifecycle-event.entity';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { TerminateWorkerDto } from './dto/terminate-worker.dto';
import { WorkersQueryService } from './workers-query.service';

/**
 * Write-side of the workers module: create/update/terminate/restore a
 * single worker, plus photo upload. Excel import/export live in their own
 * services — this one is for the single-worker CRUD paths the controller
 * exposes directly.
 */
@Injectable()
export class WorkersCrudService {
  constructor(
    @InjectRepository(Worker)
    private readonly repo: Repository<Worker>,
    private readonly queryService: WorkersQueryService,
    private readonly auditLog: AuditLogService,
    private readonly workerLifecycle: WorkerLifecycleService,
  ) {}

  async create(dto: CreateWorkerDto, tenantId?: string, changedBy = 'Admin') {
    const sanitized: any = { ...dto };
    if (sanitized.workerId === '') delete sanitized.workerId;
    if (sanitized.hireDate === '') sanitized.hireDate = null;
    if (sanitized.phone === '') sanitized.phone = null;
    if (sanitized.brigadirId === '') sanitized.brigadirId = null;
    if (sanitized.foremanId === '') sanitized.foremanId = null;
    if (sanitized.nfcCardUid === '') sanitized.nfcCardUid = null;
    if (sanitized.shift === '') sanitized.shift = null;
    if (sanitized.terminationDate === '') sanitized.terminationDate = null;
    if (sanitized.terminationReason === '') sanitized.terminationReason = null;
    if (sanitized.terminationNote === '') sanitized.terminationNote = null;

    const count = await this.repo.count({ where: tenantId ? { tenantId } : {} });
    const workerId = sanitized.workerId?.trim() || `EST-${String(count + 1).padStart(3, '0')}`;
    const worker = this.repo.create({ ...sanitized, workerId, tenantId: tenantId || null }) as unknown as Worker;
    const saved = (await this.repo.save(worker)) as Worker;
    await this.auditLog.log('Worker', saved.id, 'CREATE', changedBy, null, saved);
    await this.workerLifecycle.recordCreated(saved, changedBy, WorkerLifecycleSource.Manual);
    return saved;
  }

  async update(id: string, dto: UpdateWorkerDto, changedBy = 'Admin') {
    const worker = await this.queryService.findOne(id);
    const before = { ...worker };
    // Convert empty strings to null for nullable date/string fields
    const sanitized: any = { ...dto };
    if (sanitized.hireDate === '') sanitized.hireDate = null;
    if (sanitized.phone === '') sanitized.phone = null;
    if (sanitized.brigadirId === '') sanitized.brigadirId = null;
    if (sanitized.foremanId === '') sanitized.foremanId = null;
    if (sanitized.nfcCardUid === '') sanitized.nfcCardUid = null;
    if (sanitized.shift === '') sanitized.shift = null;
    if (sanitized.terminationDate === '') sanitized.terminationDate = null;
    if (sanitized.terminationReason === '') sanitized.terminationReason = null;
    if (sanitized.terminationNote === '') sanitized.terminationNote = null;
    Object.assign(worker, sanitized);
    const saved = await this.repo.save(worker);
    await this.auditLog.log('Worker', id, 'UPDATE', changedBy, before, saved);
    if (before.status !== WorkerStatus.Terminated && saved.status === WorkerStatus.Terminated) {
      if (!saved.terminatedAt) {
        saved.terminatedAt = new Date();
      }
      if (!saved.terminationDate) saved.terminationDate = this.dateOnly(saved.terminatedAt ?? new Date());
      await this.repo.save(saved);
      await this.workerLifecycle.recordTerminated(
        saved,
        changedBy,
        WorkerLifecycleSource.Manual,
        this.terminationLifecycleNote(saved),
      );
    }
    if (before.status === WorkerStatus.Terminated && saved.status !== WorkerStatus.Terminated) {
      saved.terminatedAt = null;
      saved.terminationDate = null;
      saved.terminationReason = null;
      saved.terminationNote = null;
      await this.repo.save(saved);
      await this.workerLifecycle.recordRestored(saved, changedBy, WorkerLifecycleSource.Manual);
    }
    return saved;
  }

  async remove(id: string, changedBy = 'Admin') {
    return this.terminateWorker(id, { reason: 'Admin tarapyndan işden çykaryldy' }, changedBy);
  }

  async terminateWorker(id: string, dto: TerminateWorkerDto = {}, changedBy = 'Admin') {
    const worker = await this.queryService.findOne(id);
    return this.markWorkerTerminated(worker, dto, changedBy, WorkerLifecycleSource.Manual);
  }

  private async markWorkerTerminated(
    worker: Worker,
    dto: TerminateWorkerDto,
    changedBy: string,
    source: WorkerLifecycleSource,
  ) {
    const before = { ...worker };
    worker.status = WorkerStatus.Terminated;
    worker.terminationDate = dto.terminationDate?.trim() || this.dateOnly();
    worker.terminationReason = dto.reason?.trim() || null;
    worker.terminationNote = dto.note?.trim() || null;
    worker.terminatedAt = new Date();
    const saved = await this.repo.save(worker);
    await this.auditLog.log('Worker', saved.id, 'TERMINATE', changedBy, before, saved);
    await this.workerLifecycle.recordTerminated(
      saved,
      changedBy,
      source,
      this.terminationLifecycleNote(saved),
    );
    return saved;
  }

  async restoreWorker(id: string, changedBy = 'Admin') {
    const worker = await this.queryService.findOne(id);
    const before = { ...worker };
    worker.status = WorkerStatus.Active;
    worker.terminatedAt = null;
    worker.terminationDate = null;
    worker.terminationReason = null;
    worker.terminationNote = null;
    const saved = await this.repo.save(worker);
    await this.auditLog.log('Worker', id, 'UPDATE', changedBy, before, saved);
    await this.workerLifecycle.recordRestored(saved, changedBy, WorkerLifecycleSource.Manual);
    return saved;
  }

  async uploadPhoto(id: string, file: Express.Multer.File): Promise<{ photoUrl: string }> {
    const worker = await this.queryService.findOne(id);
    const uploadDir = path.join(process.cwd(), 'uploads', 'photos');
    await fs.promises.mkdir(uploadDir, { recursive: true });

    if (worker.photoUrl) {
      const oldPath = path.join(process.cwd(), worker.photoUrl.replace(/^\//, ''));
      await fs.promises.unlink(oldPath).catch(() => {});
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${worker.workerId}${ext}`;
    await fs.promises.writeFile(path.join(uploadDir, filename), file.buffer);

    const photoUrl = `/uploads/photos/${filename}`;
    await this.repo.update(id, { photoUrl });
    return { photoUrl };
  }

  private dateOnly(date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  private terminationLifecycleNote(worker: Worker): string | null {
    const parts = [
      worker.terminationDate ? `Soňky iş güni: ${worker.terminationDate}` : '',
      worker.terminationReason ? `Sebäp: ${worker.terminationReason}` : '',
      worker.terminationNote ? `Bellik: ${worker.terminationNote}` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' | ') : null;
  }
}
