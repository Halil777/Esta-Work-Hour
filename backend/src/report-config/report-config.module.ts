import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportConfig } from './report-config.entity';
import { ReportConfigService } from './report-config.service';
import { ReportConfigController } from './report-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReportConfig])],
  controllers: [ReportConfigController],
  providers: [ReportConfigService],
  exports: [ReportConfigService],
})
export class ReportConfigModule {}
