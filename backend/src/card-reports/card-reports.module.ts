import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardReport } from './card-report.entity';
import { CardReportsService } from './card-reports.service';
import { CardReportsController } from './card-reports.controller';
import { Worker } from '../workers/worker.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CardReport, Worker])],
  controllers: [CardReportsController],
  providers: [CardReportsService],
  exports: [CardReportsService],
})
export class CardReportsModule {}
