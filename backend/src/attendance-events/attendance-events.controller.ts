import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { AttendanceEventsService } from './attendance-events.service';
import { SyncEventsDto } from './dto/sync-events.dto';

@Controller('attendance')
export class AttendanceEventsController {
  constructor(private readonly service: AttendanceEventsService) {}

  @Post('sync')
  syncEvents(@Body() dto: SyncEventsDto) {
    return this.service.syncEvents(dto);
  }

  @Get('events')
  findAll(
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(date, limit ? Number(limit) : 500);
  }

  @Get('daily-summary')
  getDailySummary(@Query('date') date?: string) {
    return this.service.getDailySummary(date);
  }
}
