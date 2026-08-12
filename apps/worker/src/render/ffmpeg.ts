import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';
import { run } from './chromium';

const execFileAsync = promisify(execFile);

/**
 * پلِ ماژولِ حرکت.
 *
 * `@flowstudio/motion` عمداً ESM است (یک اسکریپتِ مستقل که بدونِ هیچ
 * ساختی اجرا می‌شود) و کارگر CommonJS است. `import()`ِ معمولی را TypeScript
 * در خروجیِ CJS به `require` تبدیل می‌کند و بارگذاریِ ESM می‌شکند؛ ساختنِ
 * تابع در زمانِ اجرا تنها راهی است که کامپایلر دستش به آن نمی‌رسد.
 *
 * چرا اصلاً از همان ماژول: رشتهٔ فیلترِ حرکت یک بار نوشته شده و شواهدِ
 * `probe-route-c.txt` روی همان اندازه‌گیری شده. کپی‌کردنش این‌جا یعنی دو
 * پیاده‌سازی که فردا واگرا می‌شوند.
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<MotionModule>;

interface MotionSpec {
  preset: string;
  aspect: string;
  durationSec: number;
  fps?: number;
  fadeSec?: number;
  grain?: boolean;
  vignette?: boolean;
  threads?: number;
  crf?: number;
  encodePreset?: string;
}

interface MotionModule {
  buildLayeredFfmpegArgs(
    spec: MotionSpec,
    backgroundPath: string,
    overlayPath: string | null,
    outputPath: string,
  ): string[];
  buildConcatArgs(listPath: string, outputPath: string): string[];
  PRESETS: Record<string, unknown>;
}

let motion: MotionModule | null = null;

async function loadMotion(): Promise<MotionModule> {
  if (!motion) motion = await dynamicImport('@flowstudio/motion');
  return motion;
}

export async function knownPresets(): Promise<string[]> {
  return Object.keys((await loadMotion()).PRESETS);
}

/** زمینهٔ متحرک + لایهٔ شفافِ متن → یک کلیپ. */
export async function renderShotClip(opts: {
  backgroundPath: string;
  textPath: string | null;
  outputPath: string;
  preset: string;
  aspect: string;
  durationSec: number;
}): Promise<void> {
  const { buildLayeredFfmpegArgs } = await loadMotion();
  const presets = await knownPresets();
  // پریستِ ناشناخته بی‌صدا به `still` نمی‌افتد: ویدیوی بی‌حرکت خروجیِ سالم
  // به‌نظر می‌رسد و کسی نمی‌فهمد پلان چیزِ دیگری خواسته بود.
  if (!presets.includes(opts.preset)) {
    throw new Error(`پریستِ ناشناخته «${opts.preset}» — مجازها: ${presets.join('، ')}`);
  }

  const args = buildLayeredFfmpegArgs(
    {
      preset: opts.preset,
      aspect: opts.aspect,
      durationSec: opts.durationSec,
      fps: 30,
      fadeSec: 0.4,
      grain: true,
      threads: config.ffmpegThreads,
      crf: 20,
      encodePreset: 'medium',
    },
    opts.backgroundPath,
    opts.textPath,
    opts.outputPath,
  );

  await run(config.ffmpegBin, ['-hide_banner', '-loglevel', 'error', ...args], config.stepTimeoutMs);
}

/** چسباندنِ کلیپ‌ها بدونِ رمزگذاریِ دوباره. */
export async function concatClips(listPath: string, outputPath: string): Promise<void> {
  const { buildConcatArgs } = await loadMotion();
  await run(
    config.ffmpegBin,
    ['-hide_banner', '-loglevel', 'error', ...buildConcatArgs(listPath, outputPath)],
    config.stepTimeoutMs,
  );
}

/**
 * مدتِ **واقعیِ** فایل، از خودِ فایل.
 *
 * عددِ پلان ملاک نیست: اگر ffmpeg یک فریم کم‌وزیاد بگذارد، ردیفِ تولید باید
 * چیزی را ثبت کند که واقعاً بیرون آمده — وگرنه مخرجِ CPAS از روزِ اول دروغ
 * می‌گوید.
 */
export async function probeDurationSec(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(config.ffprobeBin, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      path,
    ]);
    const seconds = Number(String(stdout).trim());
    return Number.isFinite(seconds) ? Math.round(seconds) : null;
  } catch {
    // نبودنِ ffprobe نباید تولید را بشکند؛ فقط یک عددِ گزارشی کم می‌شود.
    return null;
  }
}
