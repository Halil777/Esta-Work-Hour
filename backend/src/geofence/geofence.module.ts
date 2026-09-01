import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeofenceZone } from './geofence-zone.entity';
import { GeofenceService } from './geofence.service';
import { GeofenceController } from './geofence.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GeofenceZone])],
  controllers: [GeofenceController],
  providers: [GeofenceService],
  exports: [GeofenceService],
})
export class GeofenceModule {}
