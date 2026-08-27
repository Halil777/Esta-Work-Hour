import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ScannerDevicesService } from './scanner-devices.service';
import { CreateScannerDeviceDto } from './dto/create-scanner-device.dto';
import { UpdateScannerDeviceDto } from './dto/update-scanner-device.dto';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('admin/scanner-devices')
export class ScannerDevicesController {
  constructor(private readonly service: ScannerDevicesService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.adminUser.tenantId);
  }

  /** Tenant-wide scan totals (all-time + today), deduped across devices — for the page's summary strip */
  @Get('scan-summary')
  getScanSummary(@Req() req: any) {
    return this.service.getScanSummary(req.adminUser.tenantId);
  }

  /** Returns the full token (for copying after creation or on demand) */
  @Get(':id/token')
  getToken(@Req() req: any, @Param('id') id: string) {
    return this.service.getToken(req.adminUser.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateScannerDeviceDto) {
    return this.service.create(req.adminUser.tenantId, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateScannerDeviceDto) {
    return this.service.update(req.adminUser.tenantId, id, dto);
  }

  @Post(':id/regenerate-token')
  @HttpCode(200)
  regenerateToken(@Req() req: any, @Param('id') id: string) {
    return this.service.regenerateToken(req.adminUser.tenantId, id);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.adminUser.tenantId, id);
  }
}
