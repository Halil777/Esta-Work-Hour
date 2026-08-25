import { Injectable } from '@nestjs/common';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { TerminateWorkerDto } from './dto/terminate-worker.dto';
import { WorkersQueryService, FindAllParams } from './workers-query.service';
import { WorkersCrudService } from './workers-crud.service';
import { WorkersImportService } from './workers-import.service';
import { WorkersExportService } from './workers-export.service';

/**
 * Thin facade over the workers module's four focused services, so
 * WorkersController keeps a single dependency and a stable API while the
 * actual logic lives in the query/crud/import/export services below:
 *  - WorkersQueryService  — listing/searching/fetching workers
 *  - WorkersCrudService   — create/update/terminate/restore + photo upload
 *  - WorkersImportService — Excel roster import/preview + card-number import
 *  - WorkersExportService — Excel roster export
 */
@Injectable()
export class WorkersService {
  constructor(
    private readonly queryService: WorkersQueryService,
    private readonly crudService: WorkersCrudService,
    private readonly importService: WorkersImportService,
    private readonly exportService: WorkersExportService,
  ) {}

  // ── Query ──────────────────────────────────────────────────────────────
  findAll(params?: FindAllParams) {
    return this.queryService.findAll(params);
  }

  findOne(id: string) {
    return this.queryService.findOne(id);
  }

  findTerminated(search?: string, tenantId?: string) {
    return this.queryService.findTerminated(search, tenantId);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────
  create(dto: CreateWorkerDto, tenantId?: string, changedBy = 'Admin') {
    return this.crudService.create(dto, tenantId, changedBy);
  }

  update(id: string, dto: UpdateWorkerDto, changedBy = 'Admin') {
    return this.crudService.update(id, dto, changedBy);
  }

  remove(id: string, changedBy = 'Admin') {
    return this.crudService.remove(id, changedBy);
  }

  terminateWorker(id: string, dto: TerminateWorkerDto = {}, changedBy = 'Admin') {
    return this.crudService.terminateWorker(id, dto, changedBy);
  }

  restoreWorker(id: string, changedBy = 'Admin') {
    return this.crudService.restoreWorker(id, changedBy);
  }

  uploadPhoto(id: string, file: Express.Multer.File) {
    return this.crudService.uploadPhoto(id, file);
  }

  // ── Excel import/export ───────────────────────────────────────────────
  exportToExcel(params?: FindAllParams & { lang?: 'en' | 'ru' | 'tr' }) {
    return this.exportService.exportToExcel(params);
  }

  previewImportFromExcel(buffer: Buffer, tenantId?: string) {
    return this.importService.previewImportFromExcel(buffer, tenantId);
  }

  importFromExcel(buffer: Buffer, tenantId?: string, changedBy = 'Admin') {
    return this.importService.importFromExcel(buffer, tenantId, changedBy);
  }

  importCardNumbers(buffer: Buffer, tenantId?: string) {
    return this.importService.importCardNumbers(buffer, tenantId);
  }
}
