import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import { config } from './config';

/**
 * نوشتنِ خروجی روی همان دیسکی که API از آن می‌خواند.
 *
 * ⚠️ الگویِ کلید **عیناً** همان `StorageService`ی API است. اگر یکی از این دو
 * عوض شود و آن یکی نه، فایل نوشته می‌شود ولی هرگز خوانده نمی‌شود و هیچ
 * خطایی هم نمی‌دهد — فقط دانلودِ کاربر ۴۰۴ می‌گیرد. هر تغییری این‌جا باید
 * هم‌زمان در `apps/api/src/modules/assets/storage.service.ts` بیفتد.
 */

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildKey(userId: string, hash: string, ext: string): string {
  const safeExt = (ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  return `assets/${userId}/${hash.slice(0, 2)}/${hash}.${safeExt}`;
}

/** همان گاردِ مسیرِ API: کلید هرگز از ریشه بیرون نمی‌زند. */
function absolutePath(key: string): string {
  const path = resolve(config.storageDir, key);
  if (path !== config.storageDir && !path.startsWith(config.storageDir + sep)) {
    throw new Error(`کلیدِ فایل نامعتبر است: ${key}`);
  }
  return path;
}

/**
 * خواندنِ خروجیِ یک گامِ قبلی.
 *
 * لازم است چون کار ممکن است **نیمه‌کاره** از سر گرفته شود: کارگر وسطِ
 * زنجیره کرش کند، کار به صف برگردد، و کارگرِ بعدی گام‌های تمام‌شده را
 * دوباره اجرا نکند. بدونِ این، هر ری‌استارت یعنی رندرِ دوبارهٔ همه‌چیز.
 */
export async function load(key: string): Promise<Buffer> {
  return readFile(absolutePath(key));
}

/** فایل را ذخیره می‌کند و کلید و هش و اندازه‌اش را برمی‌گرداند. */
export async function store(
  userId: string,
  buffer: Buffer,
  ext: string,
): Promise<{ key: string; hash: string; byteSize: number }> {
  const hash = sha256(buffer);
  const key = buildKey(userId, hash, ext);
  const path = absolutePath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  return { key, hash, byteSize: buffer.length };
}
