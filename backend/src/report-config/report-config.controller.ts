import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ReportConfigService } from './report-config.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { ReportScheduleItem } from './report-config.entity';

@UseGuards(AdminJwtGuard)
@Controller('report-config')
export class ReportConfigController {
  constructor(private readonly service: ReportConfigService) {}

  @Get()
  getConfig() {
    return this.service.getConfig();
  }

  @Put()
  saveAll(
    @Body('emails') emails: string[],
    @Body('schedules') schedules: ReportScheduleItem[],
  ) {
    return this.service.saveAll(emails ?? [], schedules ?? []);
  }
}
