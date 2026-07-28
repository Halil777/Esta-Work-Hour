import { Module, Global } from '@nestjs/common';
import { SuperAdminAuthController } from './super-admin-auth.controller';
import { SuperAdminGuard } from './super-admin-auth.guard';

@Global()
@Module({
  controllers: [SuperAdminAuthController],
  providers: [SuperAdminGuard],
  exports: [SuperAdminGuard],
})
export class SuperAdminAuthModule {}
