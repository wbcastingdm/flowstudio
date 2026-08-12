/**
 * کاتالوگِ درگاه‌های نمونه.
 *
 * برداشته‌شده از ماژولِ استودیوی AIِ وبکستینگ — همان درگاه‌هایی که آن‌جا
 * سال‌هاست کار می‌کنند. سه چیز عمداً **کپی نشد**:
 *
 *   ✗ هیچ کلیدی. کلید مالِ حسابِ وبکستینگ است و بردنش به محصولِ دیگر یعنی
 *     دو محصول روی یک اعتبار — اولین باری که سقف پر شود، هر دو می‌خوابند و
 *     هیچ‌کس نمی‌فهمد کدامشان مقصر بوده.
 *   ✗ هیچ ردیفی از دیتابیسِ وبکستینگ. قاعدهٔ جدایش: هرگز به دیتابیسِ آن
 *     پروژه دست نمی‌زنیم. این فهرست از **سورسِ خوانده‌شده** درآمده.
 *   ✗ هیچ تغییری در آن پروژه. فقط سه فایل خوانده شد.
 *
 * 🔑 و این جدول **رجیستریِ زنده نیست**. ردیف‌هایش فقط فرمِ «درگاهِ جدید» را
 * پر می‌کنند. تا وقتی مالک کلیدِ واقعی نزند، `/studio` مثلِ امروز از
 * برنامه‌ریزِ محلی استفاده می‌کند و چیزی نمی‌شکند.
 *
 * بی‌اثر در تکرار: هر بار اجرا شود همان نتیجه را می‌دهد.
 *
 * اجرا:  node dist/prisma/seed-gateways.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ⚠️ `sampleModels` فقط متنِ پرکنندهٔ فرم است و **هیچ‌وقت مبنایِ انتخابِ
 * روتر نیست** (گاردریلِ ۱: نامِ مدل در کدِ تصمیم‌گیر نمی‌آید). روتر روی
 * `stepTypes` و هزینه تصمیم می‌گیرد، روی ردیفی که مالک خودش ساخته.
 */
const GATEWAYS = [
  {
    key: 'avalai',
    title: 'AvalAI',
    baseUrl: 'https://api.avalai.ir/v1',
    summary: 'تجمیع‌کنندهٔ ایرانی، سازگار با OpenAI. متن و تصویر و گفتار از یک کلید.',
    bearerAuth: true,
    stepTypes: ['text2image', 'tts', 'stt', 'subtitle'],
    sampleModels: ['gpt-4o-mini', 'dall-e-3', 'whisper-1', 'tts-1'],
    docsUrl: 'https://avalai.ir',
    orderIndex: 1,
  },
  {
    key: 'gapgpt',
    title: 'GapGPT',
    baseUrl: 'https://api.gapgpt.app/v1',
    summary: 'تجمیع‌کنندهٔ ایرانی، سازگار با OpenAI. پرداخت ریالی.',
    bearerAuth: true,
    stepTypes: ['text2image', 'tts', 'stt'],
    sampleModels: ['gpt-4o-mini', 'dall-e-3'],
    docsUrl: 'https://gapgpt.app',
    orderIndex: 2,
  },
  {
    key: 'openai',
    title: 'OpenAI مستقیم',
    baseUrl: 'https://api.openai.com/v1',
    summary: 'مرجعِ استاندارد. از داخلِ ایران بدونِ واسط در دسترس نیست.',
    bearerAuth: true,
    stepTypes: ['text2image', 'tts', 'stt', 'subtitle'],
    sampleModels: ['gpt-4o-mini', 'dall-e-3', 'whisper-1', 'tts-1-hd'],
    docsUrl: 'https://platform.openai.com/docs',
    orderIndex: 3,
  },
  {
    key: 'deepseek',
    title: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    summary: 'فقط متن، ارزان. برایِ گامِ شات‌لیست کافی است.',
    bearerAuth: true,
    stepTypes: [],
    sampleModels: ['deepseek-chat'],
    docsUrl: 'https://platform.deepseek.com',
    orderIndex: 4,
  },
  {
    key: 'arvancloud-ai',
    title: 'ابرِ آروان',
    baseUrl: 'https://api.arvancloudai.ir/v1',
    // ⚠️ تنها درگاهِ این فهرست که کلید را در هدر نمی‌گیرد؛ احراز داخلِ خودِ
    // آدرس است. اگر این تفاوت نادیده گرفته شود، فراخوان ۴۰۱ می‌گیرد و علتش
    // شبیهِ «کلید اشتباه» به‌نظر می‌رسد.
    bearerAuth: false,
    summary: 'میزبانِ داخلی. احراز داخلِ آدرس است، نه در هدرِ Bearer.',
    stepTypes: ['text2image'],
    sampleModels: [],
    docsUrl: 'https://www.arvancloud.ir',
    orderIndex: 5,
  },
  {
    key: 'anthropic',
    title: 'Anthropic (مستقیم)',
    baseUrl: 'https://api.anthropic.com/v1',
    summary: 'فقط متن. قراردادش با OpenAI فرق دارد و آداپترِ خودش را می‌خواهد.',
    bearerAuth: true,
    stepTypes: [],
    sampleModels: [],
    docsUrl: 'https://docs.anthropic.com',
    orderIndex: 6,
  },
  {
    key: 'liara',
    title: 'لیارا',
    baseUrl: 'https://ai.liara.ir/api/v1',
    // خروجیِ تصویرش base64 است نه لینک — مصرف‌کننده باید هر دو را بپذیرد.
    summary: 'میزبانِ داخلی. تصویر را base64 برمی‌گرداند، نه لینک.',
    bearerAuth: true,
    stepTypes: ['text2image'],
    sampleModels: [],
    docsUrl: 'https://liara.ir',
    orderIndex: 7,
  },
];

async function main() {
  for (const g of GATEWAYS) {
    await prisma.gatewayPreset.upsert({
      where: { key: g.key },
      update: g,
      create: g,
    });
  }
  const total = await prisma.gatewayPreset.count();
  console.log(`کاتالوگِ درگاه: ${total} ردیف`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
