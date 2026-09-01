import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { MapSettingsService } from './map-settings.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@Controller('map-settings')
export class MapSettingsController {
  constructor(private readonly service: MapSettingsService) {}

  @UseGuards(AdminJwtGuard)
  @Get()
  get(@Req() req: any) {
    return this.service.get(req.adminUser.tenantId);
  }

  @UseGuards(AdminJwtGuard)
  @Put()
  update(@Req() req: any, @Body('yandexMapsApiKey') yandexMapsApiKey: string | null) {
    return this.service.update(req.adminUser.tenantId, yandexMapsApiKey);
  }
}
