import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('daily')
  async dailyPdf(
    @Query('date') date: string,
    @Res() res: Response,
  ) {
    const target = date || new Date().toISOString().split('T')[0];
    const buf = await this.service.generateDailyPdf(target);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="daily-report-${target}.pdf"`);
    res.send(buf);
  }
}
