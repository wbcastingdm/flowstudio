/**
 * FlowStudio Intermediate Representation (IR)
 *
 * ProjectIR -> SequenceIR -> ShotIR — سه سطح، از روزِ اول.
 * حتی وقتی فازِ ۱ فقط یک سکانس/یک شات می‌سازد، شکلِ داده باید بتواند
 * چند سکانس و چند شات را بدونِ بازنویسی نگه دارد (docs/40 بندِ ۳).
 *
 * این پکیج فقط تایپ است — هیچ دیتابیس، هیچ منطقِ کسب‌وکار.
 * طبقِ گاردریلِ منشورِ اجرا: در Shot فقط یک فیلدِ متنِ آزاد مجاز است
 * (description) — هر فیلدِ متنِ آزادِ دیگر شکافِ واژگان است و باید گزارش شود.
 */

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type CameraMovement =
  | 'STATIC'
  | 'PAN'
  | 'TILT'
  | 'DOLLY'
  | 'HANDHELD'
  | 'COMBINED';

export type CampaignGoal =
  | 'BRAND_AWARENESS' // آگاهی از برند
  | 'ORDER_CAPTURE' // جذب سفارش آنلاین
  | 'PRODUCT_INTRO'; // معرفی محصول جدید

export type Tone =
  | 'WARM_FRIENDLY' // گرم و صمیمی
  | 'PROFESSIONAL' // حرفه‌ای
  | 'ENERGETIC'; // پرانرژی

/** کلاسِ اعتبارِ شواهدِ یک قاعده — قلبِ لایهٔ دانش (docs/00 بندِ ۱-۱). */
export type EvidenceClass = 'E' | 'C' | 'A';

/** ارجاع به یک قاعدهٔ اعمال‌شده روی یک شات، + وضعیتِ پذیرش/مخالفتِ کاربر. */
export interface AppliedRuleRef {
  ruleCode: string;
  evidenceClass: EvidenceClass;
  accepted: boolean;
  /** اگر کاربر مخالفت کرد، کدِ دلیل — نه متنِ آزاد (docs/00 بندِ ۱-۱). */
  humanReasonCode?: string;
}

/**
 * جایگاهِ پیوستگیِ بینِ نماها — شخصیت/لوکیشن/پراپ.
 * فیلدِ رزروشده: در فازِ ۱ همیشه null می‌ماند، ولی حذف نمی‌شود
 * (docs/40 بندِ ۳، الزامِ ۲؛ منشورِ اجرا بخشِ ۹ ایرادِ ۴).
 */
export interface ContinuityRef {
  characterRefs?: string[];
  locationRef?: string;
  propRefs?: string[];
}

export type ShotStatus = 'DRAFT' | 'QUEUED' | 'GENERATING' | 'DONE' | 'REJECTED';

export interface ShotIR {
  id: string;
  sequenceId: string;
  order: number;
  durationSec: number;
  /** تنها فیلدِ متنِ آزادِ مجاز در این سطح. */
  description: string;
  cameraMovement: CameraMovement;
  aspectRatio: AspectRatio;
  seed: number | null;
  continuityRef: ContinuityRef | null;
  appliedRules: AppliedRuleRef[];
  status: ShotStatus;
}

export interface SequenceIR {
  id: string;
  projectId: string;
  order: number;
  title: string;
  shots: ShotIR[];
}

export interface ProjectIR {
  id: string;
  title: string;
  goal: CampaignGoal;
  tone: Tone;
  sequences: SequenceIR[];
}

/** خروجیِ مرحلهٔ «ایده → بریف» (نیازِ ۳، docs/60) — همیشه رایگان. */
export interface BriefIR {
  projectId: string;
  rawIdea: string;
  goal: CampaignGoal;
  tone: Tone;
  /** شات‌لیستِ اولیه، پیش از انتخابِ فریم/تولیدِ واقعی. */
  proposedSequences: SequenceIR[];
}

/** مجموعِ مدتِ یک پروژه — برایِ سنجشِ کوتاه/میان/فرم‌بلند (docs/40). */
export function totalDurationSec(project: ProjectIR): number {
  return project.sequences
    .flatMap((s) => s.shots)
    .reduce((sum, shot) => sum + shot.durationSec, 0);
}
