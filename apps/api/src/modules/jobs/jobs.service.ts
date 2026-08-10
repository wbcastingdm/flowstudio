import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * صفِ کار — جدولِ `Job` + قفلِ دیتابیسی (D-007، دستورِ مالک؛ **نه BullMQ**).
 *
 * چرا Redis صف نیست: یک وابستگیِ عملیاتیِ دیگر برایِ کاری که Postgres با یک
 * `UPDATE`ِ شرطی انجام می‌دهد، و ازدست‌رفتنِ صف یعنی ازدست‌رفتنِ کارِ پولی.
 * وقتی صف در همان دیتابیسِ تراکنشی باشد، «کار برداشته شد» و «سکه تسویه شد»
 * می‌توانند یک حقیقتِ واحد باشند.
 *
 * ⚠️ **هیچ `@Cron`ی داخلِ این پروسه نیست** (قاعدهٔ ۱۱ سندِ ۸۱): APIِ چندرپلیکا
 * با کرونِ درونی یعنی هر رپلیکا یک بار کار را برمی‌دارد. تیک از بیرون
 * می‌آید: `POST /api/admin/jobs/reclaim`.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: { groupId: string; shotId: string; aiModelId: string }) {
    const group = await this.prisma.jobGroup.findUnique({ where: { id: input.groupId } });
    if (!group) throw new NotFoundException('گروهِ کار پیدا نشد.');
    return this.prisma.job.create({ data: { ...input, status: 'PENDING' } });
  }

  /**
   * برداشتنِ یک کار — «مقایسه و جایگزینی» (CAS).
   *
   * کاندیدا را می‌خوانیم، بعد با `UPDATE … WHERE status='PENDING' AND
   * lockedAt IS NULL` قفلش می‌کنیم. اگر کارگرِ دیگری زودتر رسیده باشد
   * `count = 0` برمی‌گردد و سراغِ کاندیدایِ بعدی می‌رویم. این همان قفلِ
   * دیتابیسیِ D-007 است — شرط داخلِ خودِ `UPDATE` است، پس بینِ خواندن و
   * نوشتن هیچ پنجره‌ای برایِ مسابقه نمی‌ماند.
   *
   * چرا `$queryRaw` با `FOR UPDATE SKIP LOCKED` ننوشتیم: همان معنا را دارد،
   * ولی SQLِ خام در این مخزن باید استثنا بماند تا گرپِ قاعدهٔ ۱۱ («هیچ
   * کوئریِ خامی») معیارِ سالمی بماند.
   */
  async claim(workerId: string, maxAttempts = 5) {
    if (!workerId?.trim()) throw new BadRequestException('workerId لازم است.');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = await this.prisma.job.findFirst({
        where: { status: 'PENDING', lockedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!candidate) return null; // صف خالی است

      const won = await this.prisma.job.updateMany({
        where: { id: candidate.id, status: 'PENDING', lockedAt: null },
        data: { status: 'RUNNING', lockedAt: new Date(), lockedBy: workerId },
      });
      if (won.count === 1) {
        return this.prisma.job.findUnique({
          where: { id: candidate.id },
          include: { aiModel: { include: { provider: { select: { name: true, baseUrl: true } } } } },
        });
      }
    }

    // شلوغیِ واقعی، نه خطا: کارگرِ دیگری همه را برد. تیکِ بعدی دوباره می‌آید.
    this.logger.debug(`claim: ${maxAttempts} تلاش بی‌نتیجه برایِ ${workerId}`);
    return null;
  }

  /** کارِ تمام‌شده. فقط قفل‌دارِ خودش می‌تواند ببنددش. */
  async complete(jobId: string, workerId: string) {
    const done = await this.prisma.job.updateMany({
      where: { id: jobId, lockedBy: workerId, status: 'RUNNING' },
      data: { status: 'DONE', lockedAt: null, lockedBy: null },
    });
    if (done.count !== 1) {
      throw new BadRequestException('این کار دستِ تو نیست یا در حالِ اجرا نبود.');
    }
    return this.prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  }

  async fail(jobId: string, workerId: string, reason?: string) {
    const done = await this.prisma.job.updateMany({
      where: { id: jobId, lockedBy: workerId, status: 'RUNNING' },
      data: { status: 'FAILED', lockedAt: null, lockedBy: null },
    });
    if (done.count !== 1) {
      throw new BadRequestException('این کار دستِ تو نیست یا در حالِ اجرا نبود.');
    }
    this.logger.warn(`job ${jobId} شکست خورد: ${reason ?? 'بدونِ دلیل'}`);
    return this.prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  }

  /**
   * بازگرداندنِ کارهایِ یخ‌زده به صف.
   *
   * بدونِ این، یک کارگرِ کرش‌کرده کارش را برایِ همیشه در `RUNNING` جا
   * می‌گذارد و هیچ‌کس دیگر برش نمی‌دارد — صف بی‌سروصدا نشت می‌کند.
   */
  async reclaimStale(olderThanMinutes = 15) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const back = await this.prisma.job.updateMany({
      where: { status: 'RUNNING', lockedAt: { lt: cutoff } },
      data: { status: 'PENDING', lockedAt: null, lockedBy: null },
    });
    if (back.count > 0) this.logger.warn(`${back.count} کارِ یخ‌زده به صف برگشت`);
    return { reclaimed: back.count, olderThanMinutes };
  }

  async stats() {
    const rows = await this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } });
    const counts: Record<string, number> = { PENDING: 0, RUNNING: 0, DONE: 0, FAILED: 0 };
    for (const r of rows) counts[r.status] = r._count._all;
    return counts;
  }
}
