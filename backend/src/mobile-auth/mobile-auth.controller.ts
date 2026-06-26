import { Controller, Post, Body, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { MobileAuthService } from './mobile-auth.service';
import { IsString, MinLength } from 'class-validator';
import { JwtGuard } from './jwt.guard';

class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

class SetCredentialDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(4)
  password: string;
}

@Controller('mobile/auth')
export class MobileAuthController {
  constructor(private readonly service: MobileAuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.service.login(dto.username, dto.password);
  }

  // Admin endpoints — set/get credentials for a worker
  @Post('credentials/:workerEntityId')
  setCredential(
    @Param('workerEntityId') workerEntityId: string,
    @Body() dto: SetCredentialDto,
  ) {
    return this.service.setCredential(workerEntityId, dto.username, dto.password);
  }

  @Get('credentials/:workerEntityId')
  getCredential(@Param('workerEntityId') workerEntityId: string) {
    return this.service.getCredentialByWorker(workerEntityId);
  }

  @Patch('credentials/:workerEntityId/deactivate')
  deactivate(@Param('workerEntityId') workerEntityId: string) {
    return this.service.deactivateCredential(workerEntityId);
  }
}

@UseGuards(JwtGuard)
@Controller('mobile')
export class MobilePushController {
  constructor(private readonly service: MobileAuthService) {}

  @Post('push-token')
  savePushToken(@Req() req: any, @Body('pushToken') pushToken: string) {
    const { workerEntityId } = req.user;
    return this.service.savePushToken(workerEntityId, pushToken);
  }
}
