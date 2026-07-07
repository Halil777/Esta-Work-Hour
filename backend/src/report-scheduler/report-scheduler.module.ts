import { Module } from '@nestjs/common';
import { ReportSchedulerService } from './report-scheduler.service';
import { ReportSchedulerController } from './report-scheduler.controller';
import { ReportConfigModule } from '../report-config/report-config.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportConfigModule, ReportsModule],
  controllers: [ReportSchedulerController],
  providers: [ReportSchedulerService],
})
export class ReportSchedulerModule {}
