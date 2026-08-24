import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardAssignmentHistory } from './card-assignment-history.entity';
import { CardAssignmentHistoryService } from './card-assignment-history.service';
import { CardAssignmentHistoryController } from './card-assignment-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CardAssignmentHistory])],
  providers: [CardAssignmentHistoryService],
  controllers: [CardAssignmentHistoryController],
  exports: [CardAssignmentHistoryService],
})
export class CardAssignmentHistoryModule {}
