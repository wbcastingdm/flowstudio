import { Body, Controller, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { SessionPayload } from '../auth/token.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizePhone } from '../auth/phone.util';

/** کیفِ پولِ خودِ کاربر — فقط خواندنی. شارژ کارِ ادمین است. */
@Controller('api/wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  summary(@CurrentUser() session: SessionPayload) {
    return this.wallet.summary(session.sub);
  }
}

/**
 * شارژ از پنلِ ادمین.
 *
 * درگاهِ پرداختِ واقعی عمداً اینجا نیست: تا وقتی ورود یک رمزِ عددیِ مشترک
 * است (`AUTH_PASSWORD`)، هر کسی هر شماره‌ای را تصاحب می‌کند، و پول‌آوردنِ
 * واقعی روی چنین دری یعنی دعوت به سوءاستفاده. اول آن در بسته، بعد درگاه.
 */
@Controller('api/admin/wallet')
@UseGuards(AdminGuard)
export class WalletAdminController {
  constructor(
    private readonly wallet: WalletService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('credit')
  async credit(@Body() body: { phone: string; amount: number; note?: string }) {
    const phone = normalizePhone(body?.phone);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new NotFoundException(`کاربری با شمارهٔ ${phone} پیدا نشد.`);
    const result = await this.wallet.credit(user.id, Number(body.amount), body.note);
    return { phone, ...result };
  }
}
