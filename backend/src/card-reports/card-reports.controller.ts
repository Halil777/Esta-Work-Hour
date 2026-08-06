import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { CardReportsService } from './card-reports.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('admin/card-reports')
export class CardReportsController {
  constructor(private readonly service: CardReportsService) {}

  @Get()
  findAll(@Req() req: any, @Query('status') status?: string) {
    return this.service.findAll(req.adminUser?.tenantId, status);
  }

  @Get('pending-count')
  pendingCount(@Req() req: any) {
    return this.service.getPendingCount(req.adminUser?.tenantId).then(count => ({ count }));
  }

  @Patch(':id/resolve')
  resolve(@Req() req: any, @Param('id') id: string) {
    return this.service.resolve(id, req.adminUser?.username ?? 'admin', req.adminUser?.tenantId);
  }

  @Patch(':id/dismiss')
  dismiss(@Req() req: any, @Param('id') id: string) {
    return this.service.dismiss(id, req.adminUser?.tenantId);
  }
}
