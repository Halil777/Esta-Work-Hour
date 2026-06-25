import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftSetting } from './shift-setting.entity';
import { ShiftSettingsService } from './shift-settings.service';
import { ShiftSettingsController } from './shift-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShiftSetting])],
  controllers: [ShiftSettingsController],
  providers: [ShiftSettingsService],
  exports: [ShiftSettingsService],
})
export class ShiftSettingsModule {}
