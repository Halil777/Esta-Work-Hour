import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { Tenant } from '../tenants/tenant.entity';
import { ShiftSettingsModule } from '../shift-settings/shift-settings.module';
import { ReportConfigModule } from '../report-config/report-config.module';
import { AttendanceAnomaliesService } from './attendance-anomalies.service';
import { AttendanceAnomaliesController } from './attendance-anomalies.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceEvent, Worker, Tenant]),
    ShiftSettingsModule,
    ReportConfigModule,
  ],
  providers: [AttendanceAnomaliesService],
  controllers: [AttendanceAnomaliesController],
})
export class AttendanceAnomaliesModule {}
