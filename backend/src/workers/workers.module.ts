import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from './worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { Foreman } from '../foremans/foreman.entity';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';
import { WorkersQueryService } from './workers-query.service';
import { WorkersCrudService } from './workers-crud.service';
import { WorkersImportService } from './workers-import.service';
import { WorkersExportService } from './workers-export.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkerLifecycleModule } from '../worker-lifecycle/worker-lifecycle.module';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, AttendanceEvent, Foreman]), AuditLogModule, WorkerLifecycleModule],
  controllers: [WorkersController],
  providers: [
    WorkersService,
    WorkersQueryService,
    WorkersCrudService,
    WorkersImportService,
    WorkersExportService,
  ],
})
export class WorkersModule {}
