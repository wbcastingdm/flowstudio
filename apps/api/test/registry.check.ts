/**
 * آزمون یکپارچه رجیستری محصول — فاز ۳، قفل معماری.
 *
 * چهار ادعای معماری را می‌سنجد:
 *   ۱. زیرشاخه‌ها به نوع تولید وابسته‌اند و اعتبارسنجی‌شان از رجیستری می‌آید.
 *   ۲. سطح خدمت با سیاست کار می‌کند، نه با فهرست شناسه مدل.
 *   ۳. مجوز رسانه مقصد انتشار را فیلتر می‌کند («قوانین رایگان»).
 *   ۴. افزودن نوع تولید تازه هیچ مهاجرتی نمی‌خواهد.
 *
 * اجرا:  node dist/test/registry.check.js
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RegistryService } from '../src/modules/registry/registry.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? '✅' : '❌'} ${label}  →  ${JSON.stringify(actual)}${ok ? '' : ` (انتظار: ${JSON.stringify(expected)})`}`,
  );
}

async function expectThrow(label: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    failures++;
    console.log(`❌ ${label}  →  هیچ خطایی نداد`);
  } catch (err) {
    console.log(`✅ ${label}  →  ${String((err as Error).message).slice(0, 95)}`);
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const registry = app.get(RegistryService);
  const prisma = app.get(PrismaService);

  console.log('\n■ ۱) نوع تولید و زیرشاخه‌های وابسته به آن');
  const active = await registry.listProductionTypes();
  check('نوع‌های فعال', active.map((t) => t.key), ['ad', 'short_film', 'documentary']);
  const all = await registry.listProductionTypes(true);
  check('کل نوع‌ها شش تاست', all.length, 6);

  const ad = await registry.getProductionType('ad');
  const film = await registry.getProductionType('short_film');
  const adFields = (ad.fieldSchema as Array<{ key: string }>).map((f) => f.key);
  const filmFields = (film.fieldSchema as Array<{ key: string }>).map((f) => f.key);
  check('تبلیغ لحن می‌پرسد', adFields.includes('tone'), true);
  check('تبلیغ ژانر نمی‌پرسد', adFields.includes('genre'), false);
  check('فیلم کوتاه ژانر می‌پرسد', filmFields.includes('genre'), true);
  check('فیلم کوتاه لحن نمی‌پرسد', filmFields.includes('tone'), false);

  console.log('\n■ ۲) اعتبارسنجی زیرشاخه در برابر شمای همان نوع');
  check(
    'ورودی درست تبلیغ',
    registry.validateAttributes(ad.fieldSchema, { tone: 'warm', brand: 'نان سنگک' }),
    { tone: 'warm', brand: 'نان سنگک' },
  );
  await expectThrow('فیلد اجباری غایب', () =>
    registry.validateAttributes(ad.fieldSchema, { tone: 'warm' }),
  );
  await expectThrow('مقدار خارج از فهرست', () =>
    registry.validateAttributes(ad.fieldSchema, { tone: 'سرد', brand: 'x' }),
  );
  await expectThrow('ژانر روی تبلیغ پذیرفته نمی‌شود چون اجباری‌اش غایب است', () =>
    registry.validateAttributes(ad.fieldSchema, { genre: 'drama' }),
  );
  check(
    'فیلد ناشناخته دور ریخته می‌شود، نه ذخیره',
    registry.validateAttributes(ad.fieldSchema, {
      tone: 'warm',
      brand: 'x',
      hackerField: 'drop me',
    }),
    { tone: 'warm', brand: 'x' },
  );

  console.log('\n■ ۳) سطح خدمت با سیاست، نه با فهرست شناسه مدل');
  const bronze = await registry.getServiceTier('bronze');
  const gold = await registry.getServiceTier('gold');
  check('برنزی سقف هزینه دارد', bronze.maxCostPerUnit, 5);
  check('طلایی بی‌سقف است', gold.maxCostPerUnit, null);
  check('طلایی همه گام‌ها را می‌دهد', gold.allowedStepTypes.length, 0);
  check('قیمت هیچ سطحی اختراع نشده', [bronze.priceIrt, gold.priceIrt], [null, null]);

  registry.assertWithinTier(bronze, { durationSec: 20 });
  console.log('✅ مدت مجاز در برنزی رد نمی‌شود');
  await expectThrow('مدت ۶۰۰ ثانیه در برنزی', () =>
    registry.assertWithinTier(bronze, { durationSec: 600 }),
  );
  await expectThrow('لیپ سینک در برنزی', () =>
    registry.assertWithinTier(bronze, { stepTypes: ['lipsync'] }),
  );
  registry.assertWithinTier(gold, { durationSec: 3600, stepTypes: ['lipsync'] });
  console.log('✅ لیپ سینک و مدت یک ساعته در طلایی مجاز است');

  console.log('\n■ ۴) قوانین رایگان — مجوز مقصد انتشار را فیلتر می‌کند');
  const nonCommercial = await prisma.mediaLicense.findUniqueOrThrow({
    where: { code: 'non_commercial' },
  });
  const cc0 = await prisma.mediaLicense.findUniqueOrThrow({ where: { code: 'cc0' } });
  check('غیرتجاری فقط دانلود', nonCommercial.allowedTargets, ['DOWNLOAD']);
  check('بدون قید یعنی همه مقصدها', cc0.allowedTargets, []);
  check('غیرتجاری برای دانلود مجاز', registry.licensePermitsTarget(nonCommercial, 'DOWNLOAD'), true);
  check('غیرتجاری برای فلک ممنوع', registry.licensePermitsTarget(nonCommercial, 'FALAK_VIDEO'), false);
  check('بدون قید برای فلک مجاز', registry.licensePermitsTarget(cc0, 'FALAK_VIDEO'), true);

  // دو ترک با دو مجوز متفاوت، و همان کوئری‌ای که فرم استودیو می‌زند.
  const free = await prisma.mediaCatalogItem.create({
    data: {
      kind: 'music',
      title: 'ترک آزمون بدون قید',
      genres: ['drama'],
      licenseId: cc0.id,
      priceCoins: 0,
      sourceName: 'آزمون',
    },
  });
  const limited = await prisma.mediaCatalogItem.create({
    data: {
      kind: 'music',
      title: 'ترک آزمون غیرتجاری',
      genres: ['drama'],
      licenseId: nonCommercial.id,
      priceCoins: 0,
      sourceName: 'آزمون',
    },
  });

  const forDownload = await registry.listCatalog({ kind: 'music', target: 'DOWNLOAD' });
  const forFalak = await registry.listCatalog({ kind: 'music', target: 'FALAK_VIDEO' });
  check('برای دانلود هر دو ترک دیده می‌شوند', forDownload.length, 2);
  check(
    'برای فلک فقط ترک بدون قید دیده می‌شود',
    forFalak.map((i) => i.title),
    ['ترک آزمون بدون قید'],
  );
  check(
    'متن شرط برای نمایش به کاربر آماده است',
    nonCommercial.userFacingSummary.length > 20,
    true,
  );

  console.log('\n■ ۵) افزودن نوع تولید تازه بدون مهاجرت');
  const before = await prisma.productionType.count();
  const fresh = await prisma.productionType.create({
    data: {
      key: 'test_podcast_visual',
      title: 'پادکست تصویری آزمون',
      minDurationSec: 60,
      maxDurationSec: 3600,
      promptGuide: 'راهنمای آزمون',
      fieldSchema: [
        { key: 'host', label: 'مجری', kind: 'text', required: true },
      ],
      isActive: false,
    },
  });
  const after = await prisma.productionType.count();
  check('یک ردیف اضافه شد، بدون هیچ تغییر شما', after - before, 1);
  check(
    'شمای فرمش بلافاصله کار می‌کند',
    registry.validateAttributes(fresh.fieldSchema, { host: 'رضا' }),
    { host: 'رضا' },
  );
  check(
    'غیرفعال است پس در فهرست کاربر نمی‌آید',
    (await registry.listProductionTypes()).some((t) => t.key === 'test_podcast_visual'),
    false,
  );

  console.log('\n■ ۶) کدهای دلیل — یک تاکسونومی، یک قرارداد نام‌گذاری');
  const codes = await prisma.reasonCode.groupBy({ by: ['category'], _count: { _all: true } });
  check(
    'شش دسته دلیل',
    codes.map((c) => c.category).sort(),
    ['compliance', 'legal', 'other', 'quality', 'rule_exception', 'technical'],
  );
  // قرارداد نام‌گذاری واحد: هیچ کدی نباید حروف بزرگ داشته باشد. کدهای
  // دوره اول با نگاشت به معادلشان منتقل و حذف شدند.
  const all2 = await prisma.reasonCode.findMany({ select: { code: true, category: true } });
  check(
    'هیچ کد یا دسته‌ای با قرارداد قدیمی نمانده',
    all2.filter((r) => /[A-Z]/.test(r.code) || /[A-Z]/.test(r.category)).map((r) => r.code),
    [],
  );

  await prisma.mediaCatalogItem.deleteMany({ where: { id: { in: [free.id, limited.id] } } });
  await prisma.productionType.delete({ where: { id: fresh.id } });

  await app.close();
  console.log(`\n${failures === 0 ? '✅ همه بندها گذشت' : `❌ ${failures} بند شکست خورد`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
