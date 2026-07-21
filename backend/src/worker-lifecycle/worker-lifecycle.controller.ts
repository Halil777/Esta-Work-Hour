import { Controller, Get, Param, Post, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { WorkerLifecycleService } from './worker-lifecycle.service';
import type { Response } from 'express';

@UseGuards(AdminJwtGuard)
@Controller('worker-lifecycle')
export class WorkerLifecycleController {
  constructor(private readonly service: WorkerLifecycleService) {}

  @Get('pending-summary')
  pendingSummary() {
    return this.service.getPendingSummary();
  }

  @Get('reports')
  reports(@Query('limit') limit?: string) {
    return this.service.listReports(Number(limit) || 30);
  }

  @Post('reports/send-pending')
  sendPendingNow() {
    return this.service.sendPendingNow();
  }

  @Post('reports/:batchId/resend')
  resendReport(@Param('batchId') batchId: string) {
    return this.service.resendReport(batchId);
  }

  @Get('reports/:batchId/download')
  async downloadReport(
    @Param('batchId') batchId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.service.downloadReport(batchId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
}
