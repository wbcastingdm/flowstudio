import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream, type ReadStream } from 'fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve, sep } from 'path';

/**
 * نگهداری فایل روی دیسک.
 *
 * چرا دیسک و نه پایگاه داده: بایت باینری هرگز داخل Postgres نمی‌رود —
 * پشتیبان‌گیری را چند برابر می‌کند و هر کوئری ساده را کند.
 *
 * چرا این‌جا و نه پوشه عمومی وب: دارایی کاربر خصوصی است. فایل بیرون از هر
 * مسیر قابل سرو ذخیره می‌شود و فقط از راه یک مسیر محافظت‌شده خوانده می‌شود.
 * روزی که آبجکت استوریج آمد، تنها همین کلاس عوض می‌شود.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor() {
    this.root = resolve(process.env.STORAGE_DIR ?? join(process.cwd(), 'storage'));
  }

  /**
   * کلید از هش محتوا ساخته می‌شود، نه از نام فایل کاربر.
   *
   * دو دلیل: نام فایل کاربر می‌تواند `../` داشته باشد یا نویسه‌ای که سیستم
   * فایل را بشکند؛ و هش یعنی یک فایل تکراری دو بار جا نمی‌گیرد.
   */
  buildKey(userId: string, sha256: string, ext: string): string {
    const safeExt = (ext || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    return `assets/${userId}/${sha256.slice(0, 2)}/${sha256}.${safeExt}`;
  }

  sha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async write(key: string, buffer: Buffer): Promise<void> {
    const path = this.absolutePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.absolutePath(key));
  }

  /** اندازه فایل بدون خواندنش. پاسخ بازه‌ای بدون این عدد ساخته نمی‌شود. */
  async size(key: string): Promise<number> {
    return (await stat(this.absolutePath(key))).size;
  }

  /**
   * جریان خواندن، با بازه اختیاری.
   *
   * چرا جریان و نه `read`: ویدیو با `<video>` پخش می‌شود و مرورگر برای
   * جابه‌جا شدن روی نوار زمان درخواست بازه‌ای می‌فرستد. اگر کل فایل هر بار
   * در حافظه خوانده شود، چند بیننده همزمان روی یک فایل چندمگابایتی حافظه
   * کانتینر را می‌بلعند — و سافاری بدون پاسخ بازه‌ای اصلا پخش نمی‌کند.
   */
  stream(key: string, range?: { start: number; end: number }): ReadStream {
    return createReadStream(this.absolutePath(key), range);
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.absolutePath(key));
    } catch (err) {
      // نبودن فایل خطا نیست: هدف «نباشد» است و همان الان هم نیست.
      this.logger.warn(`حذف ${key} انجام نشد: ${String(err)}`);
    }
  }

  /**
   * ⚠️ تنها جایی که کلید به مسیر واقعی تبدیل می‌شود.
   *
   * بررسی می‌کند مسیر نهایی حتما زیر ریشه بماند. بدون این، کلیدی مثل
   * `../../etc/passwd` هر فایلی روی سرور را خواندنی می‌کرد. کلید امروز از
   * هش ساخته می‌شود و امن است، ولی این گارد نباید به آن تکیه کند — فردا
   * ممکن است کلید از جای دیگری بیاید.
   */
  private absolutePath(key: string): string {
    const path = resolve(this.root, key);
    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new InternalServerErrorException('کلید فایل نامعتبر است.');
    }
    return path;
  }
}
