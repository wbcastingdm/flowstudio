import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import type { SessionPayload } from './token.util';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  request(@Body() body: { phone: string }) {
    return this.auth.requestOtp(body?.phone);
  }

  @Post('otp/verify')
  verify(@Body() body: { phone: string; code: string }) {
    return this.auth.verifyOtp(body?.phone, body?.code);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() session: SessionPayload) {
    return this.auth.me(session.sub);
  }
}
