import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { AdjustmentReasonsService } from './adjustment-reasons.service';

@Controller('admin/adjustment-reasons')
@UseGuards(AdminJwtGuard)
export class AdjustmentReasonsController {
  constructor(private readonly svc: AdjustmentReasonsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.svc.findAll(req.adminUser.tenantId);
  }

  @Post()
  create(
    @Req() req: any,
    @Body() body: { name: string; description?: string },
  ) {
    return this.svc.create(req.adminUser.tenantId, body.name, body.description ?? null);
  }

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string | null; isActive?: boolean },
  ) {
    return this.svc.update(id, req.adminUser.tenantId, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.update(id, req.adminUser.tenantId, { isActive: false });
  }
}
