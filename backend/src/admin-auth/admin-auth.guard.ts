import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ADMIN_JWT_SECRET } from './admin-auth.constants';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Admin token gerek');
    }
    const token = authHeader.slice(7);
    try {
      request.adminUser = this.jwtService.verify(token, { secret: ADMIN_JWT_SECRET });
      return true;
    } catch {
      throw new UnauthorizedException('Admin token nädogry ýa-da möhleti geçen');
    }
  }
}
