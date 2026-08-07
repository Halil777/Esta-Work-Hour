import { Controller, Get, Patch, Query, Body, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../mobile-auth/jwt.guard';
import { MobileWorkerService } from './mobile-worker.service';

@Controller('mobile/worker')
@UseGuards(JwtGuard)
export class MobileWorkerController {
  constructor(private readonly service: MobileWorkerService) {}

  @Get('me')
  getMe(@Req() req: any) {
    return this.service.getMe(req.user.workerEntityId);
  }

  @Get('attendance')
  getAttendance(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getAttendance(req.user.workerEntityId, startDate, endDate);
  }

  @Get('month-summary')
  getMonthSummary(@Req() req: any, @Query('month') month: string) {
    return this.service.getMonthSummary(req.user.workerEntityId, month);
  }

  @Get('today-events')
  getTodayEvents(@Req() req: any) {
    return this.service.getTodayEvents(req.user.workerEntityId);
  }

  @Patch('change-password')
  changePassword(
    @Req() req: any,
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.service.changePassword(req.user.workerEntityId, currentPassword, newPassword);
  }
}
