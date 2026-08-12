import { cpus, hostname } from 'os';
import { resolve } from 'path';

/**
 * همهٔ تنظیماتِ کارگر در یک جا.
 *
 * هیچ عددِ جادویی وسطِ کد پخش نمی‌شود: اگر فردا کسی بخواهد بداند کارگر هر
 * چند ثانیه صف را نگاه می‌کند یا با چند نخ انکود می‌کند، همین یک فایل را
 * باز می‌کند.
 */

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const config = {
  /**
   * شناسهٔ این کارگر — داخلِ `Job.lockedBy` می‌نشیند.
   *
   * نامِ میزبان به‌تنهایی کافی نیست: دو کارگر روی یک ماشین شناسهٔ یکسان
   * می‌گرفتند و آن‌وقت `complete` کارِ همدیگر را می‌بست، چون شرطش
   * `lockedBy = <شناسه>` است. شناسهٔ پروسه تفکیکشان می‌کند.
   */
  workerId: process.env.WORKER_ID ?? `${hostname()}-${process.pid}`,

  /** هر چند میلی‌ثانیه صف را نگاه کند وقتی خالی است. */
  idlePollMs: int('WORKER_POLL_MS', 3000),

  /**
   * هر چند دقیقه کارِ یخ‌زده به صف برگردد.
   *
   * ⚠️ باید از طولانی‌ترین کارِ ممکن بیشتر باشد، وگرنه کارِ سالمِ در حالِ
   * اجرا دزدیده می‌شود و دو کارگر هم‌زمان روی یک نما کار می‌کنند.
   */
  reclaimAfterMinutes: int('WORKER_RECLAIM_MINUTES', 20),
  reclaimEveryMs: int('WORKER_RECLAIM_EVERY_MS', 60_000),

  /** ریشهٔ ذخیرهٔ دارایی — همان والیومی که API هم به آن وصل است. */
  storageDir: resolve(process.env.STORAGE_DIR ?? resolve(process.cwd(), 'storage')),

  /** پوشهٔ کارِ موقت. هر کار پوشهٔ خودش را می‌گیرد و آخرش پاک می‌کند. */
  tmpDir: process.env.WORKER_TMP ?? '/tmp/flowstudio-worker',

  /**
   * نخِ ffmpeg.
   *
   * پیش‌فرض «همهٔ هسته‌ها منهایِ یک» است تا ماشین زیرِ رندر خفه نشود و
   * API همچنان جواب بدهد. عددِ ۱ فقط برایِ **اندازه‌گیری** بود (سندِ ۸۱)،
   * نه برایِ تولید.
   */
  ffmpegThreads: int('FFMPEG_THREADS', Math.max(1, cpus().length - 1)),
  ffmpegBin: process.env.FFMPEG_BIN ?? 'ffmpeg',
  ffprobeBin: process.env.FFPROBE_BIN ?? 'ffprobe',

  /** مهلتِ هر گام — کارِ گیرکرده نباید کارگر را برایِ همیشه ببندد. */
  stepTimeoutMs: int('WORKER_STEP_TIMEOUT_MS', 10 * 60_000),
};

/**
 * مرورگرِ بدونِ سر.
 *
 * 🔴 چرا اصلاً مرورگر: **هیچ راهِ دیگری برایِ متنِ فارسیِ درست نیست.**
 * `drawtext`ِ ffmpeg چسبشِ حروف و جهتِ راست‌به‌چپ را بی‌صدا خراب می‌کند و
 * هیچ خطایی هم نمی‌دهد؛ مدل‌های تصویری هم نوشتهٔ فارسیِ خوانا تولید
 * نمی‌کنند. موتورِ HTML تنها چیزی است که کشیدنِ فارسی را درست بلد است
 * (شواهد: `evidence/probe-route-c.txt` بندِ ۱).
 */
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean) as string[];

export function chromeCandidates(): string[] {
  return CHROME_CANDIDATES;
}
