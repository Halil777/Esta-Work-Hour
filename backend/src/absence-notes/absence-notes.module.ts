import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbsenceNote } from './absence-note.entity';
import { Worker } from '../workers/worker.entity';
import { AbsenceNotesService } from './absence-notes.service';
import { AbsenceNotesController, MobileForemanAbsenceNotesController } from './absence-notes.controller';
@Module({
  imports: [TypeOrmModule.forFeature([AbsenceNote, Worker])],
  controllers: [AbsenceNotesController, MobileForemanAbsenceNotesController],
  providers: [AbsenceNotesService],
  exports: [AbsenceNotesService],
})
export class AbsenceNotesModule {}
