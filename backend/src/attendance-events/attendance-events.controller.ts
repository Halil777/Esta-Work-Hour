import { Controller, Post, Get, Body, Query, Req, Res, UseGuards, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { AttendanceEventsService } from './attendance-events.service';
import { SyncEventsDto } from './dto/sync-events.dto';
import { JwtGuard } from '../mobile-auth/jwt.guard';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@Controller('attendance')
export class AttendanceEventsController {
  constructor(private readonly service: AttendanceEventsService) {}

  @Post('sync')
  syncEvents(@Body() dto: SyncEventsDto) {
    return this.service.syncEvents(dto);
  }

  @UseGuards(AdminJwtGuard)
  @Get('events/export')
  async exportEvents(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('date') date?: string,
  ): Promise<StreamableFile> {
    const buffer = await this.service.exportEventsExcel(date, req.adminUser?.tenantId);
    const label = date ?? new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="scans-${label}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @UseGuards(AdminJwtGuard)
  @Get('events')
  findAll(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(date, limit ? Number(limit) : 500, req.adminUser?.tenantId);
  }

  @UseGuards(AdminJwtGuard)
  @Get('daily-summary')
  getDailySummary(@Req() req: any, @Query('date') date?: string) {
    return this.service.getDailySummary(date, req.adminUser?.tenantId);
  }

  @UseGuards(AdminJwtGuard)
  @Get('worker-summary')
  getWorkerSummary(
    @Query('workerEntityId') workerEntityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getWorkerAttendanceSummary(workerEntityId, startDate, endDate);
  }

  @UseGuards(AdminJwtGuard)
  @Get('missing-checkouts')
  getMissingCheckouts(@Query('foremanWorkerEntityId') foremanWorkerEntityId?: string) {
    return this.service.getMissingCheckouts(foremanWorkerEntityId);
  }

  @UseGuards(AdminJwtGuard)
  @Get('late-arrivals')
  getLateArrivals(
    @Req() req: any,
    @Query('foremanWorkerEntityId') foremanWorkerEntityId?: string,
    @Query('staffFilter') staffFilter?: 'staff' | 'workers',
  ) {
    return this.service.getLateArrivals(foremanWorkerEntityId, staffFilter, req.adminUser?.tenantId);
  }

  @UseGuards(AdminJwtGuard)
  @Get('late-arrivals/export')
  async exportLateArrivals(
    @Req() req: any,
    @Query('staffFilter') staffFilter: 'staff' | 'workers' | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.service.exportLateArrivalsExcel(undefined, staffFilter, req.adminUser?.tenantId);
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
