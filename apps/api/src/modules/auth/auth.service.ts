import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizePhone } from './phone.util';
import { issueToken } from './token.util';

/**
 * احرازِ هویت — موبایل + OTP (D-008).
 *
 * 🟡 حالتِ سندباکس (دستورِ مالک، ۱۹ مرداد): هنوز درگاهِ پیامکی نداریم، پس
 * کدِ ثابتِ عمومی پذیرفته می‌شود و همان کد در پاسخِ API برمی‌گردد تا روی
 * صفحه نشان داده شود. لولهٔ کار — تولیدِ کد، هش، انقضا، شمارشِ تلاش —
 * دقیقاً همان لولهٔ واقعی است؛ فقط «فرستادنِ پیامک» جایش خالی است.
 * روزی که درگاه آمد: `OTP_SANDBOX=false` و پیاده‌سازیِ `sendSms` — نه بیشتر.
 */

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(private readonly prisma: PrismaService) {}

  /** سندباکس پیش‌فرضِ روشن است؛ فقط `OTP_SANDBOX=false` خاموشش می‌کند. */
  private get sandbox(): boolean {
    return (process.env.OTP_SANDBOX ?? 'true').toLowerCase() !== 'false';
  }

  private get sandboxCode(): string {
    return process.env.OTP_SANDBOX_CODE ?? '123456';
  }

  private hash(phone: string, code: string): string {
    // شماره داخلِ هش است تا هشِ یک کاربر برایِ کاربرِ دیگر به‌کار نیاید.
    return createHash('sha256').update(`${phone}:${code}`).digest('hex');
  }

  async requestOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    const code = this.sandbox ? this.sandboxCode : String(randomInt(100000, 1000000));

    const data = {
      otpCodeHash: this.hash(phone, code),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
    };
    // کاربر همین‌جا ساخته می‌شود تا فیلدهای OTP جایی برایِ نشستن داشته باشند؛
    // کیفِ پول در لحظهٔ تأیید ساخته می‌شود، نه اینجا.
    await this.prisma.user.upsert({
      where: { phone },
      update: data,
      create: { phone, ...data },
    });

    if (!this.sandbox) {
      // 🔴 جایِ خالیِ درگاهِ پیامک. تا آن روز `OTP_SANDBOX` روشن می‌ماند.
      throw new BadRequestException(
        'درگاهِ پیامک هنوز وصل نشده است. فعلاً حالتِ سندباکس را روشن بگذار (OTP_SANDBOX=true).',
      );
    }

    this.logger.log(`OTP سندباکس برایِ ${phone}`);
    return {
      phone,
      sandbox: true,
      // فقط در سندباکس برمی‌گردد؛ در حالتِ واقعی این فیلد اصلاً وجود ندارد.
      code,
      message: 'حالتِ سندباکس — پیامکی فرستاده نشد، همین کد را وارد کن.',
    };
  }

  async verifyOtp(rawPhone: string, code: string) {
    const phone = normalizePhone(rawPhone);
    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user?.otpCodeHash || !user.otpExpiresAt) {
      throw new UnauthorizedException('اول کد را درخواست کن.');
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('کد منقضی شده — دوباره درخواست کن.');
    }
    if (user.otpAttempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException('تعدادِ تلاش بیش از حد — کدِ تازه بگیر.');
    }
    if (this.hash(phone, (code ?? '').trim()) !== user.otpCodeHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException('کد درست نیست.');
    }

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        otpCodeHash: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        // کیفِ پول از همین‌جا متولد می‌شود — اسپرینتِ ۳ فقط شارژش می‌کند.
        wallet: { connectOrCreate: { where: { userId: user.id }, create: { balance: 0 } } },
      },
      include: { wallet: true },
    });

    return {
      token: issueToken(verified),
      user: { id: verified.id, phone: verified.phone, balance: verified.wallet?.balance ?? 0 },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true, _count: { select: { projects: true } } },
    });
    if (!user) throw new UnauthorizedException('کاربر پیدا نشد.');
    return {
      id: user.id,
      phone: user.phone,
      balance: user.wallet?.balance ?? 0,
      projectCount: user._count.projects,
      createdAt: user.createdAt,
    };
  }
}
