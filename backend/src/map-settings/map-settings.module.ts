import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapSetting } from './map-setting.entity';
import { MapSettingsService } from './map-settings.service';
import { MapSettingsController } from './map-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MapSetting])],
  controllers: [MapSettingsController],
  providers: [MapSettingsService],
  exports: [MapSettingsService],
})
export class MapSettingsModule {}
