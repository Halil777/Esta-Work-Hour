import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

@UseGuards(AdminJwtGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  /** Daily PDF download */
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

  /**
   * Range Excel download
   * GET /reports/range-xlsx?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&workerIds=id1,id2
   */
  @Get('range-xlsx')
  async rangeXlsx(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('workerIds') workerIdsParam: string,
    @Res() res: Response,
  ) {
    const sd = startDate || new Date().toISOString().split('T')[0];
    const ed = endDate || sd;
    const workerIds = workerIdsParam
      ? workerIdsParam.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const { xlsx } = await this.service.generateRangeReport(sd, ed, workerIds, false);
    const filename = `is-sagatlary-${sd}-${ed}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xlsx);
  }

  /**
   * Range JSON preview (for UI table)
   * GET /reports/range-data?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&workerIds=id1,id2
   */
  @Get('range-data')
  async rangeData(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('workerIds') workerIdsParam: string,
  ) {
    const sd = startDate || new Date().toISOString().split('T')[0];
    const ed = endDate || sd;
    const workerIds = workerIdsParam
      ? workerIdsParam.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;
    return this.service.getRangeData(sd, ed, workerIds);
  }
}
