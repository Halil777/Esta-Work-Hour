import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceOverride } from './attendance-override.entity';
import { AttendanceOverridesService } from './attendance-overrides.service';
import { AttendanceOverridesController } from './attendance-overrides.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceOverride]), AuditLogModule],
  controllers: [AttendanceOverridesController],
  providers: [AttendanceOverridesService],
  exports: [AttendanceOverridesService],
})
export class AttendanceOverridesModule {}
