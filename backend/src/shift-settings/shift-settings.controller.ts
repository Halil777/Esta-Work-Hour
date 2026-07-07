import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ShiftSettingsService } from './shift-settings.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@Controller('shift-settings')
export class ShiftSettingsController {
  constructor(private readonly service: ShiftSettingsService) {}

  // Public — mobile app reads shift times without admin token
  @Get()
  getAll() {
    return this.service.getAll();
  }

  // Admin-only — only admin can change shift times
  @UseGuards(AdminJwtGuard)
  @Put(':shiftType')
  update(
    @Param('shiftType') shiftType: 'day' | 'night',
    @Body('startTime') startTime: string,
    @Body('endTime') endTime: string,
    @Body('graceMinutes') graceMinutes: number,
  ) {
    return this.service.update(shiftType, startTime, endTime ?? '', Number(graceMinutes));
  }
}
