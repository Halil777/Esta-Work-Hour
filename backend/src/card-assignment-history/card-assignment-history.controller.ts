import { Controller, Get, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { CardAssignmentHistoryService } from './card-assignment-history.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('admin/card-assignment-history')
export class CardAssignmentHistoryController {
  constructor(private readonly service: CardAssignmentHistoryService) {}

  @Get()
  findForWorker(@Req() req: any, @Query('workerId') workerId: string) {
    if (!workerId) throw new BadRequestException('workerId gerek');
    return this.service.findForWorker(workerId, req.adminUser.tenantId);
  }

  /**
   * Tenant-wide feed — powers the admin panel's Card History report page
   * (which operator/device unbound or rebound which worker's card, and when).
   * GET /api/admin/card-assignment-history/recent?limit=300
   */
  @Get('recent')
  findRecent(@Req() req: any, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.service.findRecent(req.adminUser.tenantId, parsedLimit && !Number.isNaN(parsedLimit) ? parsedLimit : undefined);
  }
}
