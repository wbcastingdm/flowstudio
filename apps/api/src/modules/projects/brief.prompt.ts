import type { CampaignGoal, Tone } from '@prisma/client';

const GOAL_FA: Record<CampaignGoal, string> = {
  BRAND_AWARENESS: 'آگاهی از برند',
  ORDER_CAPTURE: 'جذب سفارشِ آنلاین',
  PRODUCT_INTRO: 'معرفیِ محصولِ جدید',
};

const TONE_FA: Record<Tone, string> = {
  WARM_FRIENDLY: 'گرم و صمیمی',
  PROFESSIONAL: 'حرفه‌ای',
  ENERGETIC: 'پرانرژی',
};

/**
 * قواعدِ کلاسِ E که در پرامپت تزریق می‌شوند — از knowledge/rules/E-class-v1.md.
 * منبع: راهنمایِ رسمیِ ABCDِ گوگل (۵۰۰۰+ تبلیغ، بازبینیِ Nielsen/Kantar).
 * فقط قواعدی که روی «ساختِ شات‌لیست» اثرِ مستقیم دارند اینجا می‌آیند.
 */
const E_RULES_FOR_SHOTLIST = [
  'برند یا محصول باید در پنج ثانیهٔ اولِ ویدیو معرفی شود.',
  'در پنج ثانیهٔ اول بیش از دو نما/کات باشد تا مخاطب قلاب شود.',
  'نمای ابتدایی، نمای نزدیک (tightly-framed) از شخص یا محصول باشد.',
  'اگر ویدیو شخصی دارد، با حضورِ او روی صحنه باز شود.',
  'فراخوانِ اقدامِ پایانی مشخص باشد (مثلاً «به سایت برو»، «همین حالا سفارش بده»).',
  'پیام ساده، متمرکز و ملموس باشد.',
];

export interface BriefPromptInput {
  rawIdea: string;
  goal: CampaignGoal;
  tone: Tone;
  targetDurationSec: number;
}

/**
 * خروجیِ موردِ انتظار عمداً JSONِ سخت‌گیرانه است تا مستقیماً به ShotIR نگاشت
 * شود — نه متنِ آزاد. هر فیلدِ متنِ آزادِ اضافه یعنی شکافِ واژگان
 * (گاردریلِ منشورِ اجرا).
 */
export function buildBriefPrompt(input: BriefPromptInput): string {
  return `تو یک کارگردانِ تیزرِ تبلیغاتیِ فارسی‌زبانی. از ایدهٔ زیر یک شات‌لیستِ حرفه‌ای بساز.

ایدهٔ کاربر:
"""
${input.rawIdea}
"""

هدفِ کمپین: ${GOAL_FA[input.goal]}
لحن: ${TONE_FA[input.tone]}
مدتِ کلِ هدف: حدودِ ${input.targetDurationSec} ثانیه

قواعدی که باید رعایت کنی (مبتنی بر پژوهشِ ABCDِ گوگل):
${E_RULES_FOR_SHOTLIST.map((r, i) => `${i + 1}. ${r}`).join('\n')}

خروجی را **فقط** به‌شکلِ JSONِ زیر بده، بدونِ هیچ متنِ اضافه، بدونِ markdown:
{
  "title": "عنوانِ کوتاهِ پروژه",
  "sequences": [
    {
      "title": "نامِ سکانس",
      "shots": [
        {
          "durationSec": 3,
          "description": "توضیحِ دقیقِ آنچه در این نما دیده می‌شود",
          "cameraMovement": "STATIC"
        }
      ]
    }
  ]
}

قواعدِ خروجی:
- cameraMovement فقط یکی از این‌ها: STATIC, PAN, TILT, DOLLY, HANDHELD, COMBINED
- durationSec عددِ صحیح بینِ ۲ تا ۱۰
- جمعِ مدتِ همهٔ نماها تقریباً برابرِ ${input.targetDurationSec} ثانیه باشد
- description فارسی، مشخص و بصری باشد (چه چیزی در کادر دیده می‌شود)
- برایِ تیزرِ کوتاه یک سکانس کافی است؛ برایِ محتوایِ بلندتر چند سکانس بساز`;
}
