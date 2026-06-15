import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UploadedFile, UseInterceptors,
  BadRequestException, Res, StreamableFile, Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { WorkersService } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import type { Response } from 'express';

@Controller('workers')
export class WorkersController {
  constructor(private readonly service: WorkersService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('brigadeId') brigadeId?: string,
    @Query('status') status?: string,
    @Query('foremanId') foremanId?: string,
    @Query('mobileRole') mobileRole?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('noScan') noScan?: string,
  ) {
    return this.service.findAll({
      search,
      brigadeId,
      status,
      foremanId,
      mobileRole,
      startDate,
      endDate,
      noScan: noScan === 'true',
    });
  }

  @Get('export')
  async exportExcel(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const buffer = await this.service.exportToExcel();
    const date = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="workers-${date}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateWorkerDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkerDto,
    @Headers('x-admin-name') adminName?: string,
  ) {
    return this.service.update(id, dto, adminName || 'Admin');
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Headers('x-admin-name') adminName?: string,
  ) {
    return this.service.remove(id, adminName || 'Admin');
  }

  @Post('import/excel')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowed.includes(file.mimetype) && !file.originalname.match(/\.(xlsx|xls)$/i)) {
      throw new BadRequestException('Only .xlsx or .xls files are allowed');
    }
    return this.service.importFromExcel(file.buffer);
  }
}
