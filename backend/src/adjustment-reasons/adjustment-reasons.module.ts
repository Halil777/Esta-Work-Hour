import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AdjustmentReason } from './adjustment-reason.entity';
import { AdjustmentReasonsService } from './adjustment-reasons.service';
import { AdjustmentReasonsController } from './adjustment-reasons.controller';
import { ADMIN_JWT_SECRET } from '../admin-auth/admin-auth.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdjustmentReason]),
    JwtModule.register({ secret: ADMIN_JWT_SECRET }),
  ],
  providers:   [AdjustmentReasonsService],
  controllers: [AdjustmentReasonsController],
  exports:     [AdjustmentReasonsService],
})
export class AdjustmentReasonsModule {}
