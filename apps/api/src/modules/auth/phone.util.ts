import { BadRequestException } from '@nestjs/common';

/**
 * شمارهٔ موبایلِ ایران را به شکلِ یکتای `+989xxxxxxxxx` می‌آورد.
 * ورودی‌های پذیرفته: `09123456789` · `9123456789` · `989123456789` ·
 * `+989123456789` — با یا بدونِ فاصله/خط‌تیره و با ارقامِ فارسی/عربی.
 *
 * چرا مهم است: `User.phone` یکتاست. اگر یک کاربر یک‌بار `0912…` و بارِ دیگر
 * `+98912…` بزند، بدونِ نرمال‌سازی دو کاربرِ جدا می‌شود و کتابخانه‌اش گم.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizePhone(raw: string): string {
  if (!raw) throw new BadRequestException('شمارهٔ موبایل خالی است');

  let s = '';
  for (const ch of raw.trim()) {
    const p = PERSIAN_DIGITS.indexOf(ch);
    const a = ARABIC_DIGITS.indexOf(ch);
    if (p !== -1) s += String(p);
    else if (a !== -1) s += String(a);
    else s += ch;
  }
  s = s.replace(/[\s\-()]/g, '');

  if (s.startsWith('+98')) s = s.slice(3);
  else if (s.startsWith('0098')) s = s.slice(4);
  else if (s.startsWith('98') && s.length === 12) s = s.slice(2);
  else if (s.startsWith('0')) s = s.slice(1);

  if (!/^9\d{9}$/.test(s)) {
    throw new BadRequestException('شمارهٔ موبایل معتبر نیست — مثلاً ۰۹۱۲۳۴۵۶۷۸۹');
  }
  return `+98${s}`;
}
