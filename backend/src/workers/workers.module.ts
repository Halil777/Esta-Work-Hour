import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from './worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Foreman } from '../foremans/foreman.entity';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkerLifecycleModule } from '../worker-lifecycle/worker-lifecycle.module';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, AttendanceEvent, Foreman]), AuditLogModule, WorkerLifecycleModule],
  controllers: [WorkersController],
  providers: [WorkersService],
})
export class WorkersModule {}
