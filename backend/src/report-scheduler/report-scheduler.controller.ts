import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { ReportSchedulerService } from './report-scheduler.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('report-config')
export class ReportSchedulerController {
  constructor(private readonly service: ReportSchedulerService) {}

  @Post('send-now')
  async sendNow(@Query('date') date?: string) {
    await this.service.sendNow(date);
    return { ok: true, message: 'Hasabat iberildi' };
  }
}
