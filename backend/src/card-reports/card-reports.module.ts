import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardReport } from './card-report.entity';
import { CardReportsService } from './card-reports.service';
import { CardReportsController } from './card-reports.controller';
import { Worker } from '../workers/worker.entity';
import { CardAssignmentHistoryModule } from '../card-assignment-history/card-assignment-history.module';

@Module({
  imports: [TypeOrmModule.forFeature([CardReport, Worker]), CardAssignmentHistoryModule],
  controllers: [CardReportsController],
  providers: [CardReportsService],
  exports: [CardReportsService],
})
export class CardReportsModule {}
