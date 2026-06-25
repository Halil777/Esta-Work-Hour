import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { ShiftSettingsService } from './shift-settings.service';

@Controller('shift-settings')
export class ShiftSettingsController {
  constructor(private readonly service: ShiftSettingsService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }

  @Put(':shiftType')
  update(
    @Param('shiftType') shiftType: 'day' | 'night',
    @Body('startTime') startTime: string,
    @Body('graceMinutes') graceMinutes: number,
  ) {
    return this.service.update(shiftType, startTime, Number(graceMinutes));
  }
}
