import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ADMIN_JWT_SECRET } from './admin-auth.constants';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('login')
  login(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    const expectedUser = process.env.ADMIN_USERNAME || 'admin';
    const expectedPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (!username || !password || username !== expectedUser || password !== expectedPass) {
      throw new UnauthorizedException('Ýalňyş username ýa-da parol');
    }

    const token = this.jwtService.sign(
      { sub: 'admin', username },
      { secret: ADMIN_JWT_SECRET, expiresIn: '8h' },
    );

    return {
      token,
      user: {
        id: 'admin',
        name: process.env.ADMIN_NAME || 'Admin',
        role: 'ObjectAdmin',
        objectName: process.env.ADMIN_OBJECT_NAME || 'Esta Construction',
        objectId: 'esta',
      },
    };
  }
}
