import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from '../workers/worker.entity';
import { MobileCredential } from '../mobile-auth/mobile-credential.entity';
import { DeviceController } from './device.controller';
import { DeviceGuard } from './device.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { AttendanceEventsModule } from '../attendance-events/attendance-events.module';
import { ScannerDevicesModule } from '../scanner-devices/scanner-devices.module';
import { AttendanceAnomaliesModule } from '../attendance-anomalies/attendance-anomalies.module';
import { WorkersModule } from '../workers/workers.module';
import { CardAssignmentHistoryModule } from '../card-assignment-history/card-assignment-history.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker, MobileCredential]),
    TenantsModule,
    AttendanceEventsModule,
    ScannerDevicesModule,
    AttendanceAnomaliesModule,
    WorkersModule,
    CardAssignmentHistoryModule,
  ],
  controllers: [DeviceController],
  providers: [DeviceGuard],
})
export class DeviceModule {}
