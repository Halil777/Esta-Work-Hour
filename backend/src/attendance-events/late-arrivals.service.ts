import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import { AttendanceEvent } from './attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { APP_TZ, todayLocal, currentLocalMinutes } from '../common/date-utils';

@Injectable()
export class LateArrivalsService {
  constructor(
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  async getLateArrivals(foremanWorkerEntityId?: string, staffFilter?: 'staff' | 'workers') {
    const today = todayLocal();
    const currentMinutes = currentLocalMinutes();

    const shiftSettings: { shiftType: string; startTime: string; graceMinutes: number }[] =
      await this.eventRepo.query(`SELECT "shiftType", "startTime", "graceMinutes" FROM shift_settings`).catch(() => []);

    const settingsMap = new Map(shiftSettings.map(s => [s.shiftType, s]));
    const daySettings   = settingsMap.get('day')   ?? { startTime: '07:00', graceMinutes: 60 };
    const nightSettings = settingsMap.get('night') ?? { startTime: '18:00', graceMinutes: 60 };

    function parseMinutes(t: string): number {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }

    const dayDeadline   = parseMinutes(daySettings.startTime)   + Number(daySettings.graceMinutes);
    const nightDeadline = parseMinutes(nightSettings.startTime) + Number(nightSettings.graceMinutes);

    const lateShifts: string[] = [];
    if (currentMinutes >= dayDeadline)   lateShifts.push('day');
    if (currentMinutes >= nightDeadline) lateShifts.push('night');

    if (lateShifts.length === 0) return { workers: [], daySettings, nightSettings };

    const checkedIn: { employeeNumber: string }[] = await this.eventRepo.query(
      `SELECT DISTINCT "employeeNumber"
       FROM attendance_events
       WHERE DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE '${APP_TZ}') = $1
         AND "eventType" = 'CHECK_IN'`,
      [today],
    );
    const checkedInSet = new Set(checkedIn.map(r => r.employeeNumber));

    const includeNullShift = lateShifts.includes('day');

    let qb = this.workerRepo.createQueryBuilder('w')
      .where(
        includeNullShift
          ? '(w.shift IN (:...shifts) OR w.shift IS NULL)'
          : 'w.shift IN (:...shifts)',
        { shifts: lateShifts },
      )
      .andWhere('w.status != :terminated', { terminated: 'Terminated' });

    if (foremanWorkerEntityId) {
      qb = qb.andWhere('w.foremanId = :fid', { fid: foremanWorkerEntityId });
    }
    if (staffFilter === 'staff') {
      qb = qb.andWhere('w.isStaff = true');
    } else if (staffFilter === 'workers') {
      qb = qb.andWhere('w.isStaff = false');
    }

    const allWorkers = await qb.getMany();
    const lateWorkers = allWorkers.filter(w => !checkedInSet.has(w.workerId));

    const lateIds = lateWorkers.map(w => w.id);
    const absenceNotes: { workerEntityId: string; note: string; createdByName: string; createdBy: string }[] =
      lateIds.length > 0
        ? await this.eventRepo.query(
            `SELECT "workerEntityId", note, "createdByName", "createdBy"
             FROM absence_notes
             WHERE "workerEntityId" = ANY($1) AND date = $2`,
            [lateIds, today],
          ).catch(() => [])
        : [];
    const noteMap = new Map(absenceNotes.map(n => [n.workerEntityId, n]));

    return {
      workers: lateWorkers.map(w => ({
        workerEntityId: w.id,
        workerName:     w.name,
        workerId:       w.workerId,
        profession:     w.profession,
        brigadeName:    w.brigadeName,
        shift:          w.shift ?? (includeNullShift ? 'day' : null),
        isStaff:        w.isStaff,
        foremanId:      w.foremanId,
        absenceNote:    noteMap.get(w.id) ?? null,
      })),
      daySettings,
      nightSettings,
      date: today,
    };
  }

  async exportLateArrivalsExcel(foremanWorkerEntityId?: string, staffFilter?: 'staff' | 'workers'): Promise<Buffer> {
    const result = await this.getLateArrivals(foremanWorkerEntityId, staffFilter);
    const rows = result.workers.map(w => ({
      'İşçi adı':      w.workerName,
      'Sicil No':       w.workerId,
      'Görev':          w.profession,
      'Ekip':           w.brigadeName,
      'Shift':          w.shift === 'day' ? 'Gündiz' : w.shift === 'night' ? 'Gije' : '—',
      'Staff':          w.isStaff ? 'Hawa' : 'Ýok',
      'Sebäp':          w.absenceNote?.note ?? '—',
      'Bellik edilen':  w.absenceNote?.createdByName ?? '—',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gelmedi');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
