/**
 * آزمون یکپارچه لایه انتشار — فاز ۹.
 *
 * پنج ادعا:
 *   ۱. مجوز رسانه مقصد انتشار را می‌بندد («قوانین رایگان» اجرایی).
 *   ۲. سطحی که بازبینی انسانی می‌خواهد، اثر را در انتظار نگه می‌دارد.
 *   ۳. برداشتن از همه مقصدها با یک فرمان کار می‌کند.
 *   ۴. شماره موبایل هرگز از مسیرهای عمومی بیرون نمی‌آید.
 *   ۵. دیدگاه فقط روی اثر عمومی ثبت می‌شود.
 *
 * اجرا:  node dist-check/test/publications.check.js
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PublicationsService } from '../src/modules/publications/publications.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? '✅' : '❌'} ${label}  →  ${JSON.stringify(actual)}${ok ? '' : ` (انتظار: ${JSON.stringify(expected)})`}`,
  );
}

async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    failures++;
    console.log(`❌ ${label}  →  هیچ خطایی نداد`);
  } catch (err) {
    console.log(`✅ ${label}  →  ${String((err as Error).message).slice(0, 110)}`);
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const pubs = app.get(PublicationsService);
  const prisma = app.get(PrismaService);

  const rnd = Math.floor(100000 + Math.random() * 899999);
  const user = await prisma.user.create({
    data: { phone: `+98913${rnd}`, displayName: 'کارگردان آزمون' },
  });
  const viewer = await prisma.user.create({ data: { phone: `+98914${rnd}` } });
  const adType = await prisma.productionType.findUniqueOrThrow({ where: { key: 'ad' } });
  const bronze = await prisma.serviceTier.findUniqueOrThrow({ where: { key: 'bronze' } });
  const gold = await prisma.serviceTier.findUniqueOrThrow({ where: { key: 'gold' } });

  const mkProject = (tierId: string, title: string) =>
    prisma.project.create({
      data: {
        userId: user.id,
        title,
        productionTypeId: adType.id,
        serviceTierId: tierId,
        targetDurationSec: 30,
        sequences: {
          create: {
            order: 1,
            title: 'سکانس یک',
            shots: {
              create: {
                order: 1,
                durationSec: 5,
                description: 'نمای آزمون',
                cameraMovement: 'STATIC',
                aspectRatio: 'R9_16',
              },
            },
          },
        },
      },
    });

  console.log('\n■ ۱) دروازه مجوز — قوانین رایگان');
  const p1 = await mkProject(bronze.id, 'اثر با موسیقی غیرتجاری');
  const nonCommercial = await prisma.mediaLicense.findUniqueOrThrow({
    where: { code: 'non_commercial' },
  });
  await prisma.asset.create({
    data: {
      userId: user.id,
      projectId: p1.id,
      kind: 'AUDIO',
      role: 'music',
      storageKey: 'test/nc.mp3',
      mimeType: 'audio/mpeg',
      byteSize: 100,
      sha256: `nc${rnd}`,
      licenseId: nonCommercial.id,
    },
  });

  const dlBlockers = await pubs.licenseBlockers(p1.id, 'DOWNLOAD');
  const siteBlockers = await pubs.licenseBlockers(p1.id, 'PUBLIC_SITE');
  check('برای دانلود مانعی نیست', dlBlockers.length, 0);
  check('برای سایت عمومی یک مانع هست', siteBlockers.length, 1);
  check('مانع می‌گوید کدام دارایی و چرا', siteBlockers[0]?.role, 'music');

  const dl = await pubs.publish(user.id, p1.id, 'DOWNLOAD');
  check('دانلود منتشر می‌شود', dl.status, 'PUBLISHED');
  await expectThrow('سایت عمومی با همان موسیقی رد می‌شود', () =>
    pubs.publish(user.id, p1.id, 'PUBLIC_SITE'),
  );

  console.log('\n■ ۲) دروازه بازبینی — سطحی که ناظر می‌خواهد');
  const p2 = await mkProject(gold.id, 'اثر طلایی');
  const goldPub = await pubs.publish(user.id, p2.id, 'PUBLIC_SITE');
  check('سطح طلایی در انتظار بازبینی می‌ماند', goldPub.status, 'PENDING_REVIEW');
  await expectThrow('اثر منتشرنشده صفحه عمومی ندارد', () => pubs.publicWork(p2.id));

  // راهبر تایید می‌کند
  await prisma.complianceCheck.update({
    where: { projectId_stage: { projectId: p2.id, stage: 'PRE_PUBLICATION' } },
    data: { status: 'APPROVED', reviewedBy: 'admin', reviewedAt: new Date() },
  });
  const after = await pubs.publish(user.id, p2.id, 'PUBLIC_SITE');
  check('پس از تایید منتشر می‌شود', after.status, 'PUBLISHED');

  const p3 = await mkProject(bronze.id, 'اثر برنزی');
  const bronzePub = await pubs.publish(user.id, p3.id, 'PUBLIC_SITE');
  check('سطح بدون بازبینی انسانی مستقیم منتشر می‌شود', bronzePub.status, 'PUBLISHED');

  console.log('\n■ ۳) رد شدن در بازبینی، انتشار را می‌بندد');
  await prisma.complianceCheck.upsert({
    where: { projectId_stage: { projectId: p3.id, stage: 'PRE_PUBLICATION' } },
    update: { status: 'REJECTED' },
    create: { projectId: p3.id, stage: 'PRE_PUBLICATION', status: 'REJECTED' },
  });
  await expectThrow('اثر ردشده دوباره منتشر نمی‌شود', () =>
    pubs.publish(user.id, p3.id, 'PUBLIC_SITE'),
  );

  console.log('\n■ ۴) هیچ شماره موبایلی در مسیر عمومی نیست');
  const feed = await pubs.discover({});
  const work = await pubs.publicWork(p2.id);
  const profile = await pubs.creatorProfile(user.id);
  const dump = JSON.stringify({ feed, work, profile });
  check('شماره کاربر در خروجی عمومی نیست', dump.includes(user.phone), false);
  check('نام نمایشی به‌جایش می‌آید', work.user.name, 'کارگردان آزمون');

  const anon = await prisma.project.create({
    data: { userId: viewer.id, title: 'اثر بی‌نام', productionTypeId: adType.id },
  });
  await pubs.publish(viewer.id, anon.id, 'PUBLIC_SITE');
  const anonWork = await pubs.publicWork(anon.id);
  check('کاربر بدون نام نمایشی «سازنده ناشناس» می‌شود', anonWork.user.name, 'سازنده ناشناس');
  check('شماره او هم بیرون نمی‌آید', JSON.stringify(anonWork).includes(viewer.phone), false);

  console.log('\n■ ۵) دیدگاه');
  await expectThrow('دیدگاه روی اثر غیرعمومی', () => pubs.addComment(viewer.id, p1.id, 'سلام'));
  await expectThrow('دیدگاه خیلی کوتاه', () => pubs.addComment(viewer.id, p2.id, 'ا'));
  const c = await pubs.addComment(viewer.id, p2.id, 'کار قشنگی است، ریتمش خوب بود.');
  check('دیدگاه ثبت شد', c.status, 'APPROVED');
  const withComment = await pubs.publicWork(p2.id);
  check('در صفحه اثر دیده می‌شود', withComment.comments.length, 1);
  check('نویسنده دیدگاه هم بی‌نام است', withComment.comments[0]?.author, 'سازنده ناشناس');

  await pubs.moderateComment(c.id, 'admin', 'HIDDEN', 'discrimination');
  const hidden = await pubs.publicWork(p2.id);
  check('دیدگاه پنهان‌شده دیگر دیده نمی‌شود', hidden.comments.length, 0);

  console.log('\n■ ۶) برداشتن از همه مقصدها با یک فرمان');
  await pubs.publish(user.id, p2.id, 'DOWNLOAD');
  const before = await prisma.publication.count({
    where: { projectId: p2.id, status: { not: 'WITHDRAWN' } },
  });
  check('اثر در دو مقصد فعال است', before, 2);
  const res = await pubs.withdrawEverywhere(p2.id, 'admin', 'copyrighted_work');
  check('هر دو برداشته شدند', res.withdrawn, 2);
  const stillPublic = await prisma.publication.count({
    where: { projectId: p2.id, status: 'PUBLISHED' },
  });
  check('هیچ‌کدام منتشر نمانده', stillPublic, 0);
  await expectThrow('صفحه عمومی‌اش هم رفته', () => pubs.publicWork(p2.id));

  console.log('\n■ ۷) فلک هنوز وصل نیست و صادقانه می‌گوید');
  await expectThrow('انتشار در فلک', () => pubs.publish(user.id, p3.id, 'FALAK_VIDEO'));

  // پاکسازی
  const ids = [p1.id, p2.id, p3.id, anon.id];
  await prisma.comment.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.publication.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.complianceCheck.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.asset.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.shot.deleteMany({ where: { sequence: { projectId: { in: ids } } } });
  await prisma.sequence.deleteMany({ where: { projectId: { in: ids } } });
  await prisma.project.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: [user.id, viewer.id] } } });

  await app.close();
  console.log(`\n${failures === 0 ? '✅ همه بندها گذشت' : `❌ ${failures} بند شکست خورد`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
