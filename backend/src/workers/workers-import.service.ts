import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { Worker, WorkerStatus, QrStatus, MobileRole } from './worker.entity';
import { Foreman } from '../foremans/foreman.entity';
import { WorkerLifecycleService } from '../worker-lifecycle/worker-lifecycle.service';
import { WorkerLifecycleSource } from '../worker-lifecycle/worker-lifecycle-event.entity';
import { ACTIVE_WORKER_STATUSES, IMPORT_PREVIEW_SAMPLE_LIMIT } from './workers.constants';
import { ParsedWorkerImportRow } from './types/worker-import-row.type';

/**
 * Excel-based bulk operations: importing/previewing the worker roster
 * spreadsheet (create/update/restore/terminate-by-absence) and linking NFC
 * card numbers from a separate scans export.
 */
@Injectable()
export class WorkersImportService {
  constructor(
    @InjectRepository(Worker)
    private readonly repo: Repository<Worker>,
    @InjectRepository(Foreman)
    private readonly foremanRepo: Repository<Foreman>,
    private readonly workerLifecycle: WorkerLifecycleService,
  ) {}

  async previewImportFromExcel(buffer: Buffer, tenantId?: string) {
    const parsedRows = this.parseWorkerImportRows(buffer);
    const excelWorkerIds = new Set(parsedRows.map(r => r.workerId).filter(Boolean));
    const existingByWorkerId = await this.findExistingByWorkerId([...excelWorkerIds], tenantId);

    const samples = {
      created: [] as any[],
      updated: [] as any[],
      restored: [] as any[],
      terminated: [] as any[],
      duplicates: [] as string[],
    };
    const counts = {
      created: 0,
      updated: 0,
      restored: 0,
      terminated: 0,
      duplicateWorkerIds: 0,
    };

    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const row of parsedRows) {
      if (!row.workerId) continue;
      if (seen.has(row.workerId)) duplicates.add(row.workerId);
      seen.add(row.workerId);
    }
    counts.duplicateWorkerIds = duplicates.size;
    samples.duplicates = [...duplicates].slice(0, IMPORT_PREVIEW_SAMPLE_LIMIT);

    for (const row of parsedRows) {
      const existing = row.workerId ? existingByWorkerId.get(row.workerId) : undefined;
      const item = this.importPreviewItem(row, existing);
      if (!existing) {
        counts.created++;
        if (samples.created.length < IMPORT_PREVIEW_SAMPLE_LIMIT) samples.created.push(item);
      } else if (existing.status === WorkerStatus.Terminated) {
        counts.restored++;
        if (samples.restored.length < IMPORT_PREVIEW_SAMPLE_LIMIT) samples.restored.push(item);
      } else {
        counts.updated++;
        if (samples.updated.length < IMPORT_PREVIEW_SAMPLE_LIMIT) samples.updated.push(item);
      }
    }

    if (excelWorkerIds.size > 0) {
      const activeWorkers = await this.repo.find({
        where: ACTIVE_WORKER_STATUSES.map(status => ({ status, ...(tenantId ? { tenantId } : {}) })),
      });
      for (const worker of activeWorkers) {
        if (worker.workerId && !excelWorkerIds.has(worker.workerId)) {
          counts.terminated++;
          if (samples.terminated.length < IMPORT_PREVIEW_SAMPLE_LIMIT) {
            samples.terminated.push(this.workerPreviewItem(worker));
          }
        }
      }
    }

    return {
      totalRows: parsedRows.length,
      rowsWithWorkerId: excelWorkerIds.size,
      counts,
      samples,
    };
  }

  async importFromExcel(buffer: Buffer, tenantId?: string, changedBy = 'Admin') {
    const parsedRows = this.parseWorkerImportRows(buffer);

    const created: Worker[] = [];
    const updated: Worker[] = [];
    const excelWorkerIds = new Set<string>();
    let restored = 0;

    for (const row of parsedRows) {
      let savedWorker: Worker;

      if (row.workerId) {
        excelWorkerIds.add(row.workerId);
        const exists = await this.repo.findOneBy({
          workerId: row.workerId,
          ...(tenantId ? { tenantId } : {}),
        });
        if (exists) {
          const wasTerminated = exists.status === WorkerStatus.Terminated;
          Object.assign(exists, row.fields);
          if (wasTerminated) {
            exists.status = WorkerStatus.Active;
            exists.terminatedAt = null;
            exists.terminationDate = null;
            exists.terminationReason = null;
            exists.terminationNote = null;
          }
          savedWorker = (await this.repo.save(exists)) as unknown as Worker;
          updated.push(savedWorker);
          if (wasTerminated) {
            await this.workerLifecycle.recordRestored(savedWorker, changedBy, WorkerLifecycleSource.ExcelImport);
            restored++;
          }
        } else {
          const worker = this.repo.create({
            ...row.fields,
            workerId: row.workerId,
            status: WorkerStatus.Active,
            qrStatus: QrStatus.Active,
            tenantId: tenantId || null,
          });
          savedWorker = (await this.repo.save(worker)) as unknown as Worker;
          created.push(savedWorker);
          await this.workerLifecycle.recordCreated(savedWorker, changedBy, WorkerLifecycleSource.ExcelImport);
        }
      } else {
        const count = await this.repo.count({ where: tenantId ? { tenantId } : {} });
        const finalId = `EST-${String(count + 1).padStart(3, '0')}`;
        const worker = this.repo.create({
          ...row.fields,
          workerId: finalId,
          status: WorkerStatus.Active,
          qrStatus: QrStatus.Active,
          tenantId: tenantId || null,
        });
        savedWorker = (await this.repo.save(worker)) as unknown as Worker;
        created.push(savedWorker);
        await this.workerLifecycle.recordCreated(savedWorker, changedBy, WorkerLifecycleSource.ExcelImport);
      }

      await this.ensureImportedForeman(savedWorker, row, tenantId);
    }

    let terminated = 0;
    if (excelWorkerIds.size > 0) {
      const activeWorkers = await this.repo.find({
        where: ACTIVE_WORKER_STATUSES.map(status => ({ status, ...(tenantId ? { tenantId } : {}) })),
      });
      const now = new Date();
      for (const w of activeWorkers) {
        if (w.workerId && !excelWorkerIds.has(w.workerId)) {
          w.status = WorkerStatus.Terminated;
          w.terminatedAt = now;
          w.terminationDate = this.dateOnly(now);
          w.terminationReason = 'Excel sanawynda ýok';
          w.terminationNote = 'Soňky import edilen Excel sanawynda bu işçi tapylmady.';
          const saved = await this.repo.save(w);
          await this.workerLifecycle.recordTerminated(
            saved,
            changedBy,
            WorkerLifecycleSource.ExcelImport,
            this.terminationLifecycleNote(saved),
          );
          terminated++;
        }
      }
    }

    return { imported: created.length, updated: updated.length, restored, terminated };
  }

  async importCardNumbers(buffer: Buffer, tenantId?: string) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length === 0) return { linked: 0, notFound: 0 };

    let linked = 0;
    let notFound = 0;
    const tenantFilter = tenantId ? { tenantId } : {};

    // Detect format by inspecting first row keys
    const firstRowKeys = Object.keys(rows[0]);
    const isScanFormat = firstRowKeys.includes('Sicil No') || firstRowKeys.includes('Kart UID');

    if (isScanFormat) {
      // Scans export format: #, Işçi Ady, Sicil No, Kart UID
      for (const row of rows) {
        const tabNo = String(row['Sicil No'] || '').trim();
        const cardUid = String(row['Kart UID'] || '').trim();
        if (!tabNo || !cardUid) continue;
        const worker = await this.repo.findOneBy({ workerId: tabNo, ...tenantFilter });
        if (worker) {
          worker.nfcCardUid = cardUid;
          await this.repo.save(worker);
          linked++;
        } else {
          notFound++;
        }
      }
    } else {
      // Legacy format: 2 title rows, then Табельный номер at __EMPTY_3, Карта № at __EMPTY_9
      const dataRows = rows.slice(2);
      for (const row of dataRows) {
        const tabNo = String(row['__EMPTY_3'] || '').trim();
        const cardNo = String(row['__EMPTY_9'] || '').trim();
        if (!tabNo || !cardNo) continue;
        const worker = await this.repo.findOneBy({ workerId: tabNo, ...tenantFilter });
        if (worker) {
          worker.nfcCardUid = cardNo;
          await this.repo.save(worker);
          linked++;
        } else {
          notFound++;
        }
      }
    }

    return { linked, notFound };
  }

  private parseWorkerImportRows(buffer: Buffer): ParsedWorkerImportRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const parsedRows: ParsedWorkerImportRow[] = [];

    rows.forEach((row, idx) => {
      const name = String(
        row['İnsan Adı'] || row['name'] || row['Name'] || row['ФИО'] ||
        `${row['Фамилия'] || ''} ${row['Имя'] || ''}`.trim(),
      ).trim();
      if (!name) return;

      const workerId = String(
        row['Sicil No'] || row['workerId'] || row['Worker ID'] ||
        row['Табельный номер'] || row['Таб. номер'] || row['ID'] || '',
      ).trim();
      const profession = String(
        row['Görev'] || row['profession'] || row['Профессия'] || '',
      ).trim();
      const brigadeName = String(
        row['EKIP'] || row['brigadeName'] || row['Brigade'] || row['Бригада'] || '',
      ).trim();
      const mesaiSistemi = String(
        row['Mesai Sistemi'] || row['mesaiSistemi'] || 'Saatlik',
      ).trim();
      const brigadeId = String(row['brigadeId'] || row['Brigade ID'] || '').trim();
      const phone = String(row['phone'] || row['Phone'] || row['Телефон'] || '').trim();
      const hireDate = String(row['hireDate'] || row['Hire Date'] || row['Дата найма'] || '').trim();

      // VARDIYA column: GUNDUZ → day, GECE → night
      const vardiyaRaw = String(row['VARDIYA'] || row['Vardiya'] || row['vardiya'] || row['shift'] || '').trim().toUpperCase();
      const shift = vardiyaRaw === 'GUNDUZ' ? 'day' : vardiyaRaw === 'GECE' ? 'night' : undefined;

      const profUpper = profession.toUpperCase().replace(/İ/g, 'I').replace(/Ş/g, 'S');
      const isSectionChief = profUpper.endsWith('SEFI') || profUpper.endsWith('SEF');
      const isForeman = profUpper.includes('FORMENI');
      const autoRole = isSectionChief
        ? MobileRole.SectionChief
        : isForeman
          ? MobileRole.Foreman
          : undefined;

      parsedRows.push({
        rowNumber: idx + 2,
        workerId,
        name,
        profession,
        brigadeName,
        mesaiSistemi,
        phone,
        hireDate,
        isSectionChief,
        isForeman,
        fields: {
          name,
          profession: profession || 'DUZ ISCI',
          brigadeId: brigadeId || '',
          brigadeName: brigadeName || '',
          phone: phone || undefined,
          hireDate: hireDate || undefined,
          mesaiSistemi: mesaiSistemi || 'Saatlik',
          ...(shift !== undefined ? { shift } : {}),
          ...(autoRole ? { mobileRole: autoRole } : {}),
        },
      });
    });

    return parsedRows;
  }

  private async findExistingByWorkerId(workerIds: string[], tenantId?: string) {
    if (workerIds.length === 0) return new Map<string, Worker>();
    const existing = await this.repo.find({
      where: workerIds.map(workerId => ({ workerId, ...(tenantId ? { tenantId } : {}) })),
    });
    return new Map(existing.map(worker => [worker.workerId, worker]));
  }

  private importPreviewItem(row: ParsedWorkerImportRow, existing?: Worker) {
    return {
      rowNumber: row.rowNumber,
      workerId: row.workerId || 'AUTO',
      name: row.name,
      profession: row.profession || 'DUZ ISCI',
      brigadeName: row.brigadeName,
      mesaiSistemi: row.mesaiSistemi || 'Saatlik',
      currentStatus: existing?.status ?? null,
    };
  }

  private workerPreviewItem(worker: Worker) {
    return {
      workerId: worker.workerId,
      name: worker.name,
      profession: worker.profession || '',
      brigadeName: worker.brigadeName || '',
      mesaiSistemi: worker.mesaiSistemi || 'Saatlik',
      currentStatus: worker.status,
    };
  }

  private async ensureImportedForeman(worker: Worker, row: ParsedWorkerImportRow, tenantId?: string) {
    if (row.isSectionChief || !row.isForeman) return;
    const existingForeman = await this.foremanRepo.findOneBy({
      workerId: worker.id,
      ...(tenantId ? { tenantId } : {}),
    });
    if (existingForeman) return;
    const byName = await this.foremanRepo.findOneBy({
      name: row.name,
      ...(tenantId ? { tenantId } : {}),
    });
    if (byName) return;

    const foreman = this.foremanRepo.create({
      name: row.name,
      phone: row.phone || null,
      workerId: worker.id,
      tenantId: tenantId || null,
    });
    const savedForeman = await this.foremanRepo.save(foreman);
    worker.foremanId = savedForeman.id;
    await this.repo.save(worker);
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
