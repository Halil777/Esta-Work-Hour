import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, In } from 'typeorm';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { Worker, WorkerStatus, QrStatus, MobileRole } from './worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Foreman } from '../foremans/foreman.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { WorkerLifecycleService } from '../worker-lifecycle/worker-lifecycle.service';
import { WorkerLifecycleSource } from '../worker-lifecycle/worker-lifecycle-event.entity';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { TerminateWorkerDto } from './dto/terminate-worker.dto';
import { APP_TZ, todayLocal, yesterdayLocal } from '../common/date-utils';

type WorkStats = { totalMs: number; firstIn: number | null; lastOut: number | null };
type ParsedWorkerImportRow = {
  rowNumber: number;
  workerId: string;
  name: string;
  profession: string;
  brigadeName: string;
  mesaiSistemi: string;
  phone: string;
  hireDate: string;
  isSectionChief: boolean;
  isForeman: boolean;
  fields: Record<string, any>;
};

const ACTIVE_WORKER_STATUSES = [
  WorkerStatus.Active,
  WorkerStatus.Inactive,
  WorkerStatus.Suspended,
  WorkerStatus.Transferred,
];
const IMPORT_PREVIEW_SAMPLE_LIMIT = 12;

function computeWorkStats(events: { eventType: string; eventTime: number }[]): WorkStats {
  let totalMs = 0;
  let clockIn: number | null = null;
  let firstIn: number | null = null;
  let lastOut: number | null = null;

  for (const ev of events) {
    if (ev.eventType === 'CHECK_IN') {
      if (clockIn === null) clockIn = ev.eventTime;
      if (firstIn === null) firstIn = ev.eventTime;
    } else {
      if (clockIn !== null) {
        totalMs += ev.eventTime - clockIn;
        clockIn = null;
      }
      lastOut = ev.eventTime;
    }
  }

  return { totalMs, firstIn, lastOut };
}

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(Worker)
    private readonly repo: Repository<Worker>,
    @InjectRepository(AttendanceEvent)
    private readonly attendanceRepo: Repository<AttendanceEvent>,
    @InjectRepository(Foreman)
    private readonly foremanRepo: Repository<Foreman>,
    private readonly auditLog: AuditLogService,
    private readonly workerLifecycle: WorkerLifecycleService,
  ) {}

  async findAll(params: {
    search?: string;
    brigadeId?: string;
    status?: string;
    foremanId?: string;
    mobileRole?: string;
    mesaiSistemi?: string;
    startDate?: string;
    endDate?: string;
    noScan?: boolean;
  } = {}) {
    const { search, brigadeId, status, foremanId, mobileRole, mesaiSistemi, startDate, endDate, noScan } = params;
    const where: any[] = [];
    const statusFilter = status && status !== 'all' ? (status as WorkerStatus) : undefined;
    const brigadeFilter = brigadeId && brigadeId !== 'all' ? brigadeId : undefined;
    const foremanFilter = foremanId && foremanId !== 'all' ? foremanId : undefined;
    const mobileRoleFilter = mobileRole && mobileRole !== 'all' ? mobileRole : undefined;

    const mesaiFilter = mesaiSistemi && mesaiSistemi !== 'all' ? mesaiSistemi : undefined;

    const baseCondition: any = {
      // By default exclude Terminated; only show if explicitly filtered
      ...(statusFilter ? { status: statusFilter } : { status: Not(WorkerStatus.Terminated) }),
      ...(brigadeFilter ? { brigadeId: brigadeFilter } : {}),
      ...(foremanFilter ? { foremanId: foremanFilter } : {}),
      ...(mobileRoleFilter ? { mobileRole: mobileRoleFilter } : {}),
      ...(mesaiFilter ? { mesaiSistemi: mesaiFilter } : {}),
    };

    if (search) {
      for (const cond of [{ name: ILike(`%${search}%`) }, { workerId: ILike(`%${search}%`) }]) {
        where.push({ ...cond, ...baseCondition });
      }
    } else {
      where.push(baseCondition);
    }

    const workers = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    if (workers.length === 0) return [];

    const workerIds = workers.map(w => w.workerId).filter(Boolean);
    if (workerIds.length === 0) return workers;

    let allRecentEvents: { employeeNumber: string; eventType: string; eventTime: string }[];

    if (startDate && endDate) {
      // Date range filter: get events within the given range
      allRecentEvents = await this.attendanceRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE "employeeNumber" = ANY($1)
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') >= $2
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') <= $3
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [workerIds, startDate, endDate],
      );
    } else {
      // Current work day: today if local hour >= 07:00, else yesterday
      const workDate = new Date().getHours() >= 7 ? todayLocal() : yesterdayLocal();
      allRecentEvents = await this.attendanceRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE "employeeNumber" = ANY($1)
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $2
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [workerIds, workDate],
      );
    }

    const eventsByWorker = new Map<string, { eventType: string; eventTime: number }[]>();
    for (const ev of allRecentEvents) {
      const arr = eventsByWorker.get(ev.employeeNumber) ?? [];
      arr.push({ eventType: ev.eventType, eventTime: Number(ev.eventTime) });
      eventsByWorker.set(ev.employeeNumber, arr);
    }

    const statsByWorker = new Map<string, WorkStats>();
    for (const [empNum, events] of eventsByWorker) {
      statsByWorker.set(empNum, computeWorkStats(events));
    }

    const result = workers.map(w => {
      const stats = statsByWorker.get(w.workerId);
      return {
        ...w,
        lastCheckIn: stats?.firstIn ?? null,
        lastCheckOut: stats?.lastOut ?? null,
        todayHoursMs: stats?.totalMs ?? null,
      };
    });

    // noScan filter: workers with no attendance events in the period
    if (noScan) {
      return result.filter(w => !eventsByWorker.has(w.workerId));
    }

    return result;
  }

  async findOne(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('Invalid worker id');
    }
    const worker = await this.repo.findOneBy({ id });
    if (!worker) throw new NotFoundException(`Worker ${id} not found`);
    return worker;
  }

  async create(dto: CreateWorkerDto, changedBy = 'Admin') {
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

    const count = await this.repo.count();
    const workerId = sanitized.workerId?.trim() || `EST-${String(count + 1).padStart(3, '0')}`;
    const worker = this.repo.create({ ...sanitized, workerId }) as unknown as Worker;
    const saved = (await this.repo.save(worker)) as Worker;
    await this.auditLog.log('Worker', saved.id, 'CREATE', changedBy, null, saved);
    await this.workerLifecycle.recordCreated(saved, changedBy, WorkerLifecycleSource.Manual);
    return saved;
  }

  async update(id: string, dto: UpdateWorkerDto, changedBy = 'Admin') {
    const worker = await this.findOne(id);
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
    const worker = await this.findOne(id);
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

  async uploadPhoto(id: string, file: Express.Multer.File): Promise<{ photoUrl: string }> {
    const worker = await this.findOne(id);
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

  async exportToExcel(): Promise<Buffer> {
    const workers = await this.findAll({}) as any[];

    const fmtTime = (ts: number | null) => {
      if (!ts) return '';
      return new Date(ts).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    };

    const fmtDuration = (ms: number | null): string => {
      if (!ms || ms <= 0) return '';
      const totalMin = Math.round(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      if (h === 0) return `${m} min`;
      if (m === 0) return `${h} sag`;
      return `${h} sag ${m} min`;
    };

    const rows = workers.map(w => ({
      'Sicil No': w.workerId,
      'İnsan Adı': w.name,
      'Görev': w.profession || '',
      'GIRIS SAATI': fmtTime(w.lastCheckIn ?? null),
      'CIKIS SAATI': fmtTime(w.lastCheckOut ?? null),
      'TOPLAM SAATI': w.mesaiSistemi === 'Aylık' ? '8 sag' : fmtDuration(w.todayHoursMs ?? null),
      'HAKYKY SAAT': fmtDuration(w.todayHoursMs ?? null),
      'YAPILAN IS': '',
      'EKIP': w.brigadeName || '',
      'Mesai Sistemi': w.mesaiSistemi || 'Saatlik',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workers');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async previewImportFromExcel(buffer: Buffer) {
    const parsedRows = this.parseWorkerImportRows(buffer);
    const excelWorkerIds = new Set(parsedRows.map(r => r.workerId).filter(Boolean));
    const existingByWorkerId = await this.findExistingByWorkerId([...excelWorkerIds]);

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
        where: ACTIVE_WORKER_STATUSES.map(status => ({ status })),
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

  async importFromExcel(buffer: Buffer, changedBy = 'Admin') {
    const parsedRows = this.parseWorkerImportRows(buffer);

    const created: Worker[] = [];
    const updated: Worker[] = [];
    const excelWorkerIds = new Set<string>();
    let restored = 0;

    for (const row of parsedRows) {
      let savedWorker: Worker;

      if (row.workerId) {
        excelWorkerIds.add(row.workerId);
        const exists = await this.repo.findOneBy({ workerId: row.workerId });
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
          });
          savedWorker = (await this.repo.save(worker)) as unknown as Worker;
          created.push(savedWorker);
          await this.workerLifecycle.recordCreated(savedWorker, changedBy, WorkerLifecycleSource.ExcelImport);
        }
      } else {
        const count = await this.repo.count();
        const finalId = `EST-${String(count + 1).padStart(3, '0')}`;
        const worker = this.repo.create({
          ...row.fields,
          workerId: finalId,
          status: WorkerStatus.Active,
          qrStatus: QrStatus.Active,
        });
        savedWorker = (await this.repo.save(worker)) as unknown as Worker;
        created.push(savedWorker);
        await this.workerLifecycle.recordCreated(savedWorker, changedBy, WorkerLifecycleSource.ExcelImport);
      }

      await this.ensureImportedForeman(savedWorker, row);
    }

    let terminated = 0;
    if (excelWorkerIds.size > 0) {
      const activeWorkers = await this.repo.find({
        where: ACTIVE_WORKER_STATUSES.map(status => ({ status })),
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
          ...(autoRole ? { mobileRole: autoRole } : {}),
        },
      });
    });

    return parsedRows;
  }

  private async findExistingByWorkerId(workerIds: string[]) {
    if (workerIds.length === 0) return new Map<string, Worker>();
    const existing = await this.repo.find({ where: { workerId: In(workerIds) } });
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

  private async ensureImportedForeman(worker: Worker, row: ParsedWorkerImportRow) {
    if (row.isSectionChief || !row.isForeman) return;
    const existingForeman = await this.foremanRepo.findOneBy({ workerId: worker.id });
    if (existingForeman) return;
    const byName = await this.foremanRepo.findOneBy({ name: row.name });
    if (byName) return;

    const foreman = this.foremanRepo.create({
      name: row.name,
      phone: row.phone || null,
      workerId: worker.id,
    });
    const savedForeman = await this.foremanRepo.save(foreman);
    worker.foremanId = savedForeman.id;
    await this.repo.save(worker);
  }

  async importCardNumbers(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    // The file has 2 header rows before actual data:
    // Row 0: merged title "Отчет Сотрудники"
    // Row 1: column names (Фамилия, Имя, ..., Табельный номер, ..., Карта №, ...)
    // Row 2+: actual data
    // When parsed, __EMPTY_3 = Табельный номер, __EMPTY_9 = Карта №
    const dataRows = rows.slice(2);

    let linked = 0;
    let notFound = 0;

    for (const row of dataRows) {
      const tabNo = String(row['__EMPTY_3'] || '').trim();
      const cardNo = String(row['__EMPTY_9'] || '').trim();
      if (!tabNo || !cardNo) continue;

      const worker = await this.repo.findOneBy({ workerId: tabNo });
      if (worker) {
        worker.nfcCardUid = cardNo;
        await this.repo.save(worker);
        linked++;
      } else {
        notFound++;
      }
    }

    return { linked, notFound };
  }

  async findTerminated(search?: string) {
    const where: any[] = [];
    if (search) {
      where.push({ status: WorkerStatus.Terminated, name: ILike(`%${search}%`) });
      where.push({ status: WorkerStatus.Terminated, workerId: ILike(`%${search}%`) });
    } else {
      where.push({ status: WorkerStatus.Terminated });
    }
    return this.repo.find({ where, order: { terminatedAt: 'DESC' } });
  }

  async restoreWorker(id: string, changedBy = 'Admin') {
    const worker = await this.findOne(id);
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
