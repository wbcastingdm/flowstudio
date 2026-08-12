import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ساختِ صفحهٔ HTMLِ هر لایه.
 *
 * دو لایه، دو صفحه، و عمداً هیچ‌وقت یکی: زمینه هیچ حرفی ندارد و متن هیچ
 * زمینه‌ای. روزی که زمینه از یک مدلِ تصویری بیاید، فقط تولیدکنندهٔ لایهٔ
 * زمینه عوض می‌شود و لایهٔ متن دست نمی‌خورد (قاعدهٔ ۹ منشور).
 */

export const ASPECTS: Record<string, { w: number; h: number }> = {
  R9_16: { w: 1080, h: 1920 },
  R16_9: { w: 1920, h: 1080 },
  R1_1: { w: 1080, h: 1080 },
};

/**
 * 🔴 فونت باید **data-URI** باشد.
 *
 * مرورگرِ بدونِ سر با `file://` بارگذاریِ فونت از مسیرِ نسبی را گاهی رها
 * می‌کند و بی‌هیچ خطایی به فونتِ پیش‌فرضِ سیستم می‌افتد — که روی سرورِ لینوکسی
 * فارسی را جعبه‌جعبه می‌کشد. تصویر تولید می‌شود، خروجیِ ffmpeg سبز است، و
 * خرابی فقط وقتی دیده می‌شود که کسی فایل را تماشا کند.
 */
const FONT_DIR = join(__dirname, '..', '..', 'assets', 'fonts');

function fontDataUri(file: string): string {
  const buf = readFileSync(join(FONT_DIR, file));
  return `data:font/woff2;base64,${buf.toString('base64')}`;
}

let fontCss: string | null = null;

function fonts(): string {
  if (fontCss) return fontCss;
  fontCss = `
    @font-face {
      font-family: Vazirmatn;
      src: url('${fontDataUri('Vazirmatn-400.woff2')}') format('woff2');
      font-weight: 400;
    }
    @font-face {
      font-family: Vazirmatn;
      src: url('${fontDataUri('Vazirmatn-800.woff2')}') format('woff2');
      font-weight: 800;
    }`;
  return fontCss;
}

/**
 * رنگِ هر نما — قطعی، و عمداً دور از رنگِ نمای قبلی.
 *
 * دو الزام با هم: اجرایِ دوباره باید **دقیقاً** همان تصویر را بدهد (وگرنه
 * مقایسهٔ دو اجرا بی‌معنا می‌شود)، و نماهای پشتِ‌سرِ هم نباید هم‌رنگ دربیایند.
 *
 * ⚠️ هشِ شناسهٔ نما به‌تنهایی الزامِ دوم را برآورده نمی‌کند: شناسه‌ها در یک
 * ثانیه ساخته می‌شوند و پیشوندِ مشترکِ بلندی دارند، پس رنگ‌ها دور هم جمع
 * می‌شوند و فیلم یک‌دست سبز درمی‌آید. چرخشِ **زاویهٔ طلایی** (۱۳۷ درجه) به
 * ازای هر نما، بیشترین فاصلهٔ ممکن روی چرخهٔ رنگ را تضمین می‌کند؛ هشِ عنوانِ
 * پروژه فقط نقطهٔ شروع را تعیین می‌کند تا دو پروژه یک‌شکل نباشند.
 */
const GOLDEN_ANGLE = 137;

function hueFor(projectTitle: string, shotOrder: number): number {
  let seed = 0;
  for (let i = 0; i < projectTitle.length; i++) {
    seed = (seed * 31 + projectTitle.charCodeAt(i)) % 360;
  }
  return (seed + shotOrder * GOLDEN_ANGLE) % 360;
}

/**
 * رقمِ لاتین → رقمِ فارسی.
 *
 * بدونِ این، «نمای 2 از 5» وسطِ یک جملهٔ فارسی می‌نشیند: هم ناهماهنگ است و
 * هم جهتِ خواندن را می‌شکند. جای دیگری برایِ رفعش نیست — متن از این‌جا
 * مستقیم داخلِ پیکسل می‌رود.
 */
function faDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface LayerInput {
  shotId: string;
  shotOrder: number;
  shotCount: number;
  description: string;
  projectTitle: string;
  aspect: string;
  /** واترمارکِ متنی (D-010). خالی یعنی بدونِ واترمارک. */
  watermark?: string | null;
}

function size(aspect: string) {
  return ASPECTS[aspect] ?? ASPECTS.R9_16;
}

/** زمینه — بدونِ یک حرف متن. */
export function backgroundHtml(input: LayerInput): string {
  const { w, h } = size(input.aspect);
  const hue = hueFor(input.projectTitle, input.shotOrder);
  const hue2 = (hue + 48) % 360;
  const min = Math.min(w, h);

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; }
  html, body { width:${w}px; height:${h}px; overflow:hidden; background:#0f1115; }
  .stage {
    position:relative; width:${w}px; height:${h}px;
    background:
      radial-gradient(${min * 1.1}px ${min * 1.1}px at 22% 18%, hsl(${hue} 62% 34%) 0%, transparent 62%),
      radial-gradient(${min * 1.3}px ${min * 1.3}px at 82% 78%, hsl(${hue2} 58% 28%) 0%, transparent 60%),
      linear-gradient(152deg, #12161f 0%, #0d1016 52%, #161022 100%);
  }
  /* بافتِ ریزِ خطی — سطح را از «رنگِ تخت» درمی‌آورد و به zoompan چیزی
     می‌دهد که رویش حرکت دیده شود. */
  .grain {
    position:absolute; inset:0;
    background-image: repeating-linear-gradient(
      45deg, rgba(255,255,255,.028) 0 2px, rgba(0,0,0,0) 2px 5px);
    mix-blend-mode: overlay;
  }
  .glow {
    position:absolute; border-radius:50%; filter: blur(${Math.round(min / 12)}px);
    opacity:.38;
  }
  .g1 { width:${min * 0.62}px; height:${min * 0.62}px; left:${-min * 0.18}px; top:${h * 0.1}px;
        background: hsl(${hue} 74% 48%); }
  .g2 { width:${min * 0.48}px; height:${min * 0.48}px; right:${-min * 0.14}px; top:${h * 0.58}px;
        background: hsl(${hue2} 70% 44%); }
  /* باریکهٔ نورِ مورب — کادر را از «دو لکهٔ رنگ» به یک نمای دارایِ جهت
     تبدیل می‌کند و به zoompan لبه‌ای می‌دهد که حرکتش دیده شود. */
  .streak {
    position:absolute; inset:${-h * 0.2}px ${-w * 0.4}px;
    background: linear-gradient(112deg, transparent 38%, rgba(255,255,255,.09) 48%,
                rgba(255,255,255,.02) 53%, transparent 62%);
  }
  .vig { position:absolute; inset:0;
         background: radial-gradient(120% 88% at 50% 46%, transparent 44%, rgba(0,0,0,.62) 100%); }
</style></head>
<body><div class="stage">
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="streak"></div><div class="grain"></div><div class="vig"></div>
</div></body></html>`;
}

/**
 * لایهٔ متن — پس‌زمینهٔ کاملاً شفاف.
 *
 * اندازهٔ قلم از **طولِ متن** می‌آید نه از یک عددِ ثابت: توضیحِ یک نما گاهی
 * ده کلمه است و گاهی شصت، و قلمِ ثابت یا نصفِ کادر را خالی می‌گذارد یا از
 * پایینِ تصویر می‌زند بیرون. سرریز هم بریده می‌شود تا هرگز از کادر نزند.
 */
export function textHtml(input: LayerInput): string {
  const { w, h } = size(input.aspect);
  const text = input.description.trim();
  const len = text.length;

  const base = Math.round(w / 20);
  const scale = len <= 60 ? 1.25 : len <= 120 ? 1.05 : len <= 200 ? 0.9 : 0.78;
  const fontSize = Math.round(base * scale);
  const pad = Math.round(w * 0.075);

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${fonts()}
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${w}px; height:${h}px; overflow:hidden; background:transparent; }
  .layer {
    position:relative; width:${w}px; height:${h}px;
    font-family: Vazirmatn, sans-serif; direction:rtl; color:#fff;
  }
  /* پردهٔ نرمِ پایین — بدونِ آن متنِ روشن روی زمینهٔ روشن ناخوانا می‌شود.
     شفافیتش تدریجی است تا مثلِ یک نوارِ چسبانده‌شده دیده نشود. */
  .scrim {
    position:absolute; left:0; right:0; bottom:0; height:${Math.round(h * 0.52)}px;
    background: linear-gradient(to top, rgba(6,8,12,.88) 0%, rgba(6,8,12,.62) 42%, rgba(6,8,12,0) 100%);
  }
  .body {
    position:absolute; left:${pad}px; right:${pad}px; bottom:${Math.round(h * 0.11)}px;
  }
  .badge {
    display:inline-block; font-weight:800; font-size:${Math.round(fontSize * 0.5)}px;
    letter-spacing:.5px; padding:${Math.round(fontSize * 0.18)}px ${Math.round(fontSize * 0.5)}px;
    border-radius:999px; background:rgba(78,163,255,.16); color:#8fc4ff;
    border:1px solid rgba(78,163,255,.42); margin-bottom:${Math.round(fontSize * 0.55)}px;
  }
  .text {
    font-weight:800; font-size:${fontSize}px; line-height:1.62;
    text-shadow: 0 ${Math.round(fontSize * 0.06)}px ${Math.round(fontSize * 0.28)}px rgba(0,0,0,.75);
    display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:6; overflow:hidden;
  }
  .title {
    margin-top:${Math.round(fontSize * 0.6)}px; font-weight:400;
    font-size:${Math.round(fontSize * 0.44)}px; color:rgba(255,255,255,.66);
  }
  .mark {
    position:absolute; top:${pad}px; left:${pad}px; font-size:${Math.round(w / 58)}px;
    font-weight:400; color:rgba(255,255,255,.42); letter-spacing:.4px;
  }
</style></head>
<body><div class="layer">
  <div class="scrim"></div>
  ${input.watermark ? `<div class="mark">${escapeHtml(input.watermark)}</div>` : ''}
  <div class="body">
    <span class="badge">${faDigits(`نمای ${input.shotOrder} از ${input.shotCount}`)}</span>
    <div class="text">${faDigits(escapeHtml(text))}</div>
    <div class="title">${faDigits(escapeHtml(input.projectTitle))}</div>
  </div>
</div></body></html>`;
}
