import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEvent } from './attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { AttendanceEventsController, MobileForemanAttendanceController } from './attendance-events.controller';
import { AttendanceEventsService } from './attendance-events.service';
import { LateArrivalsService } from './late-arrivals.service';
import { MissingCheckoutsService } from './missing-checkouts.service';
import { AttendanceOverridesModule } from '../attendance-overrides/attendance-overrides.module';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceEvent, Worker]), AttendanceOverridesModule],
  controllers: [AttendanceEventsController, MobileForemanAttendanceController],
  providers: [AttendanceEventsService, LateArrivalsService, MissingCheckoutsService],
  exports: [AttendanceEventsService],
})
export class AttendanceEventsModule {}
