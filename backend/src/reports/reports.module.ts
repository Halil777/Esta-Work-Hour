import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AttendanceOverridesModule } from '../attendance-overrides/attendance-overrides.module';
import { ShiftSettingsModule } from '../shift-settings/shift-settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceEvent, Worker]), AttendanceOverridesModule, ShiftSettingsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
