import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PublicationTarget } from '@prisma/client';

/** یک فیلد از `fieldSchema` یک نوع تولید. */
export interface TypeField {
  key: string;
  label: string;
  kind: 'select' | 'text' | 'number';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

/**
 * رجیستری محصول — تنها منبع حقیقت برای «چه چیزی قابل انتخاب است».
 *
 * فرم استودیو، پنل راهبر و موتور پرامپت هر سه از این‌جا می‌خوانند. اگر هر
 * کدام فهرست خودش را داشته باشد، روزی که یک نوع تولید اضافه شود سه جا باید
 * عوض شوند و یکی‌شان فراموش می‌شود.
 */
@Injectable()
export class RegistryService {
  constructor(private readonly prisma: PrismaService) {}

  /** نوع‌هایی که کاربر می‌بیند. پنل راهبر غیرفعال‌ها را هم می‌خواهد. */
  async listProductionTypes(includeInactive = false) {
    return this.prisma.productionType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async getProductionType(key: string) {
    const type = await this.prisma.productionType.findUnique({ where: { key } });
    if (!type) throw new NotFoundException(`نوع تولید «${key}» تعریف نشده.`);
    return type;
  }

  async listServiceTiers(includeInactive = false) {
    return this.prisma.serviceTier.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async getServiceTier(key: string) {
    const tier = await this.prisma.serviceTier.findUnique({ where: { key } });
    if (!tier) throw new NotFoundException(`سطح خدمت «${key}» تعریف نشده.`);
    return tier;
  }

  async listLicenses() {
    return this.prisma.mediaLicense.findMany({ orderBy: { code: 'asc' } });
  }

  /**
   * کاتالوگ رسانه، **فیلترشده بر اساس مقصد انتشار**.
   *
   * این متد قلب «قوانین رایگان» است: ترکی که برای دانلود شخصی آزاد است
   * ممکن است برای انتشار روی فلک آزاد نباشد. به‌جای اینکه به حافظه کاربر
   * تکیه کنیم، آیتم نامجاز اصلا در فهرست انتخاب دیده نمی‌شود.
   *
   * `allowedTargets` خالی یعنی «همه مقصدها» — پس شرط باید هر دو حالت را
   * بپوشاند، وگرنه مجوزهای بدون قید هم فیلتر می‌شوند.
   */
  async listCatalog(opts: {
    kind?: string;
    genre?: string;
    target?: PublicationTarget;
    maxPriceCoins?: number;
  }) {
    const items = await this.prisma.mediaCatalogItem.findMany({
      where: {
        isActive: true,
        ...(opts.kind ? { kind: opts.kind } : {}),
        ...(opts.genre ? { genres: { has: opts.genre } } : {}),
        ...(opts.maxPriceCoins != null ? { priceCoins: { lte: opts.maxPriceCoins } } : {}),
      },
      include: { license: true },
      orderBy: [{ priceCoins: 'asc' }, { title: 'asc' }],
    });

    if (!opts.target) return items;
    return items.filter(
      (i) => i.license.allowedTargets.length === 0 || i.license.allowedTargets.includes(opts.target!),
    );
  }

  /**
   * آیا این مجوز اجازه انتشار در این مقصد را می‌دهد.
   * همین یک تابع پیش از هر انتشار صدا زده می‌شود.
   */
  licensePermitsTarget(
    license: { allowedTargets: PublicationTarget[] },
    target: PublicationTarget,
  ): boolean {
    return license.allowedTargets.length === 0 || license.allowedTargets.includes(target);
  }

  /**
   * اعتبارسنجی پاسخ‌های کاربر در برابر `fieldSchema` همان نوع.
   *
   * چرا در سرویس و نه در پایگاه داده: شکل این داده به نوع وابسته است، پس
   * هیچ ستون ثابتی نمی‌تواند اعتبارش را تضمین کند. در عوض این‌جا سخت‌گیرانه
   * بررسی می‌شود و **فیلد ناشناخته دور ریخته می‌شود** تا داده بی‌صاحب در
   * ستون Json تلنبار نشود.
   */
  validateAttributes(fieldSchema: unknown, input: Record<string, unknown> = {}) {
    const fields = (Array.isArray(fieldSchema) ? fieldSchema : []) as TypeField[];
    const clean: Record<string, unknown> = {};
    const problems: string[] = [];

    for (const f of fields) {
      const raw = input?.[f.key];
      const missing = raw === undefined || raw === null || String(raw).trim() === '';

      if (missing) {
        if (f.required) problems.push(`«${f.label}» لازم است`);
        continue;
      }

      if (f.kind === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          problems.push(`«${f.label}» باید عدد باشد`);
          continue;
        }
        clean[f.key] = n;
        continue;
      }

      const value = String(raw).trim();
      if (f.kind === 'select') {
        const allowed = (f.options ?? []).map((o) => o.value);
        if (!allowed.includes(value)) {
          problems.push(`«${f.label}» باید یکی از ${allowed.join('، ')} باشد`);
          continue;
        }
      }
      clean[f.key] = value;
    }

    if (problems.length > 0) {
      throw new BadRequestException(problems.join(' · '));
    }
    return clean;
  }

  /**
   * سازگاری درخواست با سطح خدمت — **پیش از** ساختن هر چیزی.
   *
   * گاردریل: سطح با سیاست تعریف شده نه با فهرست شناسه مدل، پس افزودن یک
   * مدل تازه به رجیستری هیچ سطحی را نمی‌شکند.
   */
  assertWithinTier(
    tier: { title: string; maxDurationSec: number; allowedStepTypes: string[] },
    opts: { durationSec?: number; stepTypes?: string[] },
  ) {
    if (opts.durationSec != null && opts.durationSec > tier.maxDurationSec) {
      throw new BadRequestException(
        `سطح ${tier.title} تا ${tier.maxDurationSec} ثانیه است و درخواست ${opts.durationSec} ثانیه بود.`,
      );
    }
    if (tier.allowedStepTypes.length > 0 && opts.stepTypes?.length) {
      const denied = opts.stepTypes.filter((s) => !tier.allowedStepTypes.includes(s));
      if (denied.length > 0) {
        throw new BadRequestException(
          `این گام‌ها در سطح ${tier.title} در دسترس نیستند: ${denied.join('، ')}`,
        );
      }
    }
  }
}
