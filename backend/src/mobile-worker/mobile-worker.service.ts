import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { MobileCredential } from '../mobile-auth/mobile-credential.entity';

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
    // Expand date range by 1 day on each side to account for timezone
    const startMs = new Date(startDate).getTime() - TZ_OFFSET_MS;
    const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 + TZ_OFFSET_MS;

    const events: { eventType: string; eventTime: string }[] =
      await this.eventRepo.query(
        `SELECT "eventType", "eventTime"
         FROM attendance_events
         WHERE "workerServerId" = $1
           AND CAST("eventTime" AS BIGINT) >= $2
           AND CAST("eventTime" AS BIGINT) <= $3
         ORDER BY "eventTime" ASC`,
        [workerEntityId, startMs, endMs],
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

    const records: { date: string; checkIn: number | null; checkOut: number | null; totalMinutes: number | null; status: string }[] = [];
    for (const [date, { ins, outs }] of byDate) {
      const checkIn = ins.length ? Math.min(...ins) : null;
      const checkOut = outs.length ? Math.max(...outs) : null;
      const totalMinutes =
        checkIn && checkOut ? Math.round((checkOut - checkIn) / 60000) : null;
      const status = !checkIn ? 'absent' : !checkOut ? 'partial' : 'present';
      records.push({ date, checkIn, checkOut, totalMinutes, status });
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
    const todayStr = localDate(Date.now());
    const startMs  = new Date(todayStr).getTime() - TZ_OFFSET_MS;
    const endMs    = startMs + 24 * 60 * 60 * 1000 + TZ_OFFSET_MS * 2;

    const events: { eventType: string; eventTime: string; source: string }[] =
      await this.eventRepo.query(
        `SELECT "eventType", "eventTime", "source"
         FROM attendance_events
         WHERE "workerServerId" = $1
           AND CAST("eventTime" AS BIGINT) >= $2
           AND CAST("eventTime" AS BIGINT) <= $3
         ORDER BY "eventTime" ASC`,
        [workerEntityId, startMs, endMs],
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
