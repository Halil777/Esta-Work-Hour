import { Controller, Get, Post, Delete, Param, Query, Body, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { AbsenceNotesService } from './absence-notes.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from '../workers/worker.entity';
import { JwtGuard } from '../mobile-auth/jwt.guard';
import { AdminJwtGuard } from '../admin-auth/admin-auth.guard';

// Admin endpoints
@UseGuards(AdminJwtGuard)
@Controller('absence-notes')
export class AbsenceNotesController {
  constructor(
    private readonly service: AbsenceNotesService,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  @Get()
  getForDate(@Req() req: any, @Query('date') date: string) {
    return this.service.getForDate(date, req.adminUser.tenantId);
  }

  @Get('worker/:workerEntityId')
  getForWorker(@Param('workerEntityId') id: string) {
    return this.service.getForWorker(id);
  }

  @Post()
  async upsert(
    @Req() req: any,
    @Body('workerEntityId') workerEntityId: string,
    @Body('date') date: string,
    @Body('note') note: string,
    @Body('createdByName') createdByName: string,
  ) {
    const worker = await this.workerRepo.findOneBy({ id: workerEntityId });
    return this.service.upsert(
      workerEntityId,
      worker?.name ?? '',
      worker?.workerId ?? '',
      date,
      note,
      'admin',
      createdByName ?? 'Admin',
      req.adminUser.tenantId,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.deleteNote(id);
  }
}

// Mobile/Foreman endpoint
@Controller('mobile/foreman/absence-notes')
@UseGuards(JwtGuard)
export class MobileForemanAbsenceNotesController {
  constructor(
    private readonly service: AbsenceNotesService,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  @Post()
  async upsert(
    @Req() req: any,
    @Body('workerEntityId') workerEntityId: string,
    @Body('date') date: string,
    @Body('note') note: string,
  ) {
    const foreman = await this.workerRepo.findOneBy({ id: req.user.workerEntityId });
    const worker = await this.workerRepo.findOneBy({ id: workerEntityId });
    if (!worker || worker.tenantId !== req.user.tenantId) {
      throw new NotFoundException('Işçi tapylmady');
    }
    return this.service.upsert(
      workerEntityId,
      worker?.name ?? '',
      worker?.workerId ?? '',
      date,
      note,
      'foreman',
      foreman?.name ?? '',
      req.user.tenantId,
    );
  }

  @Get()
  getForDate(@Req() req: any, @Query('date') date: string) {
    return this.service.getForDate(date, req.user.tenantId);
  }
}
