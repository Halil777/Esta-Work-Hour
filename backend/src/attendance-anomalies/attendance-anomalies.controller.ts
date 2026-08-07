import { Controller, Get, Patch, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { AttendanceAnomaliesService } from './attendance-anomalies.service';
import { ReportConfigService } from '../report-config/report-config.service';
import { todayLocal } from '../common/date-utils';

@Controller('admin/attendance-anomalies')
@UseGuards(AdminJwtGuard)
export class AttendanceAnomaliesController {
  constructor(
    private readonly service: AttendanceAnomaliesService,
    private readonly reportConfigService: ReportConfigService,
  ) {}

  @Get('missing-checkin')
  async getMissingCheckIn(
    @Request() req: any,
    @Query('date') date?: string,
  ) {
    const tenantId: string | undefined = req.adminUser?.tenantId;
    const targetDate = date || todayLocal();
    const workers = await this.service.getMissingCheckInWorkers(targetDate, tenantId);
    return { date: targetDate, count: workers.length, workers };
  }

  @Get('shift-alerts')
  async getShiftAlerts(@Request() req: any) {
    const tenantId: string | undefined = req.adminUser?.tenantId;
    return this.service.getShiftAlerts(tenantId);
  }

  @Get('missing-checkout')
  async getMissingCheckOut(@Request() req: any) {
    const tenantId: string | undefined = req.adminUser?.tenantId;
    const workers = await this.service.getMissingCheckOutWorkers(tenantId);
    return { count: workers.length, workers };
  }

  @Get('schedule')
  async getSchedule(@Request() req: any) {
    const tenantId: string | undefined = req.adminUser?.tenantId;
    return this.reportConfigService.getAnomalySchedule(tenantId);
  }

  @Patch('schedule')
  async updateSchedule(@Request() req: any, @Body() body: any) {
    const tenantId: string | undefined = req.adminUser?.tenantId;
    const { missingCheckInEnabled, shiftAlertEnabled, checkOutAlertEnabled } = body;
    return this.reportConfigService.updateAnomalySchedule(
      { missingCheckInEnabled, shiftAlertEnabled, checkOutAlertEnabled },
      tenantId,
    );
  }
}
