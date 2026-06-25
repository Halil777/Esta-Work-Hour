import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MobileCredential } from './mobile-credential.entity';
import { Worker } from '../workers/worker.entity';
import { MobileAuthService } from './mobile-auth.service';
import { MobileAuthController } from './mobile-auth.controller';
import { JwtGuard } from './jwt.guard';

export const JWT_SECRET = process.env.JWT_SECRET || 'workhour-mobile-secret-2025';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([MobileCredential, Worker]),
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [MobileAuthController],
  providers: [MobileAuthService, JwtGuard],
  exports: [MobileAuthService, JwtGuard, JwtModule],
})
export class MobileAuthModule {}
