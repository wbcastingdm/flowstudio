import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * رمزنگاریِ متقارنِ apiKey — گاردریلِ منشورِ اجرا: «هرگز متنِ خام».
 * کلید از FLOWSTUDIO_SECRET (env) مشتق می‌شود؛ الگوریتم: AES-256-GCM.
 */
const ALGO = 'aes-256-gcm';

/**
 * 🔴 **بدونِ پیش‌فرض — عمدی.**
 *
 * تا ۲۱ مرداد این `?? 'dev-only-insecure-secret-change-me'` بود؛ رشته‌ای که
 * در خودِ مخزن نوشته شده. یعنی هرکسی که هم کد را دیده باشد و هم به دیتابیس
 * برسد، می‌توانست **کلیدهای درگاه‌های هوش مصنوعی را رمزگشایی کند** — همان
 * چیزی که «هرگز متنِ خام» قرار بود جلویش را بگیرد. رمزنگاری با کلیدِ
 * همگان‌دانسته، رمزنگاری نیست؛ فقط شبیهش است.
 */
function deriveKey(): Buffer {
  const secret = (process.env.FLOWSTUDIO_SECRET ?? '').trim();
  if (!secret) {
    throw new Error(
      'FLOWSTUDIO_SECRET ست نشده — کلیدهای درگاه با رازِ پیش‌فرض رمز نمی‌شوند.',
    );
  }
  return scryptSync(secret, 'flowstudio-ai-provider-salt', 32);
}

export function encryptApiKey(plain: string): string {
  const iv = randomBytes(12);
  const key = deriveKey();
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptApiKey(stored: string): string {
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const key = deriveKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/** برایِ نمایش در پنلِ ادمین — هرگز کلیدِ کامل نشان داده نشود. */
export function maskApiKey(plain: string): string {
  if (plain.length <= 8) return '****';
  return `${plain.slice(0, 4)}${'*'.repeat(plain.length - 8)}${plain.slice(-4)}`;
}
