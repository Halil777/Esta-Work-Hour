import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from '../workers/worker.entity';
import { DeviceController } from './device.controller';
import { DeviceGuard } from './device.guard';
import { TenantsModule } from '../tenants/tenants.module';
import { AttendanceEventsModule } from '../attendance-events/attendance-events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Worker]),
    TenantsModule,
    AttendanceEventsModule,
  ],
  controllers: [DeviceController],
  providers: [DeviceGuard],
})
export class DeviceModule {}
