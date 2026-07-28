import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ReportConfigService } from './report-config.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import type { ReportScheduleItem, MonthlySchedule } from './report-config.entity';

@UseGuards(AdminJwtGuard)
@Controller('report-config')
export class ReportConfigController {
  constructor(private readonly service: ReportConfigService) {}

  @Get()
  getConfig(@Req() req: any) {
    return this.service.getConfig(req.adminUser?.tenantId);
  }

  @Put()
  saveAll(
    @Req() req: any,
    @Body('emails') emails: string[],
    @Body('schedules') schedules: ReportScheduleItem[],
    @Body('monthlySchedule') monthlySchedule?: MonthlySchedule,
  ) {
    return this.service.saveAll(emails ?? [], schedules ?? [], monthlySchedule, req.adminUser?.tenantId);
  }
}
