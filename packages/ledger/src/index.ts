import type { Prisma, PrismaClient, WalletHold } from '@prisma/client';

/**
 * دفترِ سکه — همان منطقی که تا امروز داخلِ `WalletService`ی نست بود، حالا
 * بدونِ هیچ وابستگی به فریم‌ورک.
 *
 * چرا از نست بیرون آمد: پروسهٔ **کارگر** هم باید پیش از هر گامِ پولی رزرو
 * کند و در شکست آزاد کند. سه راه بود و دوتایش غلط:
 *   ✗ کارگر منطقِ رزرو را دوباره بنویسد ⇒ دو پیاده‌سازیِ پول که واگرا می‌شوند.
 *   ✗ کارگر از راهِ HTTP رزرو بگیرد ⇒ `hold/settle/release` عمداً هیچ درِ
 *     بیرونی ندارند؛ باز کردنشان یعنی هر کسی رزروِ دلخواه بسازد.
 *   ✓ یک پیاده‌سازیِ واحد که هم نست و هم کارگر همان را صدا می‌زنند.
 *
 * سه قاعده‌ای که کلِ این فایل را شکل داده‌اند:
 *
 * ۱. **گاردریلِ ۶ منشور:** `hold` قبل از خرج، `release` در `catch`. هیچ
 *    فراخوانِ پولی‌ای بدونِ رزروِ قبلی شروع نمی‌شود، و هیچ شکستی سکه را
 *    نمی‌بلعد.
 * ۲. **وارونگیِ بودجه (سندِ ۸۱ بخشِ ۱۳):** پاکت پیش از اولین خرج بسته
 *    می‌شود. اگر پلان در پاکت جا نشود، *پیش از* خرج‌کردن اعلام می‌شود.
 * ۳. **D-006 هنوز باز است:** عددِ سقفِ بودجه تصمیمِ مالک است. اینجا هیچ
 *    پیش‌فرضی اختراع نمی‌شود؛ گروهی که `budgetCap` صفر دارد گامِ پولی
 *    شروع نمی‌کند و صریح می‌گوید چرا. سکوت = تصمیمِ دزدیده‌شده.
 *
 * ⚠️ `balance` و `held` فقط خلاصهٔ سریع‌اند. حقیقت در `WalletEntry` است و
 * هر تغییرِ موجودی حتماً یک ردیفِ دفتر هم می‌سازد — در همان تراکنش.
 */

/**
 * کدِ خطا، نه کلاسِ خطایِ فریم‌ورک.
 *
 * لایهٔ نست این را به `BadRequestException`/`NotFoundException`/۴۰۲ ترجمه
 * می‌کند و کارگر فقط لاگش می‌کند. با این کار متنِ فارسیِ خطا یک بار نوشته
 * می‌شود و در هر دو مصرف‌کننده یکی است.
 */
export type LedgerErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'PAYMENT_REQUIRED';

export class LedgerError extends Error {
  constructor(
    public readonly code: LedgerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LedgerError';
  }
}

export interface HoldOptions {
  jobGroupId?: string;
  purpose: string;
}

export interface RunWithHoldOptions {
  userId: string;
  jobGroupId?: string;
  /** سکه. صفر یعنی رایگان ⇒ هیچ رزروی ساخته نمی‌شود. */
  estimatedCost: number;
  purpose: string;
}

export class Ledger {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * هر تغییرِ موجودی زیرِ `Serializable` می‌رود.
   *
   * چرا سخت‌گیرانه‌ترین سطح: شرطِ پاکت («خرج‌شده + رزروشده + مبلغِ تازه ≤
   * سقف») یک *خواندن* و بعد یک *نوشتن* است. زیرِ `Read Committed` دو
   * تراکنشِ هم‌زمان هر دو می‌خوانند «جا هست» و هر دو می‌نویسند ⇒ پاکت از سقف
   * رد می‌شود. اینجا مسیرِ کم‌ترافیکی است، پس بهایِ Serializable ناچیز است.
   */
  private tx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { isolationLevel: 'Serializable' });
  }

  async ensureWallet(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  /** آنچه کاربر در صفحهٔ کیفِ پول می‌بیند. */
  async summary(userId: string) {
    const wallet = await this.ensureWallet(userId);
    const [entries, activeHolds] = await Promise.all([
      this.prisma.walletEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.walletHold.findMany({
        where: { walletId: wallet.id, status: 'HELD' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      balance: wallet.balance,
      held: wallet.held,
      total: wallet.balance + wallet.held,
      activeHolds,
      entries,
    };
  }

  /** شارژ — فعلاً فقط از پنلِ ادمین. درگاهِ پرداخت کارِ اسپرینتِ بعد است. */
  async credit(userId: string, amount: number, note?: string) {
    this.assertPositive(amount);
    return this.tx(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: { balance: { increment: amount } },
        create: { userId, balance: amount },
      });
      await this.writeEntry(tx, wallet, 'CREDIT', amount, { note });
      return { balance: wallet.balance, held: wallet.held };
    });
  }

  /**
   * رزرو. از این لحظه سکه از دسترسِ خرجِ دیگر خارج است ولی هنوز خرج نشده.
   *
   * `PAYMENT_REQUIRED` می‌دهد اگر موجودی نرسد یا پاکتِ گروه جا نداشته باشد —
   * هر دو **پیش از** هر فراخوانِ پولی، که تمامِ نکتهٔ وارونگیِ بودجه است.
   */
  async hold(userId: string, amount: number, opts: HoldOptions): Promise<WalletHold> {
    this.assertPositive(amount);
    if (!opts.purpose?.trim()) {
      throw new LedgerError('BAD_REQUEST', 'هر رزرو باید دلیلِ خوانا داشته باشد.');
    }

    return this.tx(async (tx) => {
      if (opts.jobGroupId) {
        await this.reserveInBudget(tx, opts.jobGroupId, amount);
      }

      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });

      // شرطِ `balance >= amount` داخلِ خودِ UPDATE است، نه یک `if` در جاوااسکریپت:
      // یک دستورِ اتمیک که یا موجودی را کم می‌کند یا هیچ ردیفی را لمس نمی‌کند.
      const moved = await tx.wallet.updateMany({
        where: { id: wallet.id, balance: { gte: amount } },
        data: { balance: { decrement: amount }, held: { increment: amount } },
      });
      if (moved.count !== 1) {
        throw new LedgerError(
          'PAYMENT_REQUIRED',
          `موجودیِ سکه کافی نیست — ${amount} سکه لازم است و ${wallet.balance} موجود است.`,
        );
      }

      const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const hold = await tx.walletHold.create({
        data: {
          walletId: wallet.id,
          jobGroupId: opts.jobGroupId ?? null,
          amount,
          purpose: opts.purpose.trim(),
        },
      });
      await this.writeEntry(tx, fresh, 'HOLD', amount, { holdId: hold.id });
      return hold;
    });
  }

  /**
   * تسویه — خرجِ واقعی از رزرو کسر می‌شود و باقی‌مانده برمی‌گردد.
   *
   * `actualAmount > hold.amount` عمداً خطاست، نه کسرِ اضافه: سقفِ پاکت پیش از
   * شروع بسته شده و بالارفتنِ بی‌اجازه از آن دقیقاً همان چیزی است که گاردریلِ
   * ۷ («گیتِ انسانی پیش از خرجِ پول») جلویش را می‌گیرد.
   */
  async settle(
    holdId: string,
    actualAmount: number,
    opts: { generationId?: string; note?: string } = {},
  ) {
    if (!Number.isInteger(actualAmount) || actualAmount < 0) {
      throw new LedgerError('BAD_REQUEST', 'خرجِ واقعی باید عددِ صحیحِ نامنفی باشد.');
    }

    return this.tx(async (tx) => {
      const hold = await tx.walletHold.findUnique({ where: { id: holdId } });
      if (!hold) throw new LedgerError('NOT_FOUND', 'رزرو پیدا نشد.');
      // بی‌اثر در تکرار: تسویهٔ دوباره همان نتیجهٔ قبلی را برمی‌گرداند.
      if (hold.status === 'SETTLED') return { hold, noop: true };
      if (hold.status === 'RELEASED') {
        throw new LedgerError('BAD_REQUEST', 'این رزرو آزاد شده — دیگر تسویه‌پذیر نیست.');
      }
      if (actualAmount > hold.amount) {
        throw new LedgerError(
          'BAD_REQUEST',
          `خرجِ واقعی (${actualAmount}) از رزرو (${hold.amount}) بیشتر شد — پاکت پیش از شروع بسته شده بود.`,
        );
      }

      const refund = hold.amount - actualAmount;
      await tx.wallet.update({
        where: { id: hold.walletId },
        data: { held: { decrement: hold.amount }, balance: { increment: refund } },
      });
      const updated = await tx.walletHold.update({
        where: { id: hold.id },
        data: { status: 'SETTLED', settledAmount: actualAmount, resolvedAt: new Date() },
      });

      if (hold.jobGroupId) {
        await tx.jobGroup.update({
          where: { id: hold.jobGroupId },
          data: {
            reservedAmount: { decrement: hold.amount },
            spentAmount: { increment: actualAmount },
          },
        });
      }

      const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: hold.walletId } });
      await this.writeEntry(tx, fresh, 'SETTLE', actualAmount, {
        holdId: hold.id,
        generationId: opts.generationId,
        note: opts.note,
      });
      return { hold: updated, noop: false };
    });
  }

  /**
   * آزادسازی — کلِ رزرو به موجودی برمی‌گردد.
   *
   * ⚠️ **عمداً هرگز استثنا پرتاب نمی‌کند برایِ رزروِ ازپیش‌بسته‌شده.** جایِ
   * فراخوانش داخلِ `catch` است؛ اگر خودش خطا بدهد، خطایِ اصلی — که علتِ
   * واقعیِ شکست است — گم می‌شود.
   */
  async release(holdId: string, reason?: string) {
    return this.tx(async (tx) => {
      const hold = await tx.walletHold.findUnique({ where: { id: holdId } });
      if (!hold) return { hold: null, noop: true };
      if (hold.status !== 'HELD') return { hold, noop: true };

      await tx.wallet.update({
        where: { id: hold.walletId },
        data: { held: { decrement: hold.amount }, balance: { increment: hold.amount } },
      });
      const updated = await tx.walletHold.update({
        where: { id: hold.id },
        data: { status: 'RELEASED', settledAmount: 0, resolvedAt: new Date() },
      });

      if (hold.jobGroupId) {
        // پاکت دوباره جا باز می‌کند — تلاشِ بعدی حق دارد از همان بودجه بردارد.
        await tx.jobGroup.update({
          where: { id: hold.jobGroupId },
          data: { reservedAmount: { decrement: hold.amount } },
        });
      }

      const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: hold.walletId } });
      await this.writeEntry(tx, fresh, 'RELEASE', hold.amount, {
        holdId: hold.id,
        note: reason,
      });
      return { hold: updated, noop: false };
    });
  }

  /**
   * الگویِ کاملِ گاردریلِ ۶ در یک تابع — تا هیچ فراخوانِ پولی‌ای مجبور نباشد
   * دوباره `try/catch/release` بنویسد و یکی‌شان یادش برود.
   *
   * `estimatedCost = 0` (مثلِ کلِ مسیرِ TEXT و کلِ مسیرِ ج) هیچ رزروی
   * نمی‌سازد ولی از همین مسیر رد می‌شود — یعنی روزی که همان گام پولی شد،
   * فقط عددش عوض می‌شود، نه ساختارِ کد.
   */
  async runWithHold<T>(
    opts: RunWithHoldOptions,
    run: () => Promise<{ result: T; actualCost: number }>,
  ): Promise<T> {
    if (opts.estimatedCost <= 0) {
      const { result } = await run();
      return result;
    }

    const hold = await this.hold(opts.userId, opts.estimatedCost, {
      jobGroupId: opts.jobGroupId,
      purpose: opts.purpose,
    });

    try {
      const { result, actualCost } = await run();
      await this.settle(hold.id, Math.min(actualCost, hold.amount));
      return result;
    } catch (err) {
      // 🔒 گاردریلِ ۶ — سکه هرگز به‌خاطرِ شکست بلعیده نمی‌شود.
      await this.release(hold.id, `شکستِ اجرا: ${String(err).slice(0, 180)}`);
      throw err;
    }
  }

  /** شرطِ پاکت + رزروِ جا در همان تراکنش. */
  private async reserveInBudget(
    tx: Prisma.TransactionClient,
    jobGroupId: string,
    amount: number,
  ) {
    const group = await tx.jobGroup.findUnique({ where: { id: jobGroupId } });
    if (!group) throw new LedgerError('NOT_FOUND', 'گروهِ کار پیدا نشد.');

    if (group.budgetCap <= 0) {
      // D-006 هنوز بسته نشده. عددِ پیش‌فرض اختراع نمی‌کنیم.
      throw new LedgerError(
        'BAD_REQUEST',
        'سقفِ بودجهٔ این گروه تعیین نشده — تا عددِ سقف ثبت نشود هیچ گامِ پولی شروع نمی‌شود (D-006).',
      );
    }

    const wouldBe = group.spentAmount + group.reservedAmount + amount;
    if (wouldBe > group.budgetCap) {
      throw new LedgerError(
        'PAYMENT_REQUIRED',
        `پاکتِ بودجه جا ندارد: سقف ${group.budgetCap}، خرج‌شده ${group.spentAmount}، ` +
          `رزروشده ${group.reservedAmount}، درخواست ${amount}.`,
      );
    }

    await tx.jobGroup.update({
      where: { id: jobGroupId },
      data: { reservedAmount: { increment: amount } },
    });
  }

  private assertPositive(amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new LedgerError('BAD_REQUEST', 'مبلغ باید عددِ صحیحِ مثبت باشد (واحد: سکه).');
    }
  }

  private async writeEntry(
    tx: Prisma.TransactionClient,
    wallet: { id: string; balance: number; held: number },
    type: 'CREDIT' | 'HOLD' | 'SETTLE' | 'RELEASE',
    amount: number,
    extra: { holdId?: string; generationId?: string; note?: string } = {},
  ) {
    // `wallet` ممکن است عکسِ قبل از آخرین UPDATE باشد؛ برایِ `balanceAfter`
    // همیشه مقدارِ تازه را می‌خوانیم، وگرنه دفتر عددِ کهنه ثبت می‌کند.
    const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    return tx.walletEntry.create({
      data: {
        walletId: fresh.id,
        type,
        amount,
        balanceAfter: fresh.balance,
        heldAfter: fresh.held,
        holdId: extra.holdId ?? null,
        generationId: extra.generationId ?? null,
        note: extra.note ?? null,
      },
    });
  }
}

/**
 * هزینهٔ سکه‌ایِ هر قابلیت — **یک جدول، دو مصرف‌کننده**.
 *
 * تا امروز این جدول فقط داخلِ کارگر بود. لحظه‌ای که رابط خواست پیش از
 * ساخت بگوید «این کار چقدر آب می‌خورد»، API هم به همین عددها نیاز پیدا
 * کرد — و نوشتنِ نسخهٔ دوم دقیقاً همان تلهٔ «پول در دو جا» بود که `hold`
 * را به این بسته آورد. پس جدول هم آمد.
 *
 * 🔴 هر قابلیتِ پولیِ تازه (`tts`, `text2image`, `text2video`, `stt`) باید
 * **این‌جا** عددش را بگیرد. همان لحظه، بدونِ یک خط تغییر در رابط، دکمهٔ
 * «بساز» خودش تبدیل به گیتِ تأییدِ انسانی می‌شود — گاردریلِ ۵.
 */
export const STEP_COST_COINS: Record<string, number> = {
  html2image: 0,
  programmatic_motion: 0,
};

export function stepCost(capability: string): number {
  return STEP_COST_COINS[capability] ?? 0;
}

/**
 * برآوردِ هزینهٔ یک پلان، پیش از آنکه چیزی ساخته شود.
 *
 * ⚠️ برآورد است نه قیمتِ قطعی: تلاشِ دوباره روی گامِ شکست‌خورده هزینه را
 * بالا می‌برد. برای همین این عدد فقط ملاکِ **نشان دادنِ گیت** است، نه
 * ملاکِ برداشت — برداشتِ واقعی از راهِ `hold` و `settle` می‌رود.
 */
export function estimatePlanCoins(capabilities: string[]): number {
  return capabilities.reduce((sum, c) => sum + stepCost(c), 0);
}
