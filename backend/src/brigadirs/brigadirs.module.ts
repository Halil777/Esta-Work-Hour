import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Brigadir } from './brigadir.entity';
import { Foreman } from '../foremans/foreman.entity';
import { Worker } from '../workers/worker.entity';
import { BrigadirsService } from './brigadirs.service';
import { BrigadirsController } from './brigadirs.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Brigadir, Foreman, Worker]), AuditLogModule],
  providers: [BrigadirsService],
  controllers: [BrigadirsController],
  exports: [BrigadirsService],
})
export class BrigadirsModule {}
