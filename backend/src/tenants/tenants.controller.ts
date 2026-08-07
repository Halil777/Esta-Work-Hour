import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SuperAdminGuard } from '../super-admin-auth/super-admin-auth.guard';

@UseGuards(SuperAdminGuard)
@Controller('super-admin/tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get('workforce')
  getWorkforce() {
    return this.service.getWorkforce();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/regenerate-device-token')
  @HttpCode(200)
  regenerateDeviceToken(@Param('id') id: string) {
    return this.service.regenerateDeviceToken(id);
  }
}
