import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Foreman } from './foreman.entity';
import { Worker } from '../workers/worker.entity';
import { ForemanService } from './foremans.service';
import { ForemanController } from './foremans.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Foreman, Worker]), AuditLogModule],
  providers: [ForemanService],
  controllers: [ForemanController],
  exports: [ForemanService],
})
export class ForemanModule {}
