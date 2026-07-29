import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ScannerDevicesService } from '../scanner-devices/scanner-devices.service';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(
    private readonly scannerDevicesService: ScannerDevicesService,
    private readonly tenantsService: TenantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string = request.headers['authorization'] ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Device token gerek');
    }
    const token = authHeader.slice(7);

    const device = await this.scannerDevicesService.findByToken(token);
    if (!device) {
      throw new UnauthorizedException('Nädogry ýa-da işjeň däl device token');
    }

    const tenant = await this.tenantsService.findOne(device.tenantId);

    // Update lastSeenAt in background (fire and forget)
    this.scannerDevicesService.updateLastSeen(device.id).catch(() => {});

    request.device = {
      tenantId: device.tenantId,
      tenantName: (tenant as any).name,
      tenantLogoUrl: (tenant as any).logoUrl ?? null,
      deviceId: device.id,
      deviceLabel: device.label,
      deviceLocation: device.location ?? null,
      workerEntityId: device.workerEntityId ?? null,
    };

    return true;
  }
}
