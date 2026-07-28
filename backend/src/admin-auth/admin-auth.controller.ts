import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ADMIN_JWT_SECRET } from './admin-auth.constants';
import { TenantsService } from '../tenants/tenants.service';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Post('login')
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    if (!username || !password) {
      throw new UnauthorizedException('Username we parol gerek');
    }

    const tenant = await this.tenantsService.findByUsername(username);
    if (!tenant) {
      throw new UnauthorizedException('Ýalňyş username ýa-da parol');
    }

    const valid = await bcrypt.compare(password, tenant.adminPasswordHash);
    if (!valid) {
      throw new UnauthorizedException('Ýalňyş username ýa-da parol');
    }

    if (!tenant.isActive) {
      throw new UnauthorizedException('Bu tenant admin panel öçürilen');
    }

    const token = this.jwtService.sign(
      { sub: 'admin', username, tenantId: tenant.id, tenantName: tenant.name },
      { secret: ADMIN_JWT_SECRET, expiresIn: '8h' },
    );

    return {
      token,
      user: {
        id: tenant.id,
        name: tenant.name,
        role: 'ObjectAdmin',
        objectName: tenant.name,
        objectId: tenant.id,
        logoUrl: tenant.logoUrl,
      },
    };
  }
}
