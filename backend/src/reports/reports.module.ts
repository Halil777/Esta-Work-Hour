import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AttendanceOverridesModule } from '../attendance-overrides/attendance-overrides.module';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceEvent, Worker]), AttendanceOverridesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
