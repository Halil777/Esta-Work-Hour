import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { MobileForemanController } from './mobile-foreman.controller';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, AttendanceEvent]), MobileAuthModule],
  controllers: [MobileForemanController],
})
export class MobileForemanModule {}
