import { Module } from '@nestjs/common';
import { AdminInboxService } from './admin-inbox.service';
import { AdminInboxController } from './admin-inbox.controller';
import { CardReportsModule } from '../card-reports/card-reports.module';
import { ExtraHoursModule } from '../extra-hours/extra-hours.module';
import { ScannerDevicesModule } from '../scanner-devices/scanner-devices.module';

@Module({
  imports: [CardReportsModule, ExtraHoursModule, ScannerDevicesModule],
  providers: [AdminInboxService],
  controllers: [AdminInboxController],
})
export class AdminInboxModule {}
