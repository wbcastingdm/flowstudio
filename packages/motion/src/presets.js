/**
 * مسیرِ ج (سندِ ۸۱، جدولِ زنجیره‌ها): تصویرِ ثابت → حرکتِ برنامه‌ای.
 * هیچ مدلی صدا زده نمی‌شود؛ هزینه فقط ثانیهٔ CPU است.
 *
 * این فایل عمداً هیچ وابستگی و هیچ I/O ندارد — فقط رشتهٔ فیلترِ ffmpeg
 * می‌سازد، تا بدونِ نصبِ ffmpeg هم بشود درستی‌اش را آزمود.
 *
 * ⚠️ چرا `zoompan` تنها کافی نیست: روی تصویرِ هم‌اندازهٔ خروجی، پرشِ
 * پیکسلی («jitter») می‌دهد چون مختصاتِ برش را گِرد می‌کند. راهِ درست،
 * بزرگ‌کردنِ تصویر پیش از zoompan است (`PRESCALE`) تا هر فریم فضای
 * کافی برای برشِ زیرپیکسلی داشته باشد.
 */

export const ASPECTS = {
  R9_16: { w: 1080, h: 1920 },
  R16_9: { w: 1920, h: 1080 },
  R1_1: { w: 1080, h: 1080 },
};

/** ضریبِ بزرگ‌نماییِ میانی — ۲ برابر برای حذفِ پرشِ zoompan. */
const PRESCALE = 2;

export const PRESETS = {
  /** آرام به داخل — کارِ نمای لوگو و متن. */
  kenburns_in: { zoomFrom: 1.0, zoomTo: 1.12, xFrom: 0.5, xTo: 0.5, yFrom: 0.5, yTo: 0.5 },
  /** آرام به بیرون — کارِ نمای بازکنندهٔ فضا. */
  kenburns_out: { zoomFrom: 1.12, zoomTo: 1.0, xFrom: 0.5, xTo: 0.5, yFrom: 0.5, yTo: 0.5 },
  /** حرکتِ افقی از راست به چپ — هم‌جهت با خواندنِ فارسی. */
  pan_rl: { zoomFrom: 1.14, zoomTo: 1.14, xFrom: 0.68, xTo: 0.32, yFrom: 0.5, yTo: 0.5 },
  pan_lr: { zoomFrom: 1.14, zoomTo: 1.14, xFrom: 0.32, xTo: 0.68, yFrom: 0.5, yTo: 0.5 },
  /** فشارِ مورب — حسِ سه‌بعدیِ ارزان روی نمای محصول. */
  push_diagonal: { zoomFrom: 1.02, zoomTo: 1.16, xFrom: 0.42, xTo: 0.58, yFrom: 0.58, yTo: 0.42 },
  /** بی‌حرکت — پایهٔ مقایسه، تا معلوم شود هزینهٔ خودِ حرکت چقدر است. */
  still: { zoomFrom: 1.0, zoomTo: 1.0, xFrom: 0.5, xTo: 0.5, yFrom: 0.5, yTo: 0.5 },
};

/** درون‌یابیِ خطی برحسبِ فریمِ جاری (`on`) روی کلِ فریم‌ها. */
function lerp(from, to, frames) {
  if (from === to) return String(from);
  return `${from}+(${to}-${from})*on/${Math.max(1, frames - 1)}`;
}

/**
 * رشتهٔ `-filter_complex` را می‌سازد.
 * @param {{preset:string, aspect:string, durationSec:number, fps?:number,
 *          fadeSec?:number, vignette?:boolean, grain?:boolean}} spec
 */
export function buildMotionFilter(spec) {
  const preset = PRESETS[spec.preset];
  if (!preset) {
    throw new Error(`پریستِ ناشناخته: ${spec.preset} — یکی از ${Object.keys(PRESETS).join(', ')}`);
  }
  const aspect = ASPECTS[spec.aspect];
  if (!aspect) {
    throw new Error(`نسبتِ ناشناخته: ${spec.aspect} — یکی از ${Object.keys(ASPECTS).join(', ')}`);
  }
  const fps = spec.fps ?? 30;
  const frames = Math.max(1, Math.round(spec.durationSec * fps));
  const { w, h } = aspect;

  // ۱) پرکردنِ کادر بدونِ کِش‌آمدن: بزرگ‌نمایی تا پوششِ کامل، بعد برش.
  //    `increase` تضمین می‌کند هیچ نوارِ سیاهی نمی‌ماند.
  const cover = `scale=${w * PRESCALE}:${h * PRESCALE}:force_original_aspect_ratio=increase:flags=lanczos`;
  const crop = `crop=${w * PRESCALE}:${h * PRESCALE}`;

  // ۲) حرکت. `zoom` نسبت به تصویرِ بزرگ‌شده است، پس مبنا ۱ می‌ماند.
  const z = lerp(preset.zoomFrom, preset.zoomTo, frames);
  // x/y مرکزِ کادر است (۰ تا ۱)؛ فرمولِ زیر مرکز را به گوشهٔ چپ‌بالا می‌برد.
  const cx = lerp(preset.xFrom, preset.xTo, frames);
  const cy = lerp(preset.yFrom, preset.yTo, frames);
  const zoompan =
    `zoompan=z='${z}'` +
    `:x='(iw-iw/zoom)*(${cx})'` +
    `:y='(ih-ih/zoom)*(${cy})'` +
    `:d=${frames}:s=${w}x${h}:fps=${fps}`;

  const chain = [cover, crop, zoompan];

  // ۳) دانهٔ ریزِ تصویری — ثابت‌بودنِ منبع را کمتر لو می‌دهد. تقریباً رایگان.
  if (spec.grain) chain.push('noise=alls=6:allf=t+u');

  // ۴) وینیت — تمرکز روی مرکزِ کادر.
  if (spec.vignette) chain.push('vignette=PI/5');

  // ۵) محوشدگیِ ابتدا و انتها.
  const fade = spec.fadeSec ?? 0;
  if (fade > 0) {
    chain.push(`fade=t=in:st=0:d=${fade}`);
    chain.push(`fade=t=out:st=${Math.max(0, spec.durationSec - fade)}:d=${fade}`);
  }

  chain.push('format=yuv420p');
  return chain.join(',');
}

/**
 * آرگومان‌های کاملِ ffmpeg — بدونِ اجرا، تا قابلِ آزمون باشد.
 *
 * ⚠️ `threads` پیش‌فرض ۱ است و این عمدی است: با یک نخ، زمانِ دیواری
 * همان ثانیهٔ CPU است و عدد بینِ مکِ ۸هسته‌ای و سرورِ ۳هسته‌ای قابلِ
 * مقایسه می‌شود. برایِ تولیدِ واقعی بالاترش ببر.
 */
export function buildFfmpegArgs(spec, inputPath, outputPath) {
  const fps = spec.fps ?? 30;
  return [
    '-y',
    '-threads', String(spec.threads ?? 1),
    '-loop', '1',
    '-i', inputPath,
    '-vf', buildMotionFilter(spec),
    '-t', String(spec.durationSec),
    '-r', String(fps),
    '-c:v', 'libx264',
    '-x264-params', `threads=${spec.threads ?? 1}`,
    '-preset', spec.encodePreset ?? 'medium',
    '-crf', String(spec.crf ?? 20),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ];
}
