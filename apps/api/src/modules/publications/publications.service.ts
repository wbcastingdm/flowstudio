import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegistryService } from '../registry/registry.service';
import type { PublicationTarget } from '@prisma/client';

/** مقصدهایی که یعنی «دیگران هم می‌بینند». دانلود شخصی جزوشان نیست. */
const PUBLIC_TARGETS: PublicationTarget[] = ['PUBLIC_SITE', 'FALAK_VIDEO', 'FALAK_STORY'];

/** مقصدهایی که هنوز رابط فنی‌شان روشن نیست. */
const NOT_WIRED: PublicationTarget[] = ['FALAK_VIDEO', 'FALAK_STORY'];

/**
 * لایه ۵ معماری — انتشار.
 *
 * می‌داند هر مقصد چه می‌خواهد و چه مجوزی لازم دارد. **نمی‌داند اثر چطور
 * ساخته شده** — هیچ ارجاعی به مدل، صف یا کیف پول این‌جا نیست.
 *
 * دو دروازه پیش از هر انتشار عمومی:
 *   ۱. مجوز رسانه — هر دارایی به‌کاررفته باید اجازه این مقصد را بدهد.
 *   ۲. بازبینی — اگر سطح خدمت بازبینی انسانی می‌خواهد، انتشار در انتظار
 *      می‌ماند تا راهبر تایید کند.
 */
@Injectable()
export class PublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  /**
   * دروازه مجوز — پاسخ اجرایی به «قوانین رایگان».
   *
   * ترکی که برای دانلود شخصی آزاد است ممکن است برای انتشار روی فلک آزاد
   * نباشد. این متد پیش از انتشار همه دارایی‌های اثر را می‌سنجد و اگر یکی
   * اجازه ندهد، **نام همان دارایی و شرطش** را برمی‌گرداند — نه یک «خطای
   * نامشخص» که کاربر نداند چه کند.
   */
  async licenseBlockers(projectId: string, target: PublicationTarget) {
    const assets = await this.prisma.asset.findMany({
      where: { projectId, licenseId: { not: null } },
      select: { id: true, role: true, license: true },
    });

    return assets
      .filter((a) => a.license && !this.registry.licensePermitsTarget(a.license, target))
      .map((a) => ({
        assetId: a.id,
        role: a.role,
        license: a.license!.title,
        why: a.license!.userFacingSummary,
      }));
  }

  /**
   * فایل نهایی اثر — تازه‌ترین دارایی با نقش `final_output`.
   *
   * چرا تازه‌ترین: هر «تلاش دوباره» یک مونتاژ نو و یک ردیف دارایی نو
   * می‌سازد. آنچه منتشر می‌شود همان چیزی است که کاربر آخرین بار دید.
   */
  private finalAsset(projectId: string) {
    return this.prisma.asset.findFirst({
      where: { projectId, role: 'final_output' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** وضعیت انتشار اثر در همه مقصدها — آنچه کاربر در آرشیو رسانه می‌بیند. */
  async statusFor(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { publications: true, serviceTier: true },
    });
    if (!project) throw new NotFoundException('اثر پیدا نشد.');

    // رابط باید پیش از فشردن دکمه بداند فایلی هست یا نه — وگرنه تنها راه
    // فهمیدنش خوردن یک خطای ۴۰۰ است.
    const file = await this.finalAsset(projectId);

    const targets: PublicationTarget[] = [
      'DOWNLOAD',
      'PUBLIC_SITE',
      'FALAK_VIDEO',
      'FALAK_STORY',
    ];

    const rows = await Promise.all(
      targets.map(async (t) => {
        const pub = project.publications.find((p) => p.target === t);
        return {
          target: t,
          status: pub?.status ?? 'DRAFT',
          externalUrl: pub?.externalUrl ?? null,
          publishedAt: pub?.publishedAt ?? null,
          viewCount: pub?.viewCount ?? 0,
          available: !NOT_WIRED.includes(t),
          blockers: NOT_WIRED.includes(t) ? [] : await this.licenseBlockers(projectId, t),
        };
      }),
    );
    return {
      projectId,
      title: project.title,
      finalFile: file
        ? { assetId: file.id, byteSize: file.byteSize, durationSec: file.durationSec }
        : null,
      targets: rows,
    };
  }

  async publish(userId: string, projectId: string, target: PublicationTarget) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { serviceTier: true },
    });
    if (!project) throw new NotFoundException('اثر پیدا نشد.');

    if (NOT_WIRED.includes(target)) {
      throw new BadRequestException(
        'رابط فنی فلک هنوز روشن نیست، پس انتشار در آن مقصد ممکن نیست. فعلا دانلود و سایت عمومی در دسترس‌اند.',
      );
    }

    // دروازه ۰ — فایل. انتشار اثری که هنوز فایلی ندارد یعنی صفحه‌ای که
    // بازدیدکننده بازش می‌کند و چیزی برای دیدن نیست. تا امروز این شرط نبود
    // و `assetId` هرگز پر نمی‌شد ⇒ صفحه عمومی فقط متن شات‌لیست بود.
    const file = await this.finalAsset(projectId);
    if (!file) {
      throw new BadRequestException(
        'این اثر هنوز فایل نهایی ندارد. اول در پنل ساخت دکمه «بساز» را بزن و صبر کن مونتاژ تمام شود.',
      );
    }

    // دروازه ۱ — مجوز رسانه
    const blockers = await this.licenseBlockers(projectId, target);
    if (blockers.length > 0) {
      throw new BadRequestException(
        `این اثر در این مقصد قابل انتشار نیست: ${blockers
          .map((b) => `${b.role} با مجوز «${b.license}» — ${b.why}`)
          .join(' · ')}`,
      );
    }

    // دروازه ۲ — بازبینی. فقط برای مقصدهای عمومی معنا دارد؛ دانلود شخصی
    // کاربر بازبینی نمی‌خواهد.
    let status: 'PUBLISHED' | 'PENDING_REVIEW' = 'PUBLISHED';
    if (PUBLIC_TARGETS.includes(target)) {
      const needsHuman = project.serviceTier?.humanReview ?? false;
      const check = await this.prisma.complianceCheck.upsert({
        where: { projectId_stage: { projectId, stage: 'PRE_PUBLICATION' } },
        update: {},
        create: {
          projectId,
          stage: 'PRE_PUBLICATION',
          status: needsHuman ? 'PENDING' : 'AUTO_PASSED',
        },
      });
      if (check.status === 'REJECTED') {
        throw new ForbiddenException('این اثر در بازبینی رد شده و منتشر نمی‌شود.');
      }
      if (check.status === 'PENDING' || check.status === 'AUTO_FLAGGED') {
        status = 'PENDING_REVIEW';
      }
    }

    // 🔑 `assetId` همین‌جا قفل می‌شود، نه در زمان خواندن صفحه. یعنی اگر
    // کاربر بعدا دوباره بسازد، صفحه عمومی همان فایلی را نشان می‌دهد که
    // آگاهانه منتشر شده — تا دوباره دکمه انتشار را نزند.
    return this.prisma.publication.upsert({
      where: { projectId_target: { projectId, target } },
      update: {
        assetId: file.id,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        withdrawnAt: null,
        withdrawnBy: null,
        reasonCodeId: null,
      },
      create: {
        projectId,
        target,
        assetId: file.id,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
    });
  }

  /**
   * برداشتن. `by` مشخص می‌کند کاربر بود یا راهبر.
   *
   * رکورد حذف نمی‌شود؛ وضعیتش عوض می‌شود. تاریخچه اینکه چه چیزی منتشر
   * بوده و چرا برداشته شد باید بماند.
   */
  async withdraw(
    projectId: string,
    target: PublicationTarget,
    by: string,
    opts: { userId?: string; reasonCode?: string } = {},
  ) {
    if (opts.userId) {
      const owned = await this.prisma.project.findFirst({
        where: { id: projectId, userId: opts.userId },
        select: { id: true },
      });
      if (!owned) throw new NotFoundException('اثر پیدا نشد.');
    }

    const pub = await this.prisma.publication.findUnique({
      where: { projectId_target: { projectId, target } },
    });
    if (!pub) throw new NotFoundException('این اثر در این مقصد منتشر نشده.');

    let reasonCodeId: string | null = null;
    if (opts.reasonCode) {
      const rc = await this.prisma.reasonCode.findUnique({ where: { code: opts.reasonCode } });
      if (!rc) throw new BadRequestException(`کد دلیل «${opts.reasonCode}» تعریف نشده.`);
      reasonCodeId = rc.id;
    }

    return this.prisma.publication.update({
      where: { id: pub.id },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawnBy: by, reasonCodeId },
    });
  }

  /**
   * برداشتن از **همه** مقصدها با یک فرمان.
   *
   * دلیل وجودش: وقتی اثری مشکل‌دار پیدا می‌شود، راهبر نباید مجبور باشد
   * چهار جا را جدا بگردد. یکی از آن‌ها همیشه جا می‌ماند.
   */
  async withdrawEverywhere(projectId: string, by: string, reasonCode?: string) {
    const pubs = await this.prisma.publication.findMany({
      where: { projectId, status: { not: 'WITHDRAWN' } },
      select: { target: true },
    });
    const results = [];
    for (const p of pubs) {
      results.push(await this.withdraw(projectId, p.target, by, { reasonCode }));
    }
    return { withdrawn: results.length, targets: pubs.map((p) => p.target) };
  }

  // ─── سایت عمومی ───

  /** نام نمایشی امن. شماره موبایل هرگز از این تابع بیرون نمی‌آید. */
  private publicName(user: { displayName: string | null }): string {
    return user.displayName?.trim() || 'سازنده ناشناس';
  }

  async discover(opts: { take?: number; typeKey?: string } = {}) {
    const take = Math.min(60, Math.max(1, opts.take ?? 24));
    const rows = await this.prisma.publication.findMany({
      where: {
        target: 'PUBLIC_SITE',
        status: 'PUBLISHED',
        ...(opts.typeKey ? { project: { productionType: { key: opts.typeKey } } } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take,
      select: {
        viewCount: true,
        publishedAt: true,
        asset: { select: { durationSec: true } },
        project: {
          select: {
            id: true,
            title: true,
            targetDurationSec: true,
            materialStyle: true,
            productionType: { select: { key: true, title: true } },
            user: { select: { id: true, displayName: true } },
            _count: { select: { comments: true } },
            // ⚠️ ردیف‌های انتشاری که پیش از وصل شدن این لایه ساخته شده‌اند
            // `assetId` خالی دارند. بدون این جایگزین، کارت همان اثری که
            // صفحه‌اش ویدیو دارد بی‌ویدیو نشان داده می‌شود.
            assets: {
              where: { role: 'final_output' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { durationSec: true },
            },
          },
        },
      },
    });

    return rows.map((r) => {
      const file = r.asset ?? r.project.assets[0] ?? null;
      return {
        id: r.project.id,
        title: r.project.title,
        type: r.project.productionType?.title ?? null,
        typeKey: r.project.productionType?.key ?? null,
        // مدت واقعی فایل ملاک است؛ `targetDurationSec` فقط خواسته کاربر بود.
        durationSec: file?.durationSec ?? r.project.targetDurationSec,
        hasVideo: Boolean(file),
        material: r.project.materialStyle,
        creator: { id: r.project.user.id, name: this.publicName(r.project.user) },
        views: r.viewCount,
        comments: r.project._count.comments,
        publishedAt: r.publishedAt,
      };
    });
  }

  /**
   * دارایی قابل پخش یک اثر عمومی.
   *
   * 🔒 شرط انتشار داخل خود کوئری است، نه در یک بررسی جدا: اگر اثر منتشر
   * نباشد یا برداشته شده باشد، هیچ ردیفی برنمی‌گردد و بایتی هم بیرون
   * نمی‌رود. `assetId` هم از ردیف انتشار می‌آید نه از ورودی کاربر — پس با
   * دست‌کاری آدرس نمی‌شود دارایی خصوصی کس دیگری را خواند.
   */
  private async publishedAsset(projectId: string) {
    const pub = await this.prisma.publication.findFirst({
      where: { projectId, target: 'PUBLIC_SITE', status: 'PUBLISHED' },
      include: { asset: true },
    });
    if (!pub) throw new NotFoundException('این اثر عمومی نیست.');
    return pub.asset ?? (await this.finalAsset(projectId));
  }

  /** بایت ویدیوی اثر عمومی — تنها راه رسیدن به فایل بدون ورود. */
  async publicVideo(projectId: string) {
    const asset = await this.publishedAsset(projectId);
    if (!asset) throw new NotFoundException('این اثر فایلی برای پخش ندارد.');

    // 🔒 این مسیر فایل را **درون‌خطی** سرو می‌کند، برخلاف مسیر محافظت‌شده
    // دارایی‌ها که همیشه `attachment` می‌فرستد. پس نوع فایل باید همین‌جا
    // به ویدیو محدود شود؛ وگرنه اگر فردا نقشی با HTML یا SVG به این‌جا
    // برسد، همین مسیر تبدیل به اجرای اسکریپت در مبدا خودمان می‌شود.
    if (!asset.mimeType.startsWith('video/')) {
      throw new NotFoundException('این اثر فایل قابل پخشی ندارد.');
    }
    return asset;
  }

  /** صفحه عمومی اثر. فقط اثری که واقعا منتشر شده. */
  async publicWork(projectId: string) {
    const pub = await this.prisma.publication.findFirst({
      where: { projectId, target: 'PUBLIC_SITE', status: 'PUBLISHED' },
      include: { asset: true },
    });
    if (!pub) throw new NotFoundException('این اثر عمومی نیست.');

    const file = pub.asset ?? (await this.finalAsset(projectId));

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        targetDurationSec: true,
        materialStyle: true,
        createdAt: true,
        productionType: { select: { title: true } },
        user: { select: { id: true, displayName: true } },
        sequences: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            title: true,
            shots: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                durationSec: true,
                description: true,
                cameraMovement: true,
                direction: { select: { miseEnScene: true, shotSize: true, lighting: true } },
              },
            },
          },
        },
      },
    });

    // شمارنده بازدید نباید خواندن صفحه را کند یا شکننده کند.
    void this.prisma.publication
      .update({ where: { id: pub.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    const comments = await this.prisma.comment.findMany({
      where: { projectId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: { select: { id: true, displayName: true } },
      },
    });

    return {
      ...project,
      user: { id: project.user.id, name: this.publicName(project.user) },
      // کلید ذخیره‌سازی هرگز بیرون نمی‌رود؛ صفحه فقط باید بداند ویدیویی
      // هست و چقدر است. آدرس پخش ثابت و مشتق از شناسه اثر است.
      video:
        file && file.mimeType.startsWith('video/')
          ? { durationSec: file.durationSec, byteSize: file.byteSize }
          : null,
      views: pub.viewCount + 1,
      publishedAt: pub.publishedAt,
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: this.publicName(c.user),
      })),
    };
  }

  async creatorProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, bio: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('سازنده پیدا نشد.');

    const works = await this.discoverByCreator(userId);
    return {
      id: user.id,
      name: this.publicName(user),
      bio: user.bio,
      joinedAt: user.createdAt,
      works,
    };
  }

  private async discoverByCreator(userId: string) {
    const rows = await this.prisma.publication.findMany({
      where: { target: 'PUBLIC_SITE', status: 'PUBLISHED', project: { userId } },
      orderBy: { publishedAt: 'desc' },
      take: 60,
      select: {
        viewCount: true,
        publishedAt: true,
        project: {
          select: {
            id: true,
            title: true,
            targetDurationSec: true,
            productionType: { select: { title: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.project.id,
      title: r.project.title,
      type: r.project.productionType?.title ?? null,
      durationSec: r.project.targetDurationSec,
      views: r.viewCount,
      publishedAt: r.publishedAt,
    }));
  }

  // ─── دیدگاه ───

  async addComment(userId: string, projectId: string, body: string) {
    const text = (body ?? '').trim();
    if (text.length < 2) throw new BadRequestException('دیدگاه خیلی کوتاه است.');
    if (text.length > 1500) throw new BadRequestException('دیدگاه تا ۱۵۰۰ نویسه پذیرفته می‌شود.');

    const pub = await this.prisma.publication.findFirst({
      where: { projectId, target: 'PUBLIC_SITE', status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!pub) throw new NotFoundException('این اثر عمومی نیست.');

    return this.prisma.comment.create({
      data: { projectId, userId, body: text },
      select: { id: true, body: true, status: true, createdAt: true },
    });
  }

  async moderateComment(
    commentId: string,
    by: string,
    action: 'APPROVED' | 'HIDDEN' | 'REJECTED',
    reasonCode?: string,
  ) {
    let reasonCodeId: string | null = null;
    if (reasonCode) {
      const rc = await this.prisma.reasonCode.findUnique({ where: { code: reasonCode } });
      if (!rc) throw new BadRequestException(`کد دلیل «${reasonCode}» تعریف نشده.`);
      reasonCodeId = rc.id;
    }
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { status: action, moderatedBy: by, moderatedAt: new Date(), reasonCodeId },
    });
  }

  // ─── نمای راهبر ───

  async adminPublications(status?: string) {
    return this.prisma.publication.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        target: true,
        status: true,
        publishedAt: true,
        withdrawnAt: true,
        viewCount: true,
        reasonCode: { select: { code: true, label: true } },
        project: {
          select: {
            id: true,
            title: true,
            user: { select: { id: true, displayName: true, phone: true } },
          },
        },
      },
    });
  }

  async adminComments(status?: string) {
    return this.prisma.comment.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        body: true,
        status: true,
        createdAt: true,
        project: { select: { id: true, title: true } },
        user: { select: { id: true, displayName: true, phone: true } },
        reasonCode: { select: { code: true, label: true } },
      },
    });
  }
}
