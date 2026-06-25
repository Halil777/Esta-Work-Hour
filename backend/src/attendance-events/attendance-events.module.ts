import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceEvent } from './attendance-event.entity';
import { Worker } from '../workers/worker.entity';
import { AttendanceEventsController, MobileForemanAttendanceController } from './attendance-events.controller';
import { AttendanceEventsService } from './attendance-events.service';
@Module({
  imports: [TypeOrmModule.forFeature([AttendanceEvent, Worker])],
  controllers: [AttendanceEventsController, MobileForemanAttendanceController],
  providers: [AttendanceEventsService],
})
export class AttendanceEventsModule {}
