import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScannerDevice } from './scanner-device.entity';
import { Worker } from '../workers/worker.entity';
import { ScannerDevicesService } from './scanner-devices.service';
import { ScannerDevicesController } from './scanner-devices.controller';
import { AttendanceEventsModule } from '../attendance-events/attendance-events.module';

@Module({
  imports: [TypeOrmModule.forFeature([ScannerDevice, Worker]), AttendanceEventsModule],
  controllers: [ScannerDevicesController],
  providers: [ScannerDevicesService],
  exports: [ScannerDevicesService],
})
export class ScannerDevicesModule {}
