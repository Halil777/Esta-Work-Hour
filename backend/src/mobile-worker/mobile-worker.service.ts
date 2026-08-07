import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { MobileCredential } from '../mobile-auth/mobile-credential.entity';
import { AttendanceOverride } from '../attendance-overrides/attendance-override.entity';

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3 Moscow/Tatarstan

function localDate(tsMs: number): string {
  return new Date(tsMs + TZ_OFFSET_MS).toISOString().split('T')[0];
}

@Injectable()
export class MobileWorkerService {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(AttendanceEvent)
    private readonly eventRepo: Repository<AttendanceEvent>,
    @InjectRepository(MobileCredential)
    private readonly credRepo: Repository<MobileCredential>,
    @InjectRepository(AttendanceOverride)
    private readonly overrideRepo: Repository<AttendanceOverride>,
  ) {}

  async getMe(workerEntityId: string) {
    const worker = await this.workerRepo.findOneBy({ id: workerEntityId });
    if (!worker) throw new NotFoundException('Worker tapylmady');
    return {
      id: worker.id,
      workerId: worker.workerId,
      name: worker.name,
      profession: worker.profession || null,
      brigadeName: worker.brigadeName || null,
      shift: worker.shift ?? null,
      mesaiSistemi: worker.mesaiSistemi ?? null,
      status: worker.status,
      mobileRole: worker.mobileRole,
    };
  }

  async getAttendance(workerEntityId: string, startDate: string, endDate: string) {
    const worker = await this.workerRepo.findOneBy({ id: workerEntityId });
    if (!worker) throw new NotFoundException('Worker tapylmady');

    // Expand date range by 1 day on each side to account for timezone
    const startMs = new Date(startDate).getTime() - TZ_OFFSET_MS;
    const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 + TZ_OFFSET_MS;

    // Match by employeeNumber (Sicil No) OR workerServerId (UUID) — events may have either
    const events: { eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT "eventType", "eventTime"
         FROM attendance_events
         WHERE ("employeeNumber" = $1 OR "workerServerId" = $2)
           AND CAST("eventTime" AS BIGINT) >= $3
           AND CAST("eventTime" AS BIGINT) <= $4
         ORDER BY "eventTime" ASC`,
        [worker.workerId, workerEntityId, startMs, endMs],
      );

    // Group events by local date (UTC+3)
    const byDate = new Map<string, { ins: number[]; outs: number[] }>();
    for (const ev of events) {
      const ms = Number(ev.eventTime);
      const date = localDate(ms);
      if (date < startDate || date > endDate) continue;
      if (!byDate.has(date)) byDate.set(date, { ins: [], outs: [] });
      const day = byDate.get(date)!;
      if (ev.eventType === 'CHECK_IN') day.ins.push(ms);
      else day.outs.push(ms);
    }

    const scanRecords: { date: string; checkIn: number | null; checkOut: number | null; totalMinutes: number | null; status: string; adminCorrected?: boolean; originalCheckIn?: number | null; originalCheckOut?: number | null }[] = [];
    for (const [date, { ins, outs }] of byDate) {
      const checkIn = ins.length ? Math.min(...ins) : null;
      const checkOut = outs.length ? Math.max(...outs) : null;
      const totalMinutes =
        checkIn && checkOut ? Math.round((checkOut - checkIn) / 60000) : null;
      const status = !checkIn ? 'absent' : !checkOut ? 'partial' : 'present';
      scanRecords.push({ date, checkIn, checkOut, totalMinutes, status });
    }

    // Merge admin overrides
    const overrides = await this.overrideRepo.find({
      where: { workerEntityId, date: Between(startDate, endDate) },
    });
    const overrideMap = new Map(overrides.map(o => [o.date, o]));

    const records = [...scanRecords];
    for (const [date, ov] of overrideMap) {
      const existing = records.find(r => r.date === date);
      const effectiveCheckIn  = ov.checkInMs  ?? (existing?.checkIn  ?? null);
      const effectiveCheckOut = ov.checkOutMs ?? (existing?.checkOut ?? null);
      const correctedMinutes  = effectiveCheckIn && effectiveCheckOut
        ? Math.round((Number(effectiveCheckOut) - Number(effectiveCheckIn)) / 60000)
        : null;
      const correctedStatus = !effectiveCheckIn ? 'absent' : !effectiveCheckOut ? 'partial' : 'present';
      if (existing) {
        existing.adminCorrected  = true;
        existing.originalCheckIn  = existing.checkIn;
        existing.originalCheckOut = existing.checkOut;
        existing.checkIn          = effectiveCheckIn ? Number(effectiveCheckIn) : null;
        existing.checkOut         = effectiveCheckOut ? Number(effectiveCheckOut) : null;
        existing.totalMinutes     = correctedMinutes;
        existing.status           = correctedStatus;
      } else {
        records.push({
          date,
          checkIn:        effectiveCheckIn  ? Number(effectiveCheckIn)  : null,
          checkOut:       effectiveCheckOut ? Number(effectiveCheckOut) : null,
          totalMinutes:   correctedMinutes,
          status:         correctedStatus,
          adminCorrected: true,
          originalCheckIn:  null,
          originalCheckOut: null,
        });
      }
    }

    return records.sort((a, b) => b.date.localeCompare(a.date));
  }

  async getMonthSummary(workerEntityId: string, month: string) {
    // month = "YYYY-MM"
    const startDate = `${month}-01`;
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
    const endDate = d.toISOString().split('T')[0];

    const records = await this.getAttendance(workerEntityId, startDate, endDate);
    const presentDays = records.filter(r => r.status !== 'absent').length;
    const totalMinutes = records.reduce((s, r) => s + (r.totalMinutes ?? 0), 0);

    return { month, presentDays, totalMinutes, records };
  }

  async getTodayEvents(workerEntityId: string) {
    const worker = await this.workerRepo.findOneBy({ id: workerEntityId });
    if (!worker) throw new NotFoundException('Worker tapylmady');

    const todayStr = localDate(Date.now());
    const startMs  = new Date(todayStr).getTime() - TZ_OFFSET_MS;
    const endMs    = startMs + 24 * 60 * 60 * 1000 + TZ_OFFSET_MS * 2;

    const events: { eventType: string; eventTime: string; source: string }[] =
      await this.eventRepo.query(
        `SELECT "eventType", "eventTime", "source"
         FROM attendance_events
         WHERE ("employeeNumber" = $1 OR "workerServerId" = $2)
           AND CAST("eventTime" AS BIGINT) >= $3
           AND CAST("eventTime" AS BIGINT) <= $4
         ORDER BY "eventTime" ASC`,
        [worker.workerId, workerEntityId, startMs, endMs],
      );

    return events
      .filter(ev => localDate(Number(ev.eventTime)) === todayStr)
      .map(ev => ({
        eventType: ev.eventType,
        eventTime: Number(ev.eventTime),
        source: ev.source || 'NFC',
      }));
  }

  async changePassword(workerEntityId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 4)
      throw new BadRequestException('New password must be at least 4 characters');

    const cred = await this.credRepo.findOneBy({ workerEntityId, isActive: true });
    if (!cred) throw new NotFoundException('Credentials not found');

    const valid = await bcrypt.compare(currentPassword, cred.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    cred.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.credRepo.save(cred);
    return { success: true };
  }
}
