import { Controller, Get, Param, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { WorkerLifecycleService } from './worker-lifecycle.service';
import type { Response } from 'express';

@UseGuards(AdminJwtGuard)
@Controller('worker-lifecycle')
export class WorkerLifecycleController {
  constructor(private readonly service: WorkerLifecycleService) {}

  @Get('pending-summary')
  pendingSummary(@Req() req: any) {
    return this.service.getPendingSummary(req.adminUser?.tenantId);
  }

  @Get('reports')
  reports(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.listReports(req.adminUser?.tenantId, Number(limit) || 30);
  }

  @Post('reports/send-pending')
  sendPendingNow(@Req() req: any) {
    return this.service.sendPendingNow(req.adminUser?.tenantId);
  }

  @Post('reports/:batchId/resend')
  resendReport(@Req() req: any, @Param('batchId') batchId: string) {
    return this.service.resendReport(batchId, req.adminUser?.tenantId);
  }

  @Get('reports/:batchId/download')
  async downloadReport(
    @Req() req: any,
    @Param('batchId') batchId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.service.downloadReport(batchId, req.adminUser?.tenantId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
}
