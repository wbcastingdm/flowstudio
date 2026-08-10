import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * قفلِ پنلِ ادمین — رازِ مشترک در هدرِ `x-admin-key`.
 *
 * چرا «کاربرِ ادمین» ملاک نیست: تا وقتی `OTP_SANDBOX` روشن است هر کسی با هر
 * شماره‌ای و کدِ ثابت وارد می‌شود، پس نقشِ کاربری هیچ چیزی را قفل نمی‌کند.
 * این راز مستقل از نشست است و روزی که سندباکس خاموش شد هم معتبر می‌ماند.
 *
 * **fail-closed:** اگر `ADMIN_PASSWORD` تنظیم نشده باشد هیچ‌کس رد نمی‌شود.
 * پنلِ بازِ ثبتِ درگاه روی دامنهٔ عمومی بدتر از پنلِ خاموش است — کسی می‌تواند
 * درگاهِ خودش را جا بزند و ترافیکِ کاربران را به سرورِ خودش ببرد.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      throw new ServiceUnavailableException(
        'پنلِ ادمین قفل است — ADMIN_PASSWORD روی سرور تنظیم نشده.',
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers['x-admin-key'];
    const given = Array.isArray(raw) ? raw[0] : raw;

    if (!given || !constantTimeEqual(given, expected)) {
      throw new UnauthorizedException('رمزِ پنلِ ادمین درست نیست.');
    }
    return true;
  }
}

/**
 * هر دو طرف اول هش می‌شوند تا `timingSafeEqual` همیشه دو بافرِ هم‌طول ببیند —
 * وگرنه طولِ راز از تفاوتِ زمانِ پاسخ قابلِ حدس‌زدن است.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(ha, hb);
}
