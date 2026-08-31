import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { WorkAdjustment } from './work-adjustment.entity';
import { WorkAdjustmentLog } from './work-adjustment-log.entity';
import { AdjustmentReason } from '../adjustment-reasons/adjustment-reason.entity';
import { Worker } from '../workers/worker.entity';
import { AttendanceEvent } from '../attendance-events/attendance-event.entity';
import { WorkAdjustmentsService } from './work-adjustments.service';
import { WorkAdjustmentsController } from './work-adjustments.controller';
import { ADMIN_JWT_SECRET } from '../admin-auth/admin-auth.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkAdjustment, WorkAdjustmentLog, AdjustmentReason, Worker, AttendanceEvent]),
    JwtModule.register({ secret: ADMIN_JWT_SECRET }),
  ],
  providers:   [WorkAdjustmentsService],
  controllers: [WorkAdjustmentsController],
  exports:     [WorkAdjustmentsService],
})
export class WorkAdjustmentsModule {}
