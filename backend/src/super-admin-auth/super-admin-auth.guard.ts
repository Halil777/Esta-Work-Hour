import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SUPER_ADMIN_JWT_SECRET } from './super-admin-auth.constants';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Super admin token gerek');
    }
    const token = authHeader.slice(7);
    try {
      request.superAdmin = this.jwtService.verify(token, { secret: SUPER_ADMIN_JWT_SECRET });
      return true;
    } catch {
      throw new UnauthorizedException('Super admin token nädogry ýa-da möhleti geçen');
    }
  }
}
