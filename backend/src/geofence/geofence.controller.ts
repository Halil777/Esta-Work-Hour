import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('geofence-zones')
export class GeofenceController {
  constructor(private readonly service: GeofenceService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.adminUser.tenantId);
  }

  @Post()
  create(
    @Req() req: any,
    @Body('label') label: string,
    @Body('scannerDeviceId') scannerDeviceId: string | null,
    @Body('latitude') latitude: number,
    @Body('longitude') longitude: number,
    @Body('radiusMeters') radiusMeters: number,
  ) {
    return this.service.create(req.adminUser.tenantId, {
      label,
      scannerDeviceId: scannerDeviceId ?? null,
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusMeters: Number(radiusMeters),
    });
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body('label') label?: string,
    @Body('scannerDeviceId') scannerDeviceId?: string | null,
    @Body('latitude') latitude?: number,
    @Body('longitude') longitude?: number,
    @Body('radiusMeters') radiusMeters?: number,
  ) {
    const input: Record<string, unknown> = {};
    if (label !== undefined) input.label = label;
    if (scannerDeviceId !== undefined) input.scannerDeviceId = scannerDeviceId;
    if (latitude !== undefined) input.latitude = Number(latitude);
    if (longitude !== undefined) input.longitude = Number(longitude);
    if (radiusMeters !== undefined) input.radiusMeters = Number(radiusMeters);
    return this.service.update(req.adminUser.tenantId, id, input);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.adminUser.tenantId, id);
  }
}
