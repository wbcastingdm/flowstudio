import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizePhone } from './phone.util';
import { issueToken } from './token.util';

/**
 * ورود — شمارهٔ موبایل + یک **رمزِ عددیِ ثابت** (دستورِ مالک، ۲۱ مرداد).
 *
 * 🟡 چرا رمزِ ثابت و نه OTP: درگاهِ پیامکی هنوز خریداری نشده. تا آن روز هر
 * سازوکاری که «کد بفرست» باشد یک نمایشِ توخالی است — کد را خودِ صفحه نشان
 * می‌داد و کاربر فقط یک دکمهٔ اضافه می‌زد. یک رمزِ عددیِ صریح همان اندازه
 * باز است ولی دروغ نمی‌گوید.
 *
 * 🔴 **این یک درِ باز است و باید پیش از اولین ریالِ واقعی بسته شود**
 * (قلمِ ۲۱ چک‌لیست). امروز هر کسی با هر شماره‌ای و همین رمز وارد می‌شود.
 * روزی که درگاهِ پیامک آمد، تنها چیزی که عوض می‌شود همین فایل است: تولیدِ
 * کد، `sendSms`، و انقضا. مسیرِ توکن و ساختِ کیفِ پول دست‌نخورده می‌ماند.
 *
 * هویت مالِ FlowStudio است (قراردادِ جدایشِ سندِ ۸۱ بخشِ ۱۲): SSOِ وبکستینگ
 * روزی فقط یک `authProvider`ِ دیگر خواهد بود، نه صاحبِ کاربر.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(private readonly prisma: PrismaService) {}

  /** رمزِ عددیِ مشترک. از متغیرِ محیطی می‌آید تا عوض‌کردنش کد نخواهد. */
  private get password(): string {
    return (process.env.AUTH_PASSWORD ?? '123456').trim();
  }

  /**
   * آیا صفحهٔ ورود رمز را نشان بدهد.
   *
   * تا وقتی رمز عمومی و مشترک است، پنهان‌کردنش امنیتی اضافه نمی‌کند و فقط
   * کاربرِ آزمایشی را سرگردان می‌کند. روزِ بستنِ سندباکس این را `false` کن.
   */
  private get showHint(): boolean {
    return (process.env.AUTH_PASSWORD_HINT ?? 'true').toLowerCase() !== 'false';
  }

  /** آنچه صفحهٔ ورود پیش از هر تلاشی می‌پرسد. */
  policy() {
    return {
      mode: 'shared_password' as const,
      digits: this.password.length,
      hint: this.showHint ? this.password : null,
    };
  }

  async login(rawPhone: string, rawPassword: string) {
    const phone = normalizePhone(rawPhone);

    if (!this.matches(rawPassword)) {
      // شماره در پیامِ خطا تکرار نمی‌شود — نه به کسی می‌گوید این شماره ثبت
      // است و نه لاگ را با شمارهٔ کاربر پر می‌کند.
      this.logger.warn('تلاشِ ورود با رمزِ نادرست');
      throw new UnauthorizedException('رمز درست نیست.');
    }

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    // کیفِ پول از همین‌جا متولد می‌شود — درگاهِ پرداخت فقط شارژش می‌کند.
    // جدا از upsertِ بالا، چون کاربرِ قدیمی هم ممکن است هنوز کیف نداشته باشد.
    const wallet = await this.prisma.wallet.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    return {
      token: issueToken(user),
      user: { id: user.id, phone: user.phone, balance: wallet.balance },
    };
  }

  /**
   * مقایسهٔ زمان‌ثابت.
   *
   * برایِ رمزِ عمومیِ امروز لازم نیست، ولی این تابع همان جایی است که فردا
   * رمزِ واقعی از آن رد می‌شود — و آن روز کسی یادش نمی‌افتد برگردد `===` را
   * عوض کند.
   */
  private matches(candidate: string): boolean {
    const a = Buffer.from((candidate ?? '').trim(), 'utf8');
    const b = Buffer.from(this.password, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
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
