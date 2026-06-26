import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWT_SECRET } from './jwt-constants';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token gerek');
    }
    const token = authHeader.slice(7);
    try {
      const payload = this.jwtService.verify(token, { secret: JWT_SECRET });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token nädogry ýa-da möhleti geçen');
    }
  }
}
