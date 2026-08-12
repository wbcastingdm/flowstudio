import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, CurrentUser } from './auth.guard';
import type { SessionPayload } from './token.util';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * صفحهٔ ورود پیش از هر چیز این را می‌پرسد تا بداند چه بپرسد.
   *
   * روزی که ورود به OTP برگردد، فقط `mode` عوض می‌شود و همان صفحه دو
   * مرحله‌ای می‌شود — بدونِ اینکه رابط چیزی دربارهٔ سازوکارِ ورود حدس بزند.
   */
  @Get('policy')
  policy() {
    return this.auth.policy();
  }

  @Post('login')
  login(@Body() body: { phone: string; password: string }) {
    return this.auth.login(body?.phone, body?.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() session: SessionPayload) {
    return this.auth.me(session.sub);
  }
}
