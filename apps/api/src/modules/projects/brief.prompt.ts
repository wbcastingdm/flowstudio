import type { MaterialStyle } from '@prisma/client';
import type { TypeField } from '../registry/registry.service';

/**
 * قواعد کلاس E — از knowledge/rules/E-class-v1.md، برگرفته از راهنمای رسمی
 * ABCD گوگل. **فقط برای نوع تبلیغی صادق‌اند**: قلاب پنج ثانیه‌ای و فراخوان
 * اقدام در یک مستند نه لازم است نه درست.
 *
 * تزریق این قواعد به هر نوعی، همان اشتباهی است که کل محصول را به «ابزار
 * تیزرسازی» تقلیل می‌دهد.
 */
const E_RULES_FOR_ADS = [
  'برند یا محصول باید در پنج ثانیه اول ویدیو معرفی شود.',
  'در پنج ثانیه اول بیش از دو نما یا کات باشد تا مخاطب قلاب شود.',
  'نمای ابتدایی، نمای نزدیک از شخص یا محصول باشد.',
  'اگر ویدیو شخصی دارد، با حضور او روی صحنه باز شود.',
  'فراخوان اقدام پایانی مشخص باشد.',
  'پیام ساده، متمرکز و ملموس باشد.',
];

const MATERIAL_FA: Record<MaterialStyle, string> = {
  REAL: 'واقعی و زنده',
  ANIME: 'انیمه',
  COMIC: 'کمیک',
  FANTASY: 'فانتزی',
  THREE_D: 'سه بعدی',
  STOP_MOTION: 'استاپ موشن',
};

export interface BriefPromptInput {
  rawIdea: string;
  /** راهنمای لحن همان نوع تولید — از رجیستری می‌آید، نه از کد. */
  promptGuide: string;
  typeKey: string;
  typeTitle: string;
  /** شمای فیلدهای همان نوع، برای اینکه پاسخ‌ها با برچسب خوانا نوشته شوند. */
  fieldSchema: unknown;
  attributes: Record<string, unknown>;
  targetDurationSec: number;
  materialStyle?: MaterialStyle | null;
  materialFidelity?: number | null;
}

/** پاسخ‌های کاربر را با برچسب فارسی و مقدار خوانا می‌نویسد. */
function renderAttributes(fieldSchema: unknown, attributes: Record<string, unknown>): string {
  const fields = (Array.isArray(fieldSchema) ? fieldSchema : []) as TypeField[];
  const lines: string[] = [];
  for (const f of fields) {
    const v = attributes?.[f.key];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    let shown = String(v);
    if (f.kind === 'select') {
      shown = f.options?.find((o) => o.value === v)?.label ?? shown;
    }
    lines.push(`${f.label}: ${shown}`);
  }
  return lines.join('\n');
}

/**
 * مدت طولانی یعنی تعداد نمای زیاد. برای فرم بلند نمی‌شود کل شات‌لیست را در
 * یک فراخوان خواست — نه در پنجره متن جا می‌شود، نه خروجی‌اش منسجم می‌ماند.
 * پس سقف نما در هر فراخوان گذاشته می‌شود و بقیه در گام بعدی ساخته می‌شود.
 */
const MAX_SHOTS_PER_CALL = 40;

function shotBudget(targetDurationSec: number) {
  const avgShotSec = targetDurationSec > 600 ? 6 : targetDurationSec > 120 ? 5 : 4;
  const ideal = Math.ceil(targetDurationSec / avgShotSec);
  return { ideal, capped: Math.min(ideal, MAX_SHOTS_PER_CALL) };
}

/**
 * خروجی عمدا JSON سخت‌گیرانه است تا مستقیم به ساختار نما نگاشت شود، نه متن
 * آزاد. هر فیلد متن آزاد اضافه یعنی شکاف واژگان میان لایه فهم و لایه تولید.
 */
export function buildBriefPrompt(input: BriefPromptInput): string {
  const { ideal, capped } = shotBudget(input.targetDurationSec);
  const partial = capped < ideal;

  const material = input.materialStyle
    ? `\nجنس تصویر: ${MATERIAL_FA[input.materialStyle]}` +
      (input.materialFidelity != null
        ? ` (درجه نزدیکی به این جنس: ${input.materialFidelity} از ۱۰۰)`
        : '')
    : '';

  const attrs = renderAttributes(input.fieldSchema, input.attributes);
  const rules = input.typeKey === 'ad' ? E_RULES_FOR_ADS : [];

  return `${input.promptGuide}

از ایده زیر یک شات‌لیست حرفه‌ای بساز.

ایده کاربر:
"""
${input.rawIdea}
"""

نوع تولید: ${input.typeTitle}${material}
مدت کل هدف: ${input.targetDurationSec} ثانیه
${attrs}

${
  rules.length > 0
    ? `قواعدی که باید رعایت کنی:\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
    : ''
}برای هر نما علاوه بر توضیح، عناصر کارگردانی را هم بنویس. اگر ایده کاربر
درباره‌شان چیزی نگفته، خودت متناسب با نوع و جنس تصویر پیشنهاد بده.

خروجی را فقط به شکل JSON زیر بده، بدون هیچ متن اضافه و بدون markdown:
{
  "title": "عنوان کوتاه پروژه",
  "sequences": [
    {
      "title": "نام سکانس",
      "shots": [
        {
          "durationSec": 4,
          "description": "توضیح دقیق آنچه در این نما دیده می‌شود",
          "cameraMovement": "STATIC",
          "miseEnScene": "چیدمان صحنه: چه کسی کجاست، پس‌زمینه چیست",
          "shotSize": "MEDIUM",
          "cameraAngle": "EYE_LEVEL",
          "lighting": "نور و ساعت روز",
          "colorMood": "رنگ غالب و حال و هوا"
        }
      ]
    }
  ]
}

قواعد خروجی:
- cameraMovement فقط یکی از: STATIC, PAN, TILT, DOLLY, HANDHELD, COMBINED
- shotSize فقط یکی از: EXTREME_WIDE, WIDE, MEDIUM, CLOSE_UP, EXTREME_CLOSE_UP
- cameraAngle فقط یکی از: EYE_LEVEL, LOW, HIGH, OVERHEAD, DUTCH
- durationSec عدد صحیح بین ۲ تا ۱۵
- description و miseEnScene و lighting و colorMood فارسی و بصری باشند
- تعداد نماها حدود ${capped} تا باشد${
    partial
      ? `\n- ⚠️ این ایده برای ${ideal} نما است ولی فقط ${capped} نمای **اول** را بساز؛ ادامه‌اش جداگانه خواسته می‌شود. سکانس‌ها را نیمه‌کاره رها نکن — تا پایان آخرین سکانسی که جا می‌شود برو.`
      : `\n- جمع مدت همه نماها تقریبا برابر ${input.targetDurationSec} ثانیه باشد`
  }
- برای محتوای کوتاه یک سکانس کافی است؛ برای بلندتر چند سکانس بساز`;
}
