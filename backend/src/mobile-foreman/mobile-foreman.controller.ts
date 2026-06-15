import {
  Controller, Get, Post, Delete, Patch,
  Param, Body, Req, UseGuards,
  ForbiddenException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, In, Repository } from 'typeorm';
import { Worker, MobileRole } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { JwtGuard } from '../mobile-auth/jwt.guard';

@Controller('mobile/foreman')
@UseGuards(JwtGuard)
export class MobileForemanController {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(AttendanceEvent)
    private readonly attendanceRepo: Repository<AttendanceEvent>,
  ) {}

  // ─── My workers with today's NFC attendance ──────────────────────────────────
  @Get('workers')
  async myWorkers(@Req() req: any) {
    const foremanEntityId = req.user.workerEntityId;
    const workers = await this.workerRepo.find({
      where: { foremanId: foremanEntityId, mobileRole: MobileRole.Worker },
      order: { name: 'ASC' },
    });
    if (workers.length === 0) return [];

    const workerIds = workers.map(w => w.workerId).filter(Boolean);
    const now = new Date();
    const localHour = now.getHours();
    let workDate: string;
    if (localHour >= 7) {
      workDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      workDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    }

    const events: { employeeNumber: string; eventType: string; eventTime: string }[] =
      await this.attendanceRepo.query(
        `SELECT "employeeNumber", "eventType", "eventTime"
         FROM attendance_events
         WHERE "employeeNumber" = ANY($1)
           AND DATE(to_timestamp("eventTime" / 1000.0) AT TIME ZONE 'Asia/Ashgabat') = $2
         ORDER BY "employeeNumber", "eventTime" ASC`,
        [workerIds, workDate],
      );

    const statsMap = new Map<string, { firstIn: number | null; lastOut: number | null; totalMs: number }>();
    let clockIns = new Map<string, number>();

    for (const ev of events) {
      const t = Number(ev.eventTime);
      if (!statsMap.has(ev.employeeNumber)) {
        statsMap.set(ev.employeeNumber, { firstIn: null, lastOut: null, totalMs: 0 });
      }
      const s = statsMap.get(ev.employeeNumber)!;
      if (ev.eventType === 'CHECK_IN') {
        if (s.firstIn === null) s.firstIn = t;
        clockIns.set(ev.employeeNumber, t);
      } else {
        const ci = clockIns.get(ev.employeeNumber);
        if (ci !== undefined) { s.totalMs += t - ci; clockIns.delete(ev.employeeNumber); }
        s.lastOut = t;
      }
    }

    return workers.map(w => {
      const s = statsMap.get(w.workerId);
      return {
        id: w.id,
        workerId: w.workerId,
        name: w.name,
        profession: w.profession,
        brigadeName: w.brigadeName,
        status: w.status,
        mesaiSistemi: w.mesaiSistemi,
        extraSaat: w.extraSaat,
        shift: w.shift,
        lastCheckIn: s?.firstIn ?? null,
        lastCheckOut: s?.lastOut ?? null,
        todayHoursMs: s?.totalMs ?? null,
      };
    });
  }

  // ─── Unassigned workers (mobileRole=worker only) ─────────────────────────────
  @Get('unassigned-workers')
  async unassignedWorkers() {
    return this.workerRepo.find({
      where: { foremanId: IsNull(), mobileRole: MobileRole.Worker },
      order: { name: 'ASC' },
      select: ['id', 'workerId', 'name', 'profession', 'brigadeName', 'status', 'mesaiSistemi'],
    });
  }

  // ─── Bulk claim workers ───────────────────────────────────────────────────────
  @Post('workers/claim-bulk')
  async claimBulk(
    @Body('workerIds') workerIds: string[],
    @Body('shift') shift: 'day' | 'night' | null,
    @Req() req: any,
  ) {
    if (!Array.isArray(workerIds) || workerIds.length === 0) {
      throw new BadRequestException('workerIds array boş');
    }
    const foremanEntityId = req.user.workerEntityId;
    const workers = await this.workerRepo.find({
      where: { id: In(workerIds), foremanId: IsNull(), mobileRole: MobileRole.Worker },
    });
    for (const w of workers) {
      w.foremanId = foremanEntityId;
      if (shift) w.shift = shift;
    }
    return this.workerRepo.save(workers);
  }

  // ─── Claim single worker ──────────────────────────────────────────────────────
  @Post('workers/:workerId/claim')
  async claimWorker(@Param('workerId') workerId: string, @Req() req: any) {
    const worker = await this.workerRepo.findOneBy({ id: workerId });
    if (!worker) throw new NotFoundException('Işçi tapylmady');
    if (worker.foremanId !== null) throw new ForbiddenException('Bu işçi başga formene birikdirilen');
    if (worker.mobileRole !== MobileRole.Worker) throw new ForbiddenException('Diňe işçileri öz üstüňe alyp bolýar');
    worker.foremanId = req.user.workerEntityId;
    return this.workerRepo.save(worker);
  }

  // ─── Release worker ───────────────────────────────────────────────────────────
  @Delete('workers/:workerId/release')
  async releaseWorker(@Param('workerId') workerId: string, @Req() req: any) {
    const worker = await this.workerRepo.findOneBy({ id: workerId });
    if (!worker) throw new NotFoundException('Işçi tapylmady');
    if (worker.foremanId !== req.user.workerEntityId) throw new ForbiddenException('Bu işçi siziň agzaňyz däl');
    worker.foremanId = null;
    worker.shift = null;
    return this.workerRepo.save(worker);
  }

  // ─── Set shift ────────────────────────────────────────────────────────────────
  @Patch('workers/:workerId/shift')
  async setShift(@Param('workerId') workerId: string, @Body('shift') shift: 'day' | 'night', @Req() req: any) {
    const worker = await this.workerRepo.findOneBy({ id: workerId });
    if (!worker) throw new NotFoundException('Işçi tapylmady');
    if (worker.foremanId !== req.user.workerEntityId) throw new ForbiddenException('Bu işçi siziň agzaňyz däl');
    worker.shift = shift;
    return this.workerRepo.save(worker);
  }

  // ─── Site chiefs list ─────────────────────────────────────────────────────────
  @Get('site-chiefs')
  async siteChiefs() {
    return this.workerRepo.find({
      where: { mobileRole: MobileRole.SiteChief },
      order: { name: 'ASC' },
      select: ['id', 'workerId', 'name', 'profession'],
    });
  }
}
