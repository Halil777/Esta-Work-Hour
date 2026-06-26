import { Controller, Post, Get, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AttendanceEventsService } from './attendance-events.service';
import { SyncEventsDto } from './dto/sync-events.dto';
import { JwtGuard } from '../mobile-auth/jwt.guard';
import { AdminGuard } from '../common/admin.guard';

@Controller('attendance')
export class AttendanceEventsController {
  constructor(private readonly service: AttendanceEventsService) {}

  @Post('sync')
  syncEvents(@Body() dto: SyncEventsDto) {
    return this.service.syncEvents(dto);
  }

  @UseGuards(AdminGuard)
  @Get('events')
  findAll(
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(date, limit ? Number(limit) : 500);
  }

  @UseGuards(AdminGuard)
  @Get('daily-summary')
  getDailySummary(@Query('date') date?: string) {
    return this.service.getDailySummary(date);
  }

  @UseGuards(AdminGuard)
  @Get('worker-summary')
  getWorkerSummary(
    @Query('workerEntityId') workerEntityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getWorkerAttendanceSummary(workerEntityId, startDate, endDate);
  }

  @UseGuards(AdminGuard)
  @Get('missing-checkouts')
  getMissingCheckouts(@Query('foremanWorkerEntityId') foremanWorkerEntityId?: string) {
    return this.service.getMissingCheckouts(foremanWorkerEntityId);
  }

  @UseGuards(AdminGuard)
  @Get('late-arrivals')
  getLateArrivals(
    @Query('foremanWorkerEntityId') foremanWorkerEntityId?: string,
    @Query('staffFilter') staffFilter?: 'staff' | 'workers',
  ) {
    return this.service.getLateArrivals(foremanWorkerEntityId, staffFilter);
  }

  @UseGuards(AdminGuard)
  @Get('late-arrivals/export')
  async exportLateArrivals(
    @Query('staffFilter') staffFilter: 'staff' | 'workers' | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.service.exportLateArrivalsExcel(undefined, staffFilter);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="late-arrivals-${date}.xlsx"`);
    res.send(buf);
  }
}

// Mobile/Foreman: missing checkouts (JWT required)
@Controller('mobile/foreman')
@UseGuards(JwtGuard)
export class MobileForemanAttendanceController {
  constructor(private readonly service: AttendanceEventsService) {}

  @Get('missing-checkouts')
  getMissingCheckouts(@Req() req: any) {
    return this.service.getMissingCheckouts(req.user.workerEntityId);
  }

  @Get('late-arrivals')
  getLateArrivals(@Req() req: any) {
    return this.service.getLateArrivals(req.user.workerEntityId);
  }
}
