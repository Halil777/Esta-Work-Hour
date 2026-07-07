import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { ReportSchedulerService } from './report-scheduler.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { ReportType } from '../report-config/report-config.entity';

@UseGuards(AdminJwtGuard)
@Controller('report-config')
export class ReportSchedulerController {
  constructor(private readonly service: ReportSchedulerService) {}

  @Post('send-now')
  async sendNow(
    @Query('date') date?: string,
    @Query('reportType') reportType?: string,
  ) {
    await this.service.sendNow(date, (reportType as ReportType) ?? 'daily_all');
    return { ok: true, message: 'Hasabat iberildi' };
  }
}
