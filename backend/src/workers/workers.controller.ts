import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UploadedFile, UseInterceptors, UseGuards,
  BadRequestException, Res, StreamableFile, Headers, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { WorkersService } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { TerminateWorkerDto } from './dto/terminate-worker.dto';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';
import type { Response } from 'express';

@UseGuards(AdminJwtGuard)
@Controller('workers')
export class WorkersController {
  constructor(private readonly service: WorkersService) {}

  private assertExcelFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowed.includes(file.mimetype) && !file.originalname.match(/\.(xlsx|xls)$/i)) {
      throw new BadRequestException('Only .xlsx or .xls files are allowed');
    }
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('brigadeId') brigadeId?: string,
    @Query('status') status?: string,
    @Query('foremanId') foremanId?: string,
    @Query('mobileRole') mobileRole?: string,
    @Query('mesaiSistemi') mesaiSistemi?: string,
    @Query('shift') shift?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('noScan') noScan?: string,
    @Query('hasScan') hasScan?: string,
  ) {
    return this.service.findAll({
      search,
      brigadeId,
      status,
      foremanId,
      mobileRole,
      mesaiSistemi,
      shift,
      startDate,
      endDate,
      noScan: noScan === 'true',
      hasScan: hasScan === 'true',
      tenantId: req.adminUser?.tenantId,
    });
  }

  // ── Static routes MUST come before :id routes ──────────────────────────────

  @Get('export')
  async exportExcel(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('foremanId') foremanId?: string,
    @Query('mobileRole') mobileRole?: string,
    @Query('mesaiSistemi') mesaiSistemi?: string,
    @Query('shift') shift?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('noScan') noScan?: string,
    @Query('hasScan') hasScan?: string,
  ): Promise<StreamableFile> {
    const buffer = await this.service.exportToExcel({
      tenantId: req.adminUser?.tenantId,
      search,
      status,
      foremanId,
      mobileRole,
      mesaiSistemi,
      shift,
      startDate,
      endDate,
      noScan: noScan === 'true',
      hasScan: hasScan === 'true',
    });
    const date = new Date().toISOString().split('T')[0];
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="workers-${date}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('terminated')
  findTerminated(@Req() req: any, @Query('search') search?: string) {
    return this.service.findTerminated(search, req.adminUser?.tenantId);
  }

  @Post('import/excel')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-admin-name') adminName?: string,
  ) {
    this.assertExcelFile(file);
    return this.service.importFromExcel(file.buffer, req.adminUser?.tenantId, adminName || 'Admin');
  }

  @Post('import/excel/preview')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async previewImportExcel(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    this.assertExcelFile(file);
    return this.service.previewImportFromExcel(file.buffer, req.adminUser?.tenantId);
  }

  @Post('import/cards')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importCards(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!file.originalname.match(/\.(xlsx|xls)$/i)) {
      throw new BadRequestException('Only .xlsx or .xls files are allowed');
    }
    return this.service.importCardNumbers(file.buffer, req.adminUser?.tenantId);
  }

  // ── Parameterized routes ─────────────────────────────────────────────────────

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/photo')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage() }))
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.uploadPhoto(id, file);
  }

  @Post()
  create(
    @Req() req: any,
    @Body() dto: CreateWorkerDto,
    @Headers('x-admin-name') adminName?: string,
  ) {
    return this.service.create(dto, req.adminUser?.tenantId, adminName || 'Admin');
  }

  @Patch(':id/restore')
  restore(
    @Param('id') id: string,
    @Headers('x-admin-name') adminName?: string,
  ) {
    return this.service.restoreWorker(id, adminName || 'Admin');
  }

  @Patch(':id/terminate')
  terminate(
    @Param('id') id: string,
    @Body() dto: TerminateWorkerDto,
    @Headers('x-admin-name') adminName?: string,
  ) {
    return this.service.terminateWorker(id, dto, adminName || 'Admin');
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
}
