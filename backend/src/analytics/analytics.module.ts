import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { Tenant } from '../tenants/tenant.entity';
import { ReportConfigModule } from '../report-config/report-config.module';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEvent, Worker, Tenant]),
    ReportConfigModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
