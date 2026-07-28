import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  findAll(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.findAll(limit ? Number(limit) : 200, req.adminUser?.tenantId);
  }
}
