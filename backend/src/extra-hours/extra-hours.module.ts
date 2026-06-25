import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtraHoursRequest } from './extra-hours-request.entity';
import { ExtraHoursRequestItem } from './extra-hours-request-item.entity';
import { Worker } from '../workers/worker.entity';
import { ExtraHoursService } from './extra-hours.service';
import {
  FormanExtraRequestsController,
  SiteChiefExtraRequestsController,
  AdminExtraHoursController,
} from './extra-hours.controller';
@Module({
  imports: [
    TypeOrmModule.forFeature([ExtraHoursRequest, ExtraHoursRequestItem, Worker]),
  ],
  controllers: [
    FormanExtraRequestsController,
    SiteChiefExtraRequestsController,
    AdminExtraHoursController,
  ],
  providers: [ExtraHoursService],
})
export class ExtraHoursModule {}
