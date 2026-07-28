import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SUPER_ADMIN_JWT_SECRET } from './super-admin-auth.constants';

@Controller('super-admin/auth')
export class SuperAdminAuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('login')
  login(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    const expectedUser = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
    const expectedPass = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';

    if (!username || !password || username !== expectedUser || password !== expectedPass) {
      throw new UnauthorizedException('Ýalňyş username ýa-da parol');
    }

    const token = this.jwtService.sign(
      { sub: 'super-admin', role: 'super_admin' },
      { secret: SUPER_ADMIN_JWT_SECRET, expiresIn: '12h' },
    );

    return {
      token,
      user: {
        name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
        role: 'super_admin',
      },
    };
  }
}
