import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from './config';
import { findChrome } from './render/chromium';

const execFileAsync = promisify(execFile);

/**
 * نسخهٔ دقیقِ موتورهایی که خروجی را ساخته‌اند.
 *
 * `Generation.modelVersion` عمداً یک **رشتهٔ منجمد** است و نه کلیدِ خارجی
 * (شِما، همان‌جا): ردیفِ تولید باید تا ابد بگوید «این فایل را همین نسخه
 * ساخت»، حتی اگر فردا ffmpeg ارتقا پیدا کند. یک گامِ محلی هم دقیقاً مثلِ
 * یک مدلِ بیرونی نسخه دارد — و بدونِ ثبتش، اختلافِ کیفیتِ دو اجرا هیچ
 * توضیحی ندارد.
 *
 * یک بار در شروعِ کارگر خوانده می‌شود؛ اجرایِ دو پروسهٔ اضافه به‌ازای هر
 * گام، روی سرورِ سه‌هسته‌ای هزینهٔ بیهوده است.
 */

interface Engines {
  chromium: string;
  ffmpeg: string;
}

let cached: Engines | null = null;

async function firstLine(binary: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(binary, args);
    return String(stdout).split('\n')[0].trim().slice(0, 120);
  } catch {
    return 'نامعلوم';
  }
}

export async function engines(): Promise<Engines> {
  if (cached) return cached;
  const [chromium, ffmpeg] = await Promise.all([
    firstLine(findChrome(), ['--version']),
    firstLine(config.ffmpegBin, ['-version']),
  ]);
  cached = { chromium, ffmpeg };
  return cached;
}
