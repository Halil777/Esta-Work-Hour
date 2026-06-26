import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Guards admin API routes by validating the X-Admin-Token header.
 * If ADMIN_TOKEN env var is not set, the guard passes (development mode).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const required = process.env.ADMIN_TOKEN;
    if (!required) return true; // dev mode: no token configured

    const req = context.switchToHttp().getRequest();
    const token = req.headers['x-admin-token'];
    if (!token || token !== required) {
      throw new UnauthorizedException('Invalid or missing admin token');
    }
    return true;
  }
}
