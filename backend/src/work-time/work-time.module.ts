import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { AttendanceOverride } from '../attendance-overrides/attendance-override.entity';
import { WorkAdjustment } from '../work-adjustments/work-adjustment.entity';
import { WorkTimeService } from './work-time.service';
import { WorkTimeController } from './work-time.controller';
import { ADMIN_JWT_SECRET } from '../admin-auth/admin-auth.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, AttendanceEvent, AttendanceOverride, WorkAdjustment]),
    JwtModule.register({ secret: ADMIN_JWT_SECRET }),
  ],
  providers:   [WorkTimeService],
  controllers: [WorkTimeController],
  exports:     [WorkTimeService],
})
export class WorkTimeModule {}
