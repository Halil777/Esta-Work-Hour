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
}
