import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportConfigModule } from '../report-config/report-config.module';
import { WorkerLifecycleEvent } from './worker-lifecycle-event.entity';
import { WorkerLifecycleReport } from './worker-lifecycle-report.entity';
import { WorkerLifecycleController } from './worker-lifecycle.controller';
import { WorkerLifecycleService } from './worker-lifecycle.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkerLifecycleEvent, WorkerLifecycleReport]), ReportConfigModule],
  controllers: [WorkerLifecycleController],
  providers: [WorkerLifecycleService],
  exports: [WorkerLifecycleService],
})
export class WorkerLifecycleModule {}
