import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { estimatePlanCoins } from '@flowstudio/ledger';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

/**
 * برنامه‌ریزِ تولید — L1ِ سندِ ۸۱.
 *
 * ورودی: یک پروژه با نماهایش. خروجی: یک **پاکتِ بودجه** (`JobGroup`)، یک
 * **گرافِ گام** (`PlanStep`) به‌ازای هر نما، و یک **کار** (`Job`) در صف برایِ
 * هر نما. از این لحظه به بعد API دیگر کاری ندارد؛ کارگر برمی‌دارد.
 *
 * زنجیرهٔ هر نما — مسیرِ ج، بدونِ هیچ فراخوانِ پولی:
 *
 *   ۱. `html2image` (زمینه)  ← موتورِ HTML، بدونِ متن
 *   ۲. `html2image` (متن)     ← موتورِ HTML، PNGِ شفاف
 *   ۳. `programmatic_motion`  ← ffmpeg: حرکت روی زمینه، متن ثابت رویش
 *
 * 🔴 چرا متن یک گامِ جداست و داخلِ زمینه نیست: قاعدهٔ ۹ منشور. ابزارِ ویدیو
 * فارسی را بی‌صدا خراب می‌کند و هیچ مدلِ تصویری هم نوشتهٔ فارسیِ درست تولید
 * نمی‌کند. با لایهٔ مستقل، روزی که زمینه از یک مدلِ واقعی بیاید، متن دست
 * نمی‌خورد.
 */
@Injectable()
export class RenderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * نگاشتِ حرکتِ دوربینِ نما به پریستِ حرکتِ برنامه‌ای.
   *
   * ⚠️ این نگاشت **نامِ مدل نیست** و گاردریلِ ۱ را نمی‌شکند: پریست یک قاعدهٔ
   * هندسیِ داخلِ خودمان است (`packages/motion`)، نه شناسهٔ محصولِ یک فروشنده.
   */
  private presetFor(movement: string): string {
    switch (movement) {
      case 'PAN':
        return 'pan_rl';
      case 'TILT':
        return 'kenburns_out';
      case 'DOLLY':
        return 'kenburns_in';
      case 'HANDHELD':
      case 'COMBINED':
        return 'push_diagonal';
      default:
        return 'still';
    }
  }

  /**
   * زنجیرهٔ گام‌های یک نما — **یک تعریف، دو مصرف‌کننده**.
   *
   * تا امروز این زنجیره فقط داخلِ حلقهٔ `enqueueProject` وجود داشت. حالا
   * رابط پیش از ساخت می‌پرسد «چقدر آب می‌خورد؟» و اگر برآورد از روی یک
   * تعریفِ دوم حساب شود، اولین گامِ پولی عددِ غلط نشان می‌دهد و گیتِ
   * تأیید سرِ جای اشتباه ظاهر می‌شود.
   */
  private chainFor(shot: { cameraMovement: string }) {
    return [
      { capability: 'html2image', params: { layer: 'background' }, dependsOn: [] as number[] },
      { capability: 'html2image', params: { layer: 'text' }, dependsOn: [] as number[] },
      {
        capability: 'programmatic_motion',
        params: { preset: this.presetFor(shot.cameraMovement) },
        // گرافِ جهت‌دار: حرکت تا وقتی هر دو لایه آماده نشوند شروع نمی‌شود.
        dependsOn: [0, 1],
      },
    ];
  }

  /**
   * برآوردِ پلان **پیش از** ساخته شدنش — گاردریلِ ۵.
   *
   * 🔑 رابط با همین عدد تصمیم می‌گیرد دکمهٔ «بساز» یک حرکت باشد یا دو:
   * صفر یعنی هیچ پولی خرج نمی‌شود و تأیید گرفتن از کاربر فقط یک کلیکِ
   * بی‌معناست؛ هر عددِ بزرگ‌تر از صفر یعنی گیتِ انسانی **اجباری** است.
   * چون عدد از جدولِ مشترکِ دفتر می‌آید، روزِ افزودنِ گامِ پولی این گیت
   * بدونِ یک خط تغییر در رابط خودش ظاهر می‌شود.
   */
  async estimate(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        sequences: {
          orderBy: { order: 'asc' },
          include: { shots: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!project) throw new NotFoundException('پروژه پیدا نشد.');

    const shots = project.sequences.flatMap((s) => s.shots);
    const capabilities = shots.flatMap((shot) => this.chainFor(shot).map((s) => s.capability));

    return {
      projectId,
      shots: shots.length,
      steps: capabilities.length,
      durationSec: shots.reduce((n, s) => n + s.durationSec, 0),
      estimatedCoins: estimatePlanCoins(capabilities),
    };
  }

  /**
   * صف‌کردنِ یک پروژه.
   *
   * بی‌اثر در تکرار: اگر گروهی از همین پروژه هنوز بسته نشده، همان برمی‌گردد.
   * بدونِ این، دو بار زدنِ دکمه یعنی دو بار تولید و دو بار خرج.
   */
  async enqueueProject(userId: string, projectId: string, opts: { budgetCap?: number } = {}) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        sequences: {
          orderBy: { order: 'asc' },
          include: { shots: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!project) throw new NotFoundException('پروژه پیدا نشد.');

    const shots = project.sequences.flatMap((s) => s.shots);
    if (shots.length === 0) {
      throw new BadRequestException('این پروژه هیچ نمایی ندارد — اول شات‌لیست بساز.');
    }

    const running = await this.prisma.jobGroup.findFirst({
      where: { projectId, finalizedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (running) return this.status(userId, running.id);

    /**
     * سقفِ پاکت پیش‌فرض **صفر** است و این عمدی است.
     *
     * زنجیرهٔ مسیرِ ج هیچ گامِ پولی ندارد، پس هرگز به سقف نگاه نمی‌شود. ولی
     * اگر فردا یک گامِ پولی به همین زنجیره اضافه شود، دفتر با پیامِ روشنِ
     * D-006 جلویش را می‌گیرد تا مالک عددِ سقف را تعیین کند — به‌جایِ اینکه
     * ما این‌جا عددی اختراع کنیم و تصمیمش را بدزدیم.
     */
    const budgetCap = Number.isInteger(opts.budgetCap) ? Number(opts.budgetCap) : 0;

    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.jobGroup.create({
        data: { userId, projectId, budgetCap, qualityTier: 'standard' },
      });

      for (const shot of shots) {
        // اندیسِ داخلِ زنجیره به شناسهٔ واقعیِ گامِ ساخته‌شده ترجمه می‌شود؛
        // `dependsOn` باید شناسه باشد وگرنه کارگر پیش‌نیاز را پیدا نمی‌کند.
        const createdIds: string[] = [];
        for (const [orderIndex, step] of this.chainFor(shot).entries()) {
          const row = await tx.planStep.create({
            data: {
              jobGroupId: created.id,
              shotId: shot.id,
              capability: step.capability,
              params: step.params as Prisma.InputJsonValue,
              dependsOn: step.dependsOn.map((i) => createdIds[i]) as Prisma.InputJsonValue,
              orderIndex,
            },
          });
          createdIds.push(row.id);
        }

        // `aiModelId` خالی می‌ماند — این زنجیره هیچ مدلی صدا نمی‌زند.
        await tx.job.create({
          data: { groupId: created.id, shotId: shot.id, status: 'PENDING' },
        });
      }

      await tx.shot.updateMany({
        where: { id: { in: shots.map((s) => s.id) } },
        data: { status: 'QUEUED' },
      });

      return created;
    });

    return this.status(userId, group.id);
  }

  /** آخرین گروهِ همین پروژه — چیزی که صفحهٔ زنده هر چند ثانیه می‌پرسد. */
  async latestForProject(userId: string, projectId: string) {
    const group = await this.prisma.jobGroup.findFirst({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!group) return null;
    return this.status(userId, group.id);
  }

  /**
   * وضعیتِ زندهٔ یک گروه.
   *
   * عمداً یک کوئریِ جمع‌وجور است، نه یک درختِ کامل: این مسیر هر چند ثانیه
   * صدا زده می‌شود و نباید هر بار کلِ پروژه را از دیتابیس بکشد.
   */
  async status(userId: string, groupId: string) {
    const group = await this.prisma.jobGroup.findFirst({
      where: { id: groupId, userId },
      include: {
        jobs: {
          orderBy: { createdAt: 'asc' },
          include: {
            shot: {
              select: { id: true, order: true, description: true, durationSec: true, status: true },
            },
            generations: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                modelKeySnap: true,
                resultUrl: true,
                costActual: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    if (!group) throw new NotFoundException('گروهِ کار پیدا نشد.');

    const counts = { PENDING: 0, RUNNING: 0, DONE: 0, FAILED: 0 };
    for (const job of group.jobs) counts[job.status]++;

    // شمارشِ گام‌ها از خودِ پلان می‌آید تا درصد با واقعیت بخواند، نه با یک
    // عددِ ثابتِ حدسی که با عوض‌شدنِ زنجیره کهنه می‌شود.
    const totalSteps = await this.prisma.planStep.count({ where: { jobGroupId: group.id } });
    const doneSteps = await this.prisma.generation.count({
      where: { planStep: { jobGroupId: group.id }, resultUrl: { not: null } },
    });

    const finalAsset = group.finalAssetId
      ? await this.prisma.asset.findUnique({
          where: { id: group.finalAssetId },
          select: { id: true, mimeType: true, byteSize: true, durationSec: true },
        })
      : null;

    return {
      groupId: group.id,
      projectId: group.projectId,
      createdAt: group.createdAt,
      finalizedAt: group.finalizedAt,
      finalAsset,
      counts,
      totalJobs: group.jobs.length,
      totalSteps,
      doneSteps,
      progress: totalSteps === 0 ? 0 : Math.round((doneSteps / totalSteps) * 100),
      spentAmount: group.spentAmount,
      budgetCap: group.budgetCap,
      jobs: group.jobs.map((job) => ({
        id: job.id,
        status: job.status,
        lastError: job.lastError,
        lockedBy: job.lockedBy,
        shot: job.shot,
        outputs: job.generations
          .filter((g) => g.resultUrl)
          .map((g) => ({ id: g.id, engine: g.modelKeySnap, costActual: g.costActual })),
      })),
    };
  }
}
