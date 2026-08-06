import { Controller, Get, Post, Patch, Query, Body, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('attendance-chart')
  getAttendanceChart(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.service.getAttendanceChart(startDate, endDate, req.adminUser?.tenantId);
  }

  @Get('top-workers')
  getTopWorkers(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getTopWorkers(startDate, endDate, limit ? parseInt(limit) : 10, req.adminUser?.tenantId);
  }

  @Get('dashboard-schedule')
  getDashboardSchedule(@Req() req: any) {
    return this.service.getDashboardSchedule(req.adminUser?.tenantId);
  }

  @Patch('dashboard-schedule')
  updateDashboardSchedule(@Req() req: any, @Body() body: any) {
    return this.service.updateDashboardSchedule(body, req.adminUser?.tenantId);
  }

  @Post('send-dashboard')
  async sendDashboard(@Req() req: any, @Body() body: { startDate: string; endDate: string; emails?: string[] }) {
    const tenantName = req.adminUser?.tenantName ?? 'WorkForce';
    await this.service.sendDashboardEmailNow(
      body.startDate,
      body.endDate,
      req.adminUser?.tenantId,
      tenantName,
      body.emails,
    );
    return { ok: true };
  }
}
