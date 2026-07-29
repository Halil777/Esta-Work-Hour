import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly tenantsService: TenantsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string = request.headers['authorization'] ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Device token gerek');
    }
    const token = authHeader.slice(7);
    const tenant = await this.tenantsService.findByDeviceToken(token);
    if (!tenant) {
      throw new UnauthorizedException('Nädogry ýa-da işjeň däl device token');
    }
    request.device = { tenantId: tenant.id, tenantName: tenant.name };
    return true;
  }
}
