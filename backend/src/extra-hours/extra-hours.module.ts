import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtraHoursRequest } from './extra-hours-request.entity';
import { ExtraHoursRequestItem } from './extra-hours-request-item.entity';
import { ExtraHoursRequestRecipient } from './extra-hours-request-recipient.entity';
import { Worker } from '../workers/worker.entity';
import { ExtraHoursService } from './extra-hours.service';
import {
  FormanExtraRequestsController,
  SiteChiefExtraRequestsController,
  AdminExtraHoursController,
} from './extra-hours.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([ExtraHoursRequest, ExtraHoursRequestItem, ExtraHoursRequestRecipient, Worker]),
  ],
  controllers: [
    FormanExtraRequestsController,
    SiteChiefExtraRequestsController,
    AdminExtraHoursController,
  ],
  providers: [ExtraHoursService],
  exports: [ExtraHoursService],
})
export class ExtraHoursModule {}
