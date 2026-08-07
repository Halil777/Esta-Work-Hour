import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Req,
} from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import { WorkAdjustmentsService, CreateAdjustmentDto, CreateBulkAdjustmentDto } from './work-adjustments.service';
import { AdjustmentType } from './work-adjustment.entity';

@Controller('api/admin/work-adjustments')
@UseGuards(AdminJwtGuard)
export class WorkAdjustmentsController {
  constructor(private readonly svc: WorkAdjustmentsService) {}

  // ── Audit log (before :id routes to avoid route conflict) ───────────────────

  @Get('logs')
  getLogs(
    @Req() req: any,
    @Query('workerEntityId') workerEntityId?: string,
    @Query('month') month?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findLogs(req.adminUser.tenantId, {
      workerEntityId,
      month,
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // ── List adjustments ─────────────────────────────────────────────────────────

  @Get()
  findAll(
    @Req() req: any,
    @Query('workerEntityId') workerEntityId?: string,
    @Query('month') month?: string,
  ) {
    if (workerEntityId) return this.svc.findByWorker(req.adminUser.tenantId, workerEntityId, month);
    if (month)          return this.svc.findByMonth(req.adminUser.tenantId, month);
    return this.svc.findByMonth(req.adminUser.tenantId, new Date().toISOString().slice(0, 7));
  }

  // ── Single create ────────────────────────────────────────────────────────────

  @Post()
  create(
    @Req() req: any,
    @Body() body: {
      workerEntityId: string;
      workDate: string;
      adjustmentType: AdjustmentType;
      minutes: number;
      reasonId?: string;
      description?: string;
    },
  ) {
    const dto: CreateAdjustmentDto = {
      workerEntityId: body.workerEntityId,
      workDate:       body.workDate,
      adjustmentType: body.adjustmentType,
      minutes:        body.minutes,
      reasonId:       body.reasonId,
      description:    body.description,
    };
    return this.svc.create(req.adminUser.tenantId, dto, req.adminUser.username);
  }

  // ── Bulk create ──────────────────────────────────────────────────────────────

  @Post('bulk')
  createBulk(
    @Req() req: any,
    @Body() body: {
      workerEntityIds: string[];
      workDate: string;
      adjustmentType: AdjustmentType;
      minutes: number;
      reasonId?: string;
      description?: string;
    },
  ) {
    const dto: CreateBulkAdjustmentDto = {
      workerEntityIds: body.workerEntityIds,
      workDate:        body.workDate,
      adjustmentType:  body.adjustmentType,
      minutes:         body.minutes,
      reasonId:        body.reasonId,
      description:     body.description,
    };
    return this.svc.createBulk(req.adminUser.tenantId, dto, req.adminUser.username);
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: {
      adjustmentType?: AdjustmentType;
      minutes?: number;
      reasonId?: string | null;
      description?: string | null;
      changeReason?: string;
    },
  ) {
    return this.svc.update(id, req.adminUser.tenantId, body, req.adminUser.username);
  }

  // ── Cancel (soft delete) ─────────────────────────────────────────────────────

  @Delete(':id')
  cancel(
    @Req() req: any,
    @Param('id') id: string,
    @Query('reason') changeReason?: string,
  ) {
    return this.svc.cancel(id, req.adminUser.tenantId, req.adminUser.username, changeReason);
  }
}
