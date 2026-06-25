import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { MobileForemanController } from './mobile-foreman.controller';
@Module({
  imports: [TypeOrmModule.forFeature([Worker, AttendanceEvent])],
  controllers: [MobileForemanController],
})
export class MobileForemanModule {}
