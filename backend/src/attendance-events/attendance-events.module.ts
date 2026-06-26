import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEvent } from './attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { AttendanceEventsController, MobileForemanAttendanceController } from './attendance-events.controller';
import { AttendanceEventsService } from './attendance-events.service';
import { LateArrivalsService } from './late-arrivals.service';
import { MissingCheckoutsService } from './missing-checkouts.service';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceEvent, Worker])],
  controllers: [AttendanceEventsController, MobileForemanAttendanceController],
  providers: [AttendanceEventsService, LateArrivalsService, MissingCheckoutsService],
  exports: [AttendanceEventsService],
})
export class AttendanceEventsModule {}
