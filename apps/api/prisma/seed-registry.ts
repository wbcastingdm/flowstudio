/**
 * داده پایه رجیستری محصول.
 *
 * این فایل **تصمیم نمی‌گیرد، تنها گزینه‌ها را می‌چیند**: هر شش نوع تولید
 * ساخته می‌شوند ولی فقط سه تای پیشنهادی فعال‌اند، و قیمت هیچ سطحی پر
 * نمی‌شود. یعنی انتخاب نوع‌های نسخه اول و قیمت‌گذاری هر دو با یک تغییر
 * داده انجام می‌شوند، نه با یک استقرار تازه.
 *
 * بی‌اثر در تکرار: هر بار اجرا شود همان نتیجه را می‌دهد.
 *
 * اجرا:  node dist/prisma/seed-registry.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── نوع تولید ───

const PRODUCTION_TYPES = [
  {
    key: 'ad',
    title: 'تبلیغی',
    description: 'تیزر کوتاه برای معرفی برند، محصول یا خدمت.',
    minDurationSec: 6,
    maxDurationSec: 60,
    orderIndex: 1,
    isActive: true,
    promptGuide:
      'تو یک کارگردان تیزر تبلیغاتی فارسی‌زبانی. قلاب پنج ثانیه اول تعیین‌کننده است ' +
      'و فراخوان اقدام پایانی باید صریح باشد.',
    fieldSchema: [
      {
        key: 'tone',
        label: 'لحن',
        kind: 'select',
        required: true,
        options: [
          { value: 'warm', label: 'گرم و صمیمی' },
          { value: 'professional', label: 'حرفه‌ای' },
          { value: 'energetic', label: 'پرانرژی' },
        ],
      },
      { key: 'brand', label: 'نام برند یا محصول', kind: 'text', required: true },
      { key: 'cta', label: 'فراخوان اقدام', kind: 'text', required: false },
    ],
  },
  {
    key: 'short_film',
    title: 'فیلم کوتاه و داستانی',
    description: 'روایت داستانی با شخصیت و ساختار پرده‌ای.',
    minDurationSec: 60,
    maxDurationSec: 900,
    orderIndex: 2,
    isActive: true,
    promptGuide:
      'تو یک کارگردان فیلم کوتاه فارسی‌زبانی. ساختار سه‌پرده‌ای، قوس شخصیت، و ' +
      'پیوستگی بصری میان نماها را رعایت کن. تعلیق بر توضیح مقدم است.',
    fieldSchema: [
      {
        key: 'genre',
        label: 'ژانر',
        kind: 'select',
        required: true,
        options: [
          { value: 'drama', label: 'درام' },
          { value: 'comedy', label: 'کمدی' },
          { value: 'thriller', label: 'دلهره' },
          { value: 'scifi', label: 'علمی تخیلی' },
          { value: 'social', label: 'اجتماعی' },
        ],
      },
      { key: 'characters', label: 'شخصیت‌های اصلی', kind: 'text', required: false },
      { key: 'location', label: 'لوکیشن غالب', kind: 'text', required: false },
    ],
  },
  {
    key: 'documentary',
    title: 'مستند',
    description: 'روایت واقعی با راوی، آرشیو و ساختار موضوعی.',
    minDurationSec: 180,
    maxDurationSec: 7200,
    orderIndex: 3,
    isActive: true,
    promptGuide:
      'تو یک کارگردان مستند فارسی‌زبانی. روایت بر پایه واقعیت است؛ هر ادعا باید ' +
      'تصویر پشتیبان داشته باشد و ریتم برای تماشای طولانی تنظیم شود.',
    fieldSchema: [
      {
        key: 'narration',
        label: 'سبک روایت',
        kind: 'select',
        required: true,
        options: [
          { value: 'voiceover', label: 'راوی بیرونی' },
          { value: 'interview', label: 'مصاحبه محور' },
          { value: 'observational', label: 'مشاهده‌گر بدون راوی' },
        ],
      },
      { key: 'subject', label: 'موضوع دقیق', kind: 'text', required: true },
      { key: 'sources', label: 'منابع و آرشیو در دسترس', kind: 'text', required: false },
    ],
  },
  {
    key: 'animation',
    title: 'انیمیشن و انیمه',
    description: 'روایت با شخصیت طراحی‌شده و سبک بصری غیرواقعی.',
    minDurationSec: 30,
    maxDurationSec: 600,
    orderIndex: 4,
    isActive: false,
    promptGuide:
      'تو یک کارگردان انیمیشن فارسی‌زبانی. طراحی شخصیت و ثبات سبک بصری میان ' +
      'نماها اولویت اول است.',
    fieldSchema: [
      {
        key: 'visualStyle',
        label: 'سبک بصری',
        kind: 'select',
        required: true,
        options: [
          { value: 'anime', label: 'انیمه' },
          { value: 'cartoon', label: 'کارتونی' },
          { value: 'papercut', label: 'کاغذ بریده' },
          { value: 'threeD', label: 'سه بعدی' },
        ],
      },
      { key: 'characterDesign', label: 'توصیف شخصیت', kind: 'text', required: false },
    ],
  },
  {
    key: 'music_video',
    title: 'موزیک ویدیو',
    description: 'تصویرسازی بر پایه یک قطعه صوتی موجود.',
    minDurationSec: 60,
    maxDurationSec: 300,
    orderIndex: 5,
    isActive: false,
    promptGuide:
      'تو یک کارگردان موزیک ویدیو فارسی‌زبانی. برش‌ها باید با ریتم قطعه هماهنگ ' +
      'باشند و حال و هوای بصری از خود موسیقی بیرون بیاید.',
    fieldSchema: [
      { key: 'mood', label: 'حال و هوا', kind: 'text', required: true },
      { key: 'bpm', label: 'ضرب در دقیقه', kind: 'number', required: false },
    ],
  },
  {
    key: 'educational',
    title: 'آموزشی و توضیحی',
    description: 'انتقال یک مفهوم به مخاطب مشخص.',
    minDurationSec: 60,
    maxDurationSec: 1800,
    orderIndex: 6,
    isActive: false,
    promptGuide:
      'تو یک کارگردان ویدیوی آموزشی فارسی‌زبانی. هر نما باید یک گام از یادگیری ' +
      'را پیش ببرد؛ تصویر باید مفهوم را نشان دهد نه تزئین کند.',
    fieldSchema: [
      { key: 'audience', label: 'سطح مخاطب', kind: 'text', required: true },
      { key: 'outline', label: 'سرفصل‌ها', kind: 'text', required: false },
    ],
  },
];

// ─── سطح خدمت ───
// قیمت عمدا خالی است: تا هزینه واقعی یک ثانیه ویدیو اندازه‌گیری نشود،
// هر عددی حدس است (D-204).

const SERVICE_TIERS = [
  {
    key: 'bronze',
    title: 'برنزی',
    orderIndex: 1,
    coinAllowance: 300,
    maxDurationSec: 30,
    maxCostPerUnit: 5,
    allowedStepTypes: ['text2image', 'image2video', 'programmatic_motion', 'html2image'],
    watermark: true,
    queuePriority: 0,
    humanReview: false,
  },
  {
    key: 'silver',
    title: 'نقره‌ای',
    orderIndex: 2,
    coinAllowance: 1500,
    maxDurationSec: 300,
    maxCostPerUnit: 20,
    allowedStepTypes: [
      'text2image',
      'image2video',
      'text2video',
      'upscale',
      'tts',
      'programmatic_motion',
      'html2image',
    ],
    watermark: false,
    queuePriority: 5,
    humanReview: false,
  },
  {
    key: 'gold',
    title: 'طلایی',
    orderIndex: 3,
    coinAllowance: 8000,
    maxDurationSec: 7200,
    maxCostPerUnit: null,
    allowedStepTypes: [], // خالی یعنی همه گام‌ها، شامل لیپ سینک
    watermark: false,
    queuePriority: 10,
    humanReview: true,
  },
];

// ─── مجوز ───
// «رایگان» یک وضعیت نیست، یک قرارداد است. هر ردیف یکی از معناهای آن است.

const LICENSES = [
  {
    code: 'user_owned',
    title: 'دارایی خود کاربر',
    userFacingSummary: 'این فایل را خودت آورده‌ای؛ مسئولیت حقوقی‌اش هم با خودت است.',
    commercialUse: true,
    attributionRequired: false,
    allowedTargets: [] as string[],
  },
  {
    code: 'cc0',
    title: 'بدون قید',
    userFacingSummary: 'آزاد برای هر استفاده‌ای، بدون نیاز به ذکر نام.',
    commercialUse: true,
    attributionRequired: false,
    allowedTargets: [] as string[],
  },
  {
    code: 'cc_by',
    title: 'نیازمند ذکر نام',
    userFacingSummary:
      'آزاد است، ولی نام سازنده باید در توضیح اثر بیاید. این متن خودکار اضافه می‌شود.',
    commercialUse: true,
    attributionRequired: true,
    attributionTemplate: 'موسیقی: {title} اثر {author} — {source}',
    allowedTargets: [] as string[],
  },
  {
    code: 'royalty_free_commercial',
    title: 'تجاری بدون حق امتیاز',
    userFacingSummary: 'برای انتشار تجاری آزاد است و ذکر نام لازم ندارد.',
    commercialUse: true,
    attributionRequired: false,
    allowedTargets: [] as string[],
  },
  {
    code: 'non_commercial',
    title: 'فقط غیرتجاری',
    userFacingSummary:
      'فقط برای استفاده شخصی. روی سایت عمومی و فلک قابل انتشار نیست، ولی می‌توانی دانلودش کنی.',
    commercialUse: false,
    attributionRequired: true,
    attributionTemplate: 'موسیقی: {title} اثر {author} — استفاده غیرتجاری',
    allowedTargets: ['DOWNLOAD'],
  },
  {
    code: 'subscription_only',
    title: 'وابسته به اشتراک فعال',
    userFacingSummary:
      'تا وقتی اشتراک منبع فعال باشد قابل استفاده است. با پایان اشتراک، اثرهای منتشرشده باید بازبینی شوند.',
    commercialUse: true,
    attributionRequired: false,
    allowedTargets: [] as string[],
  },
];

// ─── کد دلیل ───
//
// متن آزاد نیست تا بعدا بشود شمرد و گزارش گرفت. یک تاکسونومی، یک قرارداد
// نام‌گذاری: کد و دسته هر دو snake_case. کدهای قدیمی که با قرارداد دیگری
// ساخته شده بودند در `LEGACY_REASON_MAP` به همین‌ها نگاشت می‌شوند.
//
// شش دسته: quality (خروجی بد است) · compliance (محتوا مجاز نیست) ·
// legal (حق شخص ثالث) · technical (سیستم شکست خورد) ·
// rule_exception (قاعده کلاس E این‌جا صدق نمی‌کند) · other.

const REASON_CODES = [
  { code: 'brand_mismatch', label: 'با هویت بصری برند همخوانی ندارد', category: 'quality' },
  {
    code: 'pace_cinematic',
    label: 'روایت آرام و سینمایی — قاعده ریتم صدق نمی‌کند',
    category: 'rule_exception',
  },
  {
    code: 'no_offer_present',
    label: 'محتوای برندینگ محض — پیشنهاد فروش ندارد',
    category: 'rule_exception',
  },
  { code: 'other', label: 'دلیل دیگر', category: 'other' },
  { code: 'violence', label: 'خشونت', category: 'compliance' },
  { code: 'discrimination', label: 'تبعیض نژادی یا قومی', category: 'compliance' },
  { code: 'sexual_content', label: 'محتوای جنسی', category: 'compliance' },
  { code: 'minor_involved', label: 'حضور کودک', category: 'compliance' },
  { code: 'religious_offense', label: 'توهین مذهبی', category: 'compliance' },
  { code: 'country_law', label: 'نقض قوانین کشور', category: 'compliance' },
  { code: 'face_without_consent', label: 'چهره شخص حقیقی بدون رضایت', category: 'legal' },
  { code: 'trademark', label: 'نشان تجاری ثبت‌شده', category: 'legal' },
  { code: 'copyrighted_work', label: 'اثر دارای حق نشر', category: 'legal' },
  { code: 'license_mismatch', label: 'مجوز با مقصد انتشار نمی‌خواند', category: 'legal' },
  { code: 'low_quality', label: 'کیفیت خروجی پایین', category: 'quality' },
  { code: 'off_brief', label: 'خروجی با درخواست نمی‌خواند', category: 'quality' },
  { code: 'continuity_break', label: 'شکست پیوستگی میان نماها', category: 'quality' },
  { code: 'provider_error', label: 'خطای سرویس تولید', category: 'technical' },
  { code: 'timeout', label: 'اتمام مهلت', category: 'technical' },
];

/**
 * کدهای دوره اول که با قرارداد دیگری ساخته شده بودند.
 *
 * حذفشان ممکن نیست چون ممکن است ردیف‌های `Generation` به آن‌ها اشاره کنند.
 * پس به‌جای حذف، به معادل تازه‌شان نگاشت می‌شوند: ارجاع‌ها منتقل و ردیف
 * قدیمی پاک می‌شود. اگر معادلی نداشت، فقط دسته‌اش یکسان‌سازی می‌شود.
 */
const LEGACY_REASON_MAP: Record<string, string> = {
  QUALITY_ISSUE: 'low_quality',
  BRAND_MISMATCH: 'brand_mismatch',
  PACE_CINEMATIC: 'pace_cinematic',
  NO_OFFER_PRESENT: 'no_offer_present',
  OTHER: 'other',
};

async function mergeLegacyReasonCodes() {
  let moved = 0;
  for (const [oldCode, newCode] of Object.entries(LEGACY_REASON_MAP)) {
    const old = await prisma.reasonCode.findUnique({ where: { code: oldCode } });
    if (!old) continue;
    const fresh = await prisma.reasonCode.findUnique({ where: { code: newCode } });
    if (!fresh) continue;

    // ارجاع‌ها منتقل شوند، بعد ردیف قدیمی برود.
    await prisma.generation.updateMany({
      where: { reasonCodeId: old.id },
      data: { reasonCodeId: fresh.id },
    });
    await prisma.complianceCheck.updateMany({
      where: { reasonCodeId: old.id },
      data: { reasonCodeId: fresh.id },
    });
    await prisma.publication.updateMany({
      where: { reasonCodeId: old.id },
      data: { reasonCodeId: fresh.id },
    });
    await prisma.reasonCode.delete({ where: { id: old.id } });
    moved++;
  }
  return moved;
}

async function main() {
  let counts = { types: 0, tiers: 0, licenses: 0, reasons: 0 };

  for (const t of PRODUCTION_TYPES) {
    await prisma.productionType.upsert({
      where: { key: t.key },
      update: {
        title: t.title,
        description: t.description,
        minDurationSec: t.minDurationSec,
        maxDurationSec: t.maxDurationSec,
        fieldSchema: t.fieldSchema,
        promptGuide: t.promptGuide,
        orderIndex: t.orderIndex,
        // `isActive` عمدا به‌روزرسانی نمی‌شود: اگر مالک نوعی را در پنل
        // روشن یا خاموش کرد، اجرای دوباره این فایل تصمیمش را برنگرداند.
      },
      create: { ...t },
    });
    counts.types++;
  }

  for (const s of SERVICE_TIERS) {
    await prisma.serviceTier.upsert({
      where: { key: s.key },
      update: {
        title: s.title,
        orderIndex: s.orderIndex,
        coinAllowance: s.coinAllowance,
        maxDurationSec: s.maxDurationSec,
        maxCostPerUnit: s.maxCostPerUnit,
        allowedStepTypes: s.allowedStepTypes,
        watermark: s.watermark,
        queuePriority: s.queuePriority,
        humanReview: s.humanReview,
        // `priceIrt` دست نمی‌خورد — قیمت تصمیم مالک است.
      },
      create: { ...s },
    });
    counts.tiers++;
  }

  for (const l of LICENSES) {
    const { allowedTargets, ...rest } = l;
    await prisma.mediaLicense.upsert({
      where: { code: l.code },
      update: { ...rest, allowedTargets: allowedTargets as never },
      create: { ...rest, allowedTargets: allowedTargets as never },
    });
    counts.licenses++;
  }

  for (const r of REASON_CODES) {
    await prisma.reasonCode.upsert({
      where: { code: r.code },
      update: { label: r.label, category: r.category },
      create: r,
    });
    counts.reasons++;
  }

  const merged = await mergeLegacyReasonCodes();

  const active = await prisma.productionType.count({ where: { isActive: true } });
  console.log(
    `نوع تولید: ${counts.types} (${active} فعال) · سطح خدمت: ${counts.tiers} · ` +
      `مجوز: ${counts.licenses} · کد دلیل: ${counts.reasons} (${merged} کد قدیمی ادغام شد)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
