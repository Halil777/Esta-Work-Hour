import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AdminInboxService } from './admin-inbox.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('admin/inbox')
export class AdminInboxController {
  constructor(private readonly service: AdminInboxService) {}

  @Get()
  getInbox(@Req() req: any) {
    return this.service.getInbox(req.adminUser.tenantId);
  }
}
