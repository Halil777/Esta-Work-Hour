import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not } from 'typeorm';
import * as XLSX from 'xlsx';
import { Worker, WorkerStatus, QrStatus, MobileRole } from './worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Foreman } from '../foremans/foreman.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';

type WorkStats = { totalMs: number; firstIn: number | null; lastOut: number | null };

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
  ) {}

  async findAll(params: {
    search?: string;
    brigadeId?: string;
    status?: string;
    foremanId?: string;
    mobileRole?: string;
    startDate?: string;
    endDate?: string;
    noScan?: boolean;
  } = {}) {
    const { search, brigadeId, status, foremanId, mobileRole, startDate, endDate, noScan } = params;
    const where: any[] = [];
    const statusFilter = status && status !== 'all' ? (status as WorkerStatus) : undefined;
    const brigadeFilter = brigadeId && brigadeId !== 'all' ? brigadeId : undefined;
    const foremanFilter = foremanId && foremanId !== 'all' ? foremanId : undefined;
    const mobileRoleFilter = mobileRole && mobileRole !== 'all' ? mobileRole : undefined;

    const baseCondition: any = {
      // By default exclude Terminated; only show if explicitly filtered
      ...(statusFilter ? { status: statusFilter } : { status: Not(WorkerStatus.Terminated) }),
      ...(brigadeFilter ? { brigadeId: brigadeFilter } : {}),
      ...(foremanFilter ? { foremanId: foremanFilter } : {}),
      ...(mobileRoleFilter ? { mobileRole: mobileRoleFilter } : {}),
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
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE 'Asia/Ashgabat') >= $2
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE 'Asia/Ashgabat') <= $3
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [workerIds, startDate, endDate],
      );
    } else {
      // Current work day: today if local hour >= 07:00, else yesterday
      const now = new Date();
      let workDate: string;
      const localHour = now.getHours();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      if (localHour >= 7) {
        workDate = `${y}-${m}-${d}`;
      } else {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yy = yesterday.getFullYear();
        const ym = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yd = String(yesterday.getDate()).padStart(2, '0');
        workDate = `${yy}-${ym}-${yd}`;
      }
      allRecentEvents = await this.attendanceRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE "employeeNumber" = ANY($1)
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE 'Asia/Ashgabat') = $2
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
    const worker = await this.repo.findOneBy({ id });
    if (!worker) throw new NotFoundException(`Worker ${id} not found`);
    return worker;
  }

  async create(dto: CreateWorkerDto) {
    const count = await this.repo.count();
    const workerId = dto.workerId ?? `EST-${String(count + 1).padStart(3, '0')}`;
    const worker = this.repo.create({ ...dto, workerId });
    const saved = await this.repo.save(worker);
    await this.auditLog.log('Worker', saved.id, 'CREATE', 'Admin', null, saved);
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
    Object.assign(worker, sanitized);
    const saved = await this.repo.save(worker);
    await this.auditLog.log('Worker', id, 'UPDATE', changedBy, before, saved);
    return saved;
  }

  async remove(id: string, changedBy = 'Admin') {
    const worker = await this.findOne(id);
    await this.auditLog.log('Worker', id, 'DELETE', changedBy, worker, null);
    return this.repo.remove(worker);
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

  async importFromExcel(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const created: Worker[] = [];
    const updated: Worker[] = [];
    const excelWorkerIds = new Set<string>();

    for (const row of rows) {
      // Support both Excel format (Sicil No / İnsan Adı) and legacy format
      const name = String(
        row['İnsan Adı'] || row['name'] || row['Name'] || row['ФИО'] ||
        `${row['Фамилия'] || ''} ${row['Имя'] || ''}`.trim()
      ).trim();
      if (!name) continue;

      const workerId = String(
        row['Sicil No'] || row['workerId'] || row['Worker ID'] ||
        row['Табельный номер'] || row['Таб. номер'] || row['ID'] || ''
      ).trim();

      const profession = String(
        row['Görev'] || row['profession'] || row['Профессия'] || ''
      ).trim();

      const brigadeName = String(
        row['EKIP'] || row['brigadeName'] || row['Brigade'] || row['Бригада'] || ''
      ).trim();

      const mesaiSistemi = String(
        row['Mesai Sistemi'] || row['mesaiSistemi'] || 'Saatlik'
      ).trim();

      const brigadeId = String(row['brigadeId'] || row['Brigade ID'] || '').trim();
      const phone = String(row['phone'] || row['Phone'] || row['Телефон'] || '').trim();
      const hireDate = String(row['hireDate'] || row['Hire Date'] || row['Дата найма'] || '').trim();

      // Detect section chiefs: profession ends with SEFI / ŞEFI / ŞEFİ
      const profUpper = profession.toUpperCase().replace('İ', 'I').replace('Ş', 'S');
      const isSectionChief = profUpper.endsWith('SEFI') || profUpper.endsWith('SEF');

      // Detect foreman: profession contains FORMENI
      const isForeman = profession.toUpperCase().includes('FORMENI');

      const autoRole = isSectionChief
        ? MobileRole.SectionChief
        : isForeman
          ? MobileRole.Foreman
          : undefined;

      const fields: any = {
        name,
        profession: profession || 'DUZ ISCI',
        brigadeId: brigadeId || '',
        brigadeName: brigadeName || '',
        phone: phone || undefined,
        hireDate: hireDate || undefined,
        mesaiSistemi: mesaiSistemi || 'Saatlik',
        ...(autoRole ? { mobileRole: autoRole } : {}),
      };

      let savedWorker: Worker;

      if (workerId) {
        excelWorkerIds.add(workerId);
        const exists = await this.repo.findOneBy({ workerId });
        if (exists) {
          Object.assign(exists, fields);
          // Restore if previously terminated
          if (exists.status === WorkerStatus.Terminated) {
            exists.status = WorkerStatus.Active;
            exists.terminatedAt = null;
          }
          savedWorker = (await this.repo.save(exists)) as unknown as Worker;
          updated.push(savedWorker);
        } else {
          const worker = this.repo.create({
            ...fields,
            workerId,
            status: WorkerStatus.Active,
            qrStatus: QrStatus.Active,
          });
          savedWorker = (await this.repo.save(worker)) as unknown as Worker;
          created.push(savedWorker);
        }
      } else {
        const count = await this.repo.count();
        const finalId = `EST-${String(count + 1).padStart(3, '0')}`;
        const worker = this.repo.create({
          ...fields,
          workerId: finalId,
          status: WorkerStatus.Active,
          qrStatus: QrStatus.Active,
        });
        savedWorker = (await this.repo.save(worker)) as unknown as Worker;
        created.push(savedWorker);
      }

      // Auto-create foreman if Görev contains FORMENI (but not section chiefs)
      if (!isSectionChief && profession.toUpperCase().includes('FORMENI')) {
        const existingForeman = await this.foremanRepo.findOneBy({ workerId: savedWorker.id });
        if (!existingForeman) {
          const byName = await this.foremanRepo.findOneBy({ name });
          if (!byName) {
            const foreman = this.foremanRepo.create({
              name,
              phone: phone || null,
              workerId: savedWorker.id,
            });
            const savedForeman = await this.foremanRepo.save(foreman);
            savedWorker.foremanId = savedForeman.id;
            await this.repo.save(savedWorker);
          }
        }
      }
    }

    // Auto-terminate workers not present in the uploaded Excel
    let terminated = 0;
    if (excelWorkerIds.size > 0) {
      const activeWorkers = await this.repo.find({
        where: [
          { status: WorkerStatus.Active },
          { status: WorkerStatus.Inactive },
          { status: WorkerStatus.Suspended },
          { status: WorkerStatus.Transferred },
        ],
      });
      const now = new Date();
      for (const w of activeWorkers) {
        if (w.workerId && !excelWorkerIds.has(w.workerId)) {
          w.status = WorkerStatus.Terminated;
          w.terminatedAt = now;
          await this.repo.save(w);
          terminated++;
        }
      }
    }

    return { imported: created.length, updated: updated.length, terminated };
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
    const saved = await this.repo.save(worker);
    await this.auditLog.log('Worker', id, 'UPDATE', changedBy, before, saved);
    return saved;
  }
}
