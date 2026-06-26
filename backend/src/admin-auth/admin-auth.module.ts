import { Module, Global } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminJwtGuard } from './admin-auth.guard';

/**
 * Global module: AdminJwtGuard is available in all other modules without re-importing.
 * JwtService is injected from MobileAuthModule (which is also @Global and exports JwtModule).
 */
@Global()
@Module({
  controllers: [AdminAuthController],
  providers: [AdminJwtGuard],
  exports: [AdminJwtGuard],
})
export class AdminAuthModule {}
