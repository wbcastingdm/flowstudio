import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const QUALITY_TIERS = ['draft', 'standard', 'hero'] as const;

/**
 * پاکتِ بودجه = `JobGroup`.
 *
 * **وارونگیِ بودجه (سندِ ۸۱ بخشِ ۱۳):** مبلغ ورودیِ الگوریتم است، نه خروجیِ
 * آن. پاکت پیش از اولین فراخوانِ پولی بسته می‌شود و پلان به‌عقب از آن ساخته
 * می‌شود؛ اگر جا نشد، *پیش از* خرج اعلام می‌شود.
 *
 * برایِ همین `budgetCap` اجباری است و پیش‌فرض ندارد: D-006 (عددِ بودجهٔ ۹۰
 * روز) هنوز بازِ مالک است و اختراعِ عددِ پیش‌فرض یعنی دزدیدنِ آن تصمیم.
 */
@Injectable()
export class JobGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: { budgetCap: number; qualityTier?: string; escalationCap?: number },
  ) {
    const budgetCap = Number(input?.budgetCap);
    if (!Number.isInteger(budgetCap) || budgetCap <= 0) {
      throw new BadRequestException(
        'سقفِ بودجه (سکه) اجباری است و باید عددِ صحیحِ مثبت باشد — پاکت پیش از خرج بسته می‌شود.',
      );
    }

    const tier = (input.qualityTier ?? 'standard').trim().toLowerCase();
    if (!QUALITY_TIERS.includes(tier as never)) {
      throw new BadRequestException(`سطحِ کیفیت باید یکی از ${QUALITY_TIERS.join('، ')} باشد.`);
    }

    const escalationCap = input.escalationCap ?? 1;
    if (!Number.isInteger(escalationCap) || escalationCap < 1) {
      throw new BadRequestException('سقفِ پله‌های تشدید باید دستِ‌کم ۱ باشد.');
    }

    return this.prisma.jobGroup.create({
      data: { userId, budgetCap, qualityTier: tier, escalationCap },
    });
  }

  /** فقط پاکت‌های خودِ کاربر — مثلِ کتابخانه. */
  async list(userId: string) {
    return this.prisma.jobGroup.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { jobs: true, planSteps: true } } },
    });
  }
}
