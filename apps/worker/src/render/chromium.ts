import { spawn } from 'child_process';
import { accessSync, constants } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { chromeCandidates, config } from '../config';

/**
 * HTML → PNG با مرورگرِ بدونِ سر.
 *
 * تنها راهِ کشیدنِ فارسیِ درست است؛ چرایش در `config.ts` نوشته شده.
 */

let resolvedBinary: string | null = null;

export function findChrome(): string {
  if (resolvedBinary) return resolvedBinary;
  for (const candidate of chromeCandidates()) {
    try {
      accessSync(candidate, constants.X_OK);
      resolvedBinary = candidate;
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(
    `مرورگرِ بدونِ سر پیدا نشد. یکی از این‌ها باید باشد یا CHROME_BIN تنظیم شود:\n  ${chromeCandidates().join('\n  ')}`,
  );
}

export interface ShotOptions {
  html: string;
  width: number;
  height: number;
  /** پس‌زمینهٔ شفاف — برایِ لایهٔ متن. */
  transparent: boolean;
  workDir: string;
  name: string;
}

export async function htmlToPng(opts: ShotOptions): Promise<Buffer> {
  const binary = findChrome();
  const htmlPath = join(opts.workDir, `${opts.name}.html`);
  const pngPath = join(opts.workDir, `${opts.name}.png`);
  await writeFile(htmlPath, opts.html, 'utf8');

  const args = [
    // `=new` مهم است: در حالتِ قدیمی پرچمِ پس‌زمینهٔ شفاف نادیده گرفته
    // می‌شود و لایهٔ متن با زمینهٔ سفید بیرون می‌آید — که روی ویدیو یک
    // مستطیلِ سفیدِ تمام‌قد است، نه متنِ شناور.
    '--headless=new',
    '--disable-gpu',
    // کانتینر روتی است و بدونِ این، کروم اصلاً بالا نمی‌آید.
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${opts.width},${opts.height}`,
    `--screenshot=${pngPath}`,
  ];
  if (opts.transparent) args.push('--default-background-color=00000000');
  args.push(`file://${htmlPath}`);

  await run(binary, args, config.stepTimeoutMs);
  const png = await readFile(pngPath);
  if (png.length < 1024) {
    throw new Error(`تصویرِ تولیدشده مشکوک کوچک است (${png.length} بایت) — احتمالاً صفحه خالی رندر شد.`);
  }
  return png;
}

/** اجرا با مهلت. پروسهٔ گیرکرده نباید کارگر را برایِ همیشه ببندد. */
export function run(binary: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      // فقط دمِ خروجی نگه داشته می‌شود؛ کروم روی هر اجرا ده‌ها خطِ بی‌ربط
      // می‌ریزد و نگه‌داشتنِ همه‌اش فقط لاگ را کور می‌کند.
      stderr = (stderr + String(chunk)).slice(-2000);
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`اجرا از ${Math.round(timeoutMs / 1000)} ثانیه گذشت: ${binary}`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolvePromise();
      reject(new Error(`${binary} با کدِ ${code} شکست خورد: ${stderr.trim().slice(-600)}`));
    });
  });
}
