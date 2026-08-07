import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { MobileCredential } from '../mobile-auth/mobile-credential.entity';
import { MobileWorkerController } from './mobile-worker.controller';
import { MobileWorkerService } from './mobile-worker.service';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, AttendanceEvent, MobileCredential])],
  controllers: [MobileWorkerController],
  providers: [MobileWorkerService],
})
export class MobileWorkerModule {}
