import { Controller, Get, Post, Delete, Param, Query, Body, Req, UseGuards } from '@nestjs/common';
import { AbsenceNotesService } from './absence-notes.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from '../workers/worker.entity';
import { JwtGuard } from '../mobile-auth/jwt.guard';

// Admin endpoints
@Controller('absence-notes')
export class AbsenceNotesController {
  constructor(
    private readonly service: AbsenceNotesService,
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
  ) {}

  @Get()
  getForDate(@Query('date') date: string) {
    return this.service.getForDate(date);
  }

  @Get('worker/:workerEntityId')
  getForWorker(@Param('workerEntityId') id: string) {
    return this.service.getForWorker(id);
  }

  @Post()
  async upsert(
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
    return this.service.upsert(
      workerEntityId,
      worker?.name ?? '',
      worker?.workerId ?? '',
      date,
      note,
      'foreman',
      foreman?.name ?? '',
    );
  }

  @Get()
  getForDate(@Query('date') date: string) {
    return this.service.getForDate(date);
  }
}
