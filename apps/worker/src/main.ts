import { PrismaClient } from '@prisma/client';
import { Ledger } from '@flowstudio/ledger';
import { runJobChain } from './chain';
import { config } from './config';
import { engines } from './engines';
import { finalizeGroupIfReady } from './finalize';

/**
 * پروسهٔ کارگر — قلبِ محصول.
 *
 * 🔑 **حلقه داخلِ خودِ این پروسه است، نه داخلِ API.** قاعدهٔ ۱۱ سندِ ۸۱: یک
 * APIی چندرپلیکا با حلقهٔ درونی یعنی هر رپلیکا یک بار همان کار را برمی‌دارد.
 * این‌جا یک پروسهٔ مستقل است که می‌شود تعدادش را کم و زیاد کرد بدونِ اینکه
 * صف دو بار مصرف شود — قفلِ دیتابیسی بینشان داوری می‌کند.
 *
 * برداشتنِ کار «مقایسه و جایگزینی» است: کاندیدا خوانده می‌شود و بعد با
 * `UPDATE … WHERE status='PENDING' AND lockedAt IS NULL` قفل می‌شود. اگر
 * کارگرِ دیگری زودتر رسیده باشد `count = 0` برمی‌گردد و سراغِ بعدی می‌رویم.
 */

const prisma = new PrismaClient();
const ledger = new Ledger(prisma);

let stopping = false;
let inFlight: Promise<unknown> | null = null;

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] [${config.workerId}] ${message}`);
}

/**
 * برداشتنِ یک کار.
 *
 * ⚠️ عمداً همان الگویِ `JobsService.claim`ِ API است و نه `$queryRaw` با
 * `FOR UPDATE SKIP LOCKED`: همان معنا را دارد، ولی SQLِ خام در این مخزن
 * استثناست تا گرپِ قاعدهٔ ۱۱ («هیچ کوئریِ خامی») معیارِ سالمی بماند.
 */
async function claim(maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = await prisma.job.findFirst({
      where: { status: 'PENDING', lockedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!candidate) return null;

    const won = await prisma.job.updateMany({
      where: { id: candidate.id, status: 'PENDING', lockedAt: null },
      data: { status: 'RUNNING', lockedAt: new Date(), lockedBy: config.workerId, lastError: null },
    });
    if (won.count !== 1) continue; // کارگرِ دیگری زودتر رسید

    return prisma.job.findUnique({
      where: { id: candidate.id },
      include: {
        group: { select: { id: true, userId: true, projectId: true, budgetCap: true } },
        shot: {
          select: {
            id: true,
            order: true,
            description: true,
            durationSec: true,
            aspectRatio: true,
            sequence: { select: { project: { select: { id: true, title: true, userId: true } } } },
          },
        },
      },
    });
  }
  return null;
}

async function handleOne(): Promise<boolean> {
  const job = await claim();
  if (!job) return false;

  const startedAt = Date.now();
  // توضیحِ نما داخلِ لاگ است چون `shot.order` در هر سکانس از یک شروع می‌شود
  // و به‌تنهایی دو نمای متفاوت را یک‌جور نشان می‌دهد.
  log(`کار ${job.id} — ${job.shot.durationSec}s · ${job.shot.description.slice(0, 48)}…`);

  try {
    const { steps } = await runJobChain(prisma, ledger, job);
    const closed = await prisma.job.updateMany({
      where: { id: job.id, lockedBy: config.workerId, status: 'RUNNING' },
      data: { status: 'DONE', lockedAt: null, lockedBy: null },
    });
    if (closed.count !== 1) {
      // قفل زیرِ پایمان رفته (بازگردانیِ کارِ یخ‌زده وسطِ اجرا؟). خروجی سرِ
      // جایش است و گامِ تمام‌شده دوباره اجرا نمی‌شود، پس فقط هشدار می‌دهیم.
      log(`⚠️ کار ${job.id} دیگر دستِ ما نبود؛ نتیجه ذخیره شد ولی وضعیت را کارگرِ دیگر می‌بندد.`);
    }
    log(`✅ کار ${job.id} در ${((Date.now() - startedAt) / 1000).toFixed(1)} ثانیه — ${steps} گام`);
  } catch (err) {
    const reason = String(err instanceof Error ? err.message : err).slice(0, 500);
    await prisma.job.updateMany({
      where: { id: job.id, lockedBy: config.workerId, status: 'RUNNING' },
      data: { status: 'FAILED', lockedAt: null, lockedBy: null, lastError: reason },
    });
    await prisma.shot
      .update({ where: { id: job.shotId }, data: { status: 'REJECTED' } })
      .catch(() => undefined);
    log(`❌ کار ${job.id} شکست خورد: ${reason}`);
  }

  // بستنِ گروه از هر کارگری برمی‌آید؛ قفلش داخلِ خودِ تابع است.
  try {
    const result = await finalizeGroupIfReady(prisma, job.groupId);
    if (result.finalized) log(`🎬 گروه ${job.groupId} بسته شد — فایلِ نهایی ${result.assetId}`);
  } catch (err) {
    log(`⚠️ مونتاژِ گروه ${job.groupId} نشد: ${String(err)}`);
  }

  return true;
}

/**
 * بازگرداندنِ کارِ یخ‌زده.
 *
 * بدونِ این، یک کارگرِ کرش‌کرده کارش را برایِ همیشه در `RUNNING` جا می‌گذارد
 * و هیچ‌کس دیگر برش نمی‌دارد — صف بی‌سروصدا نشت می‌کند.
 */
async function reclaimStale(): Promise<void> {
  const cutoff = new Date(Date.now() - config.reclaimAfterMinutes * 60_000);
  const back = await prisma.job.updateMany({
    where: { status: 'RUNNING', lockedAt: { lt: cutoff } },
    data: { status: 'PENDING', lockedAt: null, lockedBy: null },
  });
  if (back.count > 0) log(`♻️ ${back.count} کارِ یخ‌زده به صف برگشت`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const engine = await engines();
  log('کارگر بالا آمد');
  log(`  انبار: ${config.storageDir}`);
  log(`  نخِ ffmpeg: ${config.ffmpegThreads}`);
  log(`  موتورها: ${engine.chromium} · ${engine.ffmpeg}`);

  let lastReclaim = 0;

  while (!stopping) {
    if (Date.now() - lastReclaim > config.reclaimEveryMs) {
      lastReclaim = Date.now();
      await reclaimStale().catch((err) => log(`⚠️ بازگردانی نشد: ${String(err)}`));
    }

    try {
      // ارجاع نگه داشته می‌شود تا خاموشیِ نرم بتواند منتظرش بماند و کارِ
      // نیمه‌تمام وسطِ رندر قطع نشود.
      inFlight = handleOne();
      const worked = await inFlight;
      inFlight = null;
      if (!worked) await sleep(config.idlePollMs);
    } catch (err) {
      inFlight = null;
      // حلقه هرگز نباید بمیرد: قطعیِ گذرایِ دیتابیس نباید کلِ تولید را بخواباند.
      log(`⚠️ خطایِ حلقه: ${String(err)}`);
      await sleep(config.idlePollMs);
    }
  }

  await prisma.$disconnect();
  log('کارگر خاموش شد');
}

/**
 * خاموشیِ نرم.
 *
 * ری‌استارتِ کانتینر نباید کارِ در حالِ اجرا را بکشد — کارِ نیمه‌رندرشده
 * `RUNNING` می‌ماند و تا بیست دقیقه بعد کسی برش نمی‌دارد. با انتظار برایِ
 * کارِ جاری، ری‌استارت فقط چند ثانیه طول می‌کشد و صف تمیز می‌ماند.
 */
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (stopping) process.exit(0);
    stopping = true;
    log(`${signal} گرفته شد — منتظرِ تمام‌شدنِ کارِ جاری…`);
    void Promise.resolve(inFlight)
      .catch(() => undefined)
      .then(() => prisma.$disconnect())
      .then(() => process.exit(0));
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
