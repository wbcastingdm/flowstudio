import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Ledger, LedgerError } from '@flowstudio/ledger';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { WalletHold } from '@prisma/client';

/**
 * کیفِ پولِ سکه‌ای — اسپرینتِ ۳ (D-005).
 *
 * 🔀 منطقِ دفتر از این‌جا به `@flowstudio/ledger` رفت، چون پروسهٔ **کارگر**
 * هم باید پیش از گامِ پولی رزرو کند و در شکست آزاد کند — و دو پیاده‌سازیِ
 * پول یعنی دو پیاده‌سازی که فردا واگرا می‌شوند. این کلاس حالا فقط دو کار
 * می‌کند: تزریقِ `PrismaService` به دفتر، و ترجمهٔ `LedgerError` به استثنایِ
 * نست. هیچ قاعدهٔ پولی این‌جا نمانده.
 */
@Injectable()
export class WalletService {
  private readonly ledger: Ledger;

  constructor(private readonly prisma: PrismaService) {
    this.ledger = new Ledger(prisma);
  }

  /**
   * تنها مترجمِ خطا. کدِ دفتر ⇒ استثنایِ نست، با همان متنِ فارسی.
   *
   * ⚠️ فراخوانی‌ها عمداً از این تابع رد می‌شوند و نه از `try/catch`ِ پراکنده:
   * یک نقطهٔ ترجمه یعنی هیچ مسیری نمی‌تواند یادش برود و ۵۰۰ بدهد جایِ ۴۰۲.
   */
  private async map<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (!(err instanceof LedgerError)) throw err;
      if (err.code === 'NOT_FOUND') throw new NotFoundException(err.message);
      if (err.code === 'PAYMENT_REQUIRED') {
        throw new HttpException(err.message, HttpStatus.PAYMENT_REQUIRED);
      }
      throw new BadRequestException(err.message);
    }
  }

  ensureWallet(userId: string) {
    return this.map(() => this.ledger.ensureWallet(userId));
  }

  summary(userId: string) {
    return this.map(() => this.ledger.summary(userId));
  }

  credit(userId: string, amount: number, note?: string) {
    return this.map(() => this.ledger.credit(userId, amount, note));
  }

  hold(
    userId: string,
    amount: number,
    opts: { jobGroupId?: string; purpose: string },
  ): Promise<WalletHold> {
    return this.map(() => this.ledger.hold(userId, amount, opts));
  }

  settle(
    holdId: string,
    actualAmount: number,
    opts: { generationId?: string; note?: string } = {},
  ) {
    return this.map(() => this.ledger.settle(holdId, actualAmount, opts));
  }

  release(holdId: string, reason?: string) {
    return this.map(() => this.ledger.release(holdId, reason));
  }

  runWithHold<T>(
    opts: { userId: string; jobGroupId?: string; estimatedCost: number; purpose: string },
    run: () => Promise<{ result: T; actualCost: number }>,
  ): Promise<T> {
    return this.map(() => this.ledger.runWithHold(opts, run));
  }
}
