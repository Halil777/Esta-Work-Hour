import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ExtraHoursService } from './extra-hours.service';
import { JwtGuard } from '../mobile-auth/jwt.guard';
import { IsString, IsArray, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

class RequestItemDto {
  @IsString()
  workerEntityId: string;

  @IsNumber()
  @Min(0.5)
  @Type(() => Number)
  extraHours: number;

  @IsOptional()
  @IsString()
  description?: string;
}

class CreateRequestDto {
  @IsString()
  siteChiefWorkerEntityId: string;

  @IsString()
  workDate: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  items: RequestItemDto[];
}

// Foreman endpoints
@Controller('mobile/foreman/extra-requests')
@UseGuards(JwtGuard)
export class FormanExtraRequestsController {
  constructor(private readonly service: ExtraHoursService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateRequestDto) {
    return this.service.createRequest(
      req.user.workerEntityId,
      dto.siteChiefWorkerEntityId,
      dto.workDate,
      dto.note ?? null,
      dto.items.map(i => ({ ...i, description: i.description })),
    );
  }

  @Get()
  myRequests(@Req() req: any) {
    return this.service.getFormanRequests(req.user.workerEntityId);
  }
}

// Site Chief endpoints
@Controller('mobile/site-chief/extra-requests')
@UseGuards(JwtGuard)
export class SiteChiefExtraRequestsController {
  constructor(private readonly service: ExtraHoursService) {}

  @Get()
  incoming(@Req() req: any) {
    return this.service.getSiteChiefRequests(req.user.workerEntityId);
  }

  @Patch(':id/seen')
  markSeen(@Param('id') id: string, @Req() req: any) {
    return this.service.markSeen(id, req.user.workerEntityId);
  }

  @Patch(':id/action')
  takeAction(
    @Param('id') id: string,
    @Req() req: any,
    @Body('action') action: 'approved' | 'rejected',
  ) {
    return this.service.takeAction(id, req.user.workerEntityId, action);
  }
}

// Admin endpoints (no JWT guard — admin panel uses existing auth)
@Controller('extra-hours')
export class AdminExtraHoursController {
  constructor(private readonly service: ExtraHoursService) {}

  @Get()
  getAll(
    @Query('status') status?: string,
    @Query('foremanId') foremanId?: string,
    @Query('siteChiefId') siteChiefId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAllRequests({
      status,
      foremanWorkerEntityId: foremanId,
      siteChiefWorkerEntityId: siteChiefId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch(':id/action')
  adminAction(
    @Param('id') id: string,
    @Body('action') action: 'approved' | 'rejected',
  ) {
    return this.service.adminAction(id, action);
  }
}
