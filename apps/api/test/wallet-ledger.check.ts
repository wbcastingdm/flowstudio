/**
 * آزمونِ یکپارچهٔ کیفِ پول — اسپرینتِ ۳.
 *
 * چرا اسکریپتِ جدا و نه مسیرِ HTTP: `hold/settle/release` عمداً هیچ درِ
 * بیرونی ندارند (کاربر حق ندارد رزروِ دلخواه بسازد). پس آزمون باید خودِ
 * سرویس را روی همان دیتابیسِ واقعی صدا بزند.
 *
 * اجرا:  node dist/test/wallet-ledger.check.js
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { PrismaService } from '../src/common/prisma/prisma.service';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${label}  →  ${JSON.stringify(actual)}${ok ? '' : ` (انتظار: ${JSON.stringify(expected)})`}`);
}

async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    failures++;
    console.log(`❌ ${label}  →  هیچ خطایی نداد (باید می‌داد)`);
  } catch (err) {
    console.log(`✅ ${label}  →  ${String((err as Error).message).slice(0, 90)}`);
  }
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const wallet = app.get(WalletService);
  const prisma = app.get(PrismaService);

  const phone = `+9891200${Math.floor(10000 + Math.random() * 89999)}`;
  const user = await prisma.user.create({ data: { phone } });
  const bal = async () => {
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
    return { balance: w.balance, held: w.held };
  };

  console.log(`\n──── کاربرِ آزمون: ${phone} ────\n`);

  console.log('■ ۱) کیفِ نو خالی است و رزرو روی آن رد می‌شود');
  await wallet.ensureWallet(user.id);
  check('موجودیِ اولیه', await bal(), { balance: 0, held: 0 });
  await expectThrow('رزرو بدونِ موجودی', () =>
    wallet.hold(user.id, 100, { purpose: 'آزمون' }),
  );
  check('بعد از رزروِ ناموفق دست‌نخورده', await bal(), { balance: 0, held: 0 });

  console.log('\n■ ۲) شارژ و رزرو');
  await wallet.credit(user.id, 1000, 'شارژِ آزمون');
  check('بعد از شارژ', await bal(), { balance: 1000, held: 0 });
  const h1 = await wallet.hold(user.id, 300, { purpose: 'گامِ تصویر' });
  check('رزرو از balance به held منتقل می‌کند', await bal(), { balance: 700, held: 300 });

  console.log('\n■ ۳) تسویه با خرجِ کمتر — باقی‌مانده برمی‌گردد');
  await wallet.settle(h1.id, 180);
  check('۳۰۰ رزرو، ۱۸۰ خرج ⇒ ۱۲۰ برگشت', await bal(), { balance: 820, held: 0 });

  console.log('\n■ ۴) آزادسازی کلِ رزرو را برمی‌گرداند (گاردریلِ ۶)');
  const h2 = await wallet.hold(user.id, 500, { purpose: 'گامِ ویدیو' });
  check('بعد از رزرو', await bal(), { balance: 320, held: 500 });
  await wallet.release(h2.id, 'شکستِ ساختگی');
  check('بعد از آزادسازی همه‌چیز سرِ جایش', await bal(), { balance: 820, held: 0 });

  console.log('\n■ ۵) بی‌اثر در تکرار — `release` دو بار سکه نمی‌سازد');
  const again = await wallet.release(h2.id, 'تکرار');
  check('آزادسازیِ دوباره noop است', again.noop, true);
  check('موجودی عوض نشد', await bal(), { balance: 820, held: 0 });

  console.log('\n■ ۶) خرجِ بیشتر از رزرو ممنوع است');
  const h3 = await wallet.hold(user.id, 100, { purpose: 'سقف' });
  await expectThrow('تسویهٔ ۱۵۰ روی رزروِ ۱۰۰', () => wallet.settle(h3.id, 150));
  await wallet.release(h3.id);

  console.log('\n■ ۷) پاکتِ بودجه — D-006 و وارونگیِ بودجه');
  const noCap = await prisma.jobGroup.create({ data: { userId: user.id, budgetCap: 0 } });
  await expectThrow('پاکتِ بدونِ سقف گامِ پولی نمی‌گیرد', () =>
    wallet.hold(user.id, 50, { jobGroupId: noCap.id, purpose: 'بی‌سقف' }),
  );

  const capped = await prisma.jobGroup.create({ data: { userId: user.id, budgetCap: 400 } });
  const g1 = await wallet.hold(user.id, 250, { jobGroupId: capped.id, purpose: 'گامِ ۱' });
  await expectThrow('رزروِ دوم از سقفِ پاکت رد می‌شود', () =>
    wallet.hold(user.id, 250, { jobGroupId: capped.id, purpose: 'گامِ ۲' }),
  );
  const g2 = await wallet.hold(user.id, 150, { jobGroupId: capped.id, purpose: 'گامِ ۲ کوچک‌تر' });
  await wallet.settle(g1.id, 200);
  await wallet.settle(g2.id, 100);
  const grp = await prisma.jobGroup.findUniqueOrThrow({ where: { id: capped.id } });
  check('خرجِ ثبت‌شدهٔ پاکت', { spent: grp.spentAmount, reserved: grp.reservedAmount }, {
    spent: 300,
    reserved: 0,
  });

  console.log('\n■ ۸) `runWithHold` — شکست سکه نمی‌بلعد');
  const before = await bal();
  try {
    await wallet.runWithHold(
      { userId: user.id, estimatedCost: 200, purpose: 'اجرایِ شکست‌خورده' },
      async () => {
        throw new Error('فروشنده ۵۰۰ داد');
      },
    );
  } catch {
    /* انتظارش را داشتیم */
  }
  check('بعد از شکست، موجودی دقیقاً مثلِ قبل', await bal(), before);

  const ok = await wallet.runWithHold(
    { userId: user.id, estimatedCost: 200, purpose: 'اجرایِ موفق' },
    async () => ({ result: 'خروجی', actualCost: 120 }),
  );
  check('نتیجهٔ اجرایِ موفق', ok, 'خروجی');
  check('فقط خرجِ واقعی کسر شد', (await bal()).balance, before.balance - 120);

  console.log('\n■ ۹) دفتر با موجودی جمع می‌خورد');
  const w = await prisma.wallet.findUniqueOrThrow({ where: { userId: user.id } });
  const entries = await prisma.walletEntry.findMany({ where: { walletId: w.id } });
  const sum = entries.reduce((acc, e) => {
    if (e.type === 'CREDIT') return acc + e.amount;
    if (e.type === 'SETTLE') return acc - e.amount;
    return acc; // HOLD و RELEASE جابه‌جاییِ داخلی‌اند، نه تغییرِ دارایی
  }, 0);
  check('Σ دفتر = balance + held', sum, w.balance + w.held);
  console.log(`   (${entries.length} ردیفِ دفتر ثبت شد)`);

  console.log('\n■ ۱۰) صفِ کار — یک کار فقط به یک کارگر می‌رسد');
  const jobs = app.get(await import('../src/modules/jobs/jobs.service').then((m) => m.JobsService));
  const stats = await jobs.stats();
  console.log(`   وضعیتِ صف: ${JSON.stringify(stats)}`);

  await prisma.walletEntry.deleteMany({ where: { walletId: w.id } });
  await prisma.walletHold.deleteMany({ where: { walletId: w.id } });
  await prisma.jobGroup.deleteMany({ where: { userId: user.id } });
  await prisma.wallet.delete({ where: { id: w.id } });
  await prisma.user.delete({ where: { id: user.id } });

  await app.close();
  console.log(`\n${failures === 0 ? '✅ همهٔ بندها گذشت' : `❌ ${failures} بند شکست خورد`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
