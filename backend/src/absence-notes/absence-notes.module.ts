import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbsenceNote } from './absence-note.entity';
import { Worker } from '../workers/worker.entity';
import { AbsenceNotesService } from './absence-notes.service';
import { AbsenceNotesController, MobileForemanAbsenceNotesController } from './absence-notes.controller';
import { MobileAuthModule } from '../mobile-auth/mobile-auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([AbsenceNote, Worker]), MobileAuthModule],
  controllers: [AbsenceNotesController, MobileForemanAbsenceNotesController],
  providers: [AbsenceNotesService],
  exports: [AbsenceNotesService],
})
export class AbsenceNotesModule {}
