import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { RegistryService } from '../registry/registry.service';
import { buildBriefPrompt } from './brief.prompt';
import { buildLocalPlan } from './local-planner';
import type { CameraMovement, MaterialStyle, Prisma } from '@prisma/client';

const VALID_MOVEMENTS: CameraMovement[] = [
  'STATIC',
  'PAN',
  'TILT',
  'DOLLY',
  'HANDHELD',
  'COMBINED',
];

const VALID_SHOT_SIZES = ['EXTREME_WIDE', 'WIDE', 'MEDIUM', 'CLOSE_UP', 'EXTREME_CLOSE_UP'];
const VALID_ANGLES = ['EYE_LEVEL', 'LOW', 'HIGH', 'OVERHEAD', 'DUTCH'];
const VALID_MATERIALS: MaterialStyle[] = [
  'REAL',
  'ANIME',
  'COMIC',
  'FANTASY',
  'THREE_D',
  'STOP_MOTION',
];

export interface CreateFromIdeaInput {
  rawIdea: string;
  /** کلید نوع تولید از رجیستری. */
  productionType: string;
  /** پاسخ زیرشاخه‌های همان نوع. */
  attributes?: Record<string, unknown>;
  targetDurationSec?: number;
  materialStyle?: string;
  materialFidelity?: number;
  serviceTier?: string;
}

interface ParsedShot {
  durationSec: number;
  description: string;
  cameraMovement: string;
  miseEnScene?: string;
  shotSize?: string;
  cameraAngle?: string;
  lighting?: string;
  colorMood?: string;
}

interface ParsedSequence {
  title: string;
  shots: ParsedShot[];
}

interface ParsedBrief {
  title: string;
  sequences: ParsedSequence[];
}

/**
 * لایه ۲ معماری — فهم و پلان.
 *
 * ورودی: ایده کاربر و انتخاب‌هایش. خروجی: پروژه با سلسله مراتب نما و
 * **کارگردانی هر نما**. هیچ نام مدلی این‌جا نیست و هیچ قاعده‌ای مخصوص یک
 * نوع تولید در کد ثابت نشده — همه از رجیستری می‌آید.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
    private readonly registry: RegistryService,
  ) {}

  async createFromIdea(userId: string, input: CreateFromIdeaInput) {
    if (!input.rawIdea?.trim()) {
      throw new BadRequestException('ایده نمی‌تواند خالی باشد.');
    }
    if (!input.productionType?.trim()) {
      throw new BadRequestException('نوع تولید را انتخاب کن.');
    }

    const type = await this.registry.getProductionType(input.productionType.trim());
    if (!type.isActive) {
      throw new BadRequestException(`نوع «${type.title}» فعلا در دسترس نیست.`);
    }

    // زیرشاخه‌ها در برابر شمای همان نوع سنجیده می‌شوند، نه یک شمای ثابت.
    const attributes = this.registry.validateAttributes(type.fieldSchema, input.attributes ?? {});

    const targetDurationSec = input.targetDurationSec ?? type.minDurationSec;
    if (targetDurationSec < type.minDurationSec || targetDurationSec > type.maxDurationSec) {
      throw new BadRequestException(
        `مدت «${type.title}» باید بین ${type.minDurationSec} تا ${type.maxDurationSec} ثانیه باشد.`,
      );
    }

    // سطح خدمت پیش از هر کاری سنجیده می‌شود — نه بعد از تولید.
    let tier = null;
    if (input.serviceTier) {
      tier = await this.registry.getServiceTier(input.serviceTier);
      this.registry.assertWithinTier(tier, { durationSec: targetDurationSec });
    }

    const materialStyle = this.normalizeMaterial(input.materialStyle);

    // مرحله متنی همیشه رایگان است، پس بدون رزرو سکه اجرا می‌شود.
    const plan = await this.buildPlan({
      rawIdea: input.rawIdea,
      type,
      attributes,
      targetDurationSec,
      materialStyle,
      materialFidelity: input.materialFidelity ?? null,
    });
    const parsed = plan.brief;

    const project = await this.prisma.project.create({
      data: {
        userId,
        title: parsed.title,
        productionTypeId: type.id,
        attributes: attributes as Prisma.InputJsonValue,
        materialStyle,
        materialFidelity: input.materialFidelity ?? null,
        targetDurationSec,
        serviceTierId: tier?.id ?? null,
        sequences: {
          create: parsed.sequences.map((seq, seqIdx) => ({
            order: seqIdx + 1,
            title: seq.title,
            shots: {
              create: seq.shots.map((shot, shotIdx) => ({
                order: shotIdx + 1,
                durationSec: this.clampDuration(shot.durationSec),
                description: shot.description ?? '',
                cameraMovement: this.normalizeMovement(shot.cameraMovement),
                aspectRatio: 'R9_16',
                continuityRef: undefined,
                // کارگردانی نما در همان تراکنش ساخته می‌شود. همه فیلدهایش
                // این‌جا از ماشین آمده‌اند، چون کاربر هنوز چیزی نگفته.
                direction: {
                  create: {
                    miseEnScene: shot.miseEnScene ?? null,
                    cameraMovement: this.normalizeMovement(shot.cameraMovement),
                    shotSize: this.pick(shot.shotSize, VALID_SHOT_SIZES),
                    cameraAngle: this.pick(shot.cameraAngle, VALID_ANGLES),
                    lighting: shot.lighting ?? null,
                    colorMood: shot.colorMood ?? null,
                    origins: this.machineOrigins(shot),
                  },
                },
              })),
            },
          })),
        },
      },
      include: this.fullInclude(),
    });

    return {
      project,
      modelUsed: plan.modelUsed,
      providerUsed: plan.providerUsed,
      costActual: plan.costActual,
      /// `local` یعنی هیچ مدلی صدا زده نشد. رابط این را صریح نشان می‌دهد —
      /// کاربر باید بداند شات‌لیستش را چه چیزی نوشته.
      planner: plan.planner,
    };
  }

  /**
   * شات‌لیست را از کجا بیاوریم.
   *
   * شرط **وجودِ مدل** است، نه یک پرچمِ دستی: تا وقتی هیچ ردیفِ `AiModel`ی با
   * `modality=TEXT` و مصرفِ تجاری ثبت نشده، مسیرِ محلی کار می‌کند؛ لحظه‌ای
   * که مالک کلیدِ واقعی را در `/admin/models` ثبت کند، همین تابع بدونِ هیچ
   * تغییرِ کدی به مدلِ واقعی سوئیچ می‌کند.
   *
   * ⚠️ شکستِ یک مدلِ **ثبت‌شده** عمداً به مسیرِ محلی نمی‌افتد. اگر مالک کلید
   * گذاشته و درگاه خطا می‌دهد، باید خطا را ببیند — نه اینکه سیستم بی‌صدا
   * کیفیتِ پایین‌تر تحویل دهد و او هرگز نفهمد پولی که داده کار نمی‌کند.
   */
  private async buildPlan(input: {
    rawIdea: string;
    type: { key: string; title: string; promptGuide: string; fieldSchema: unknown };
    attributes: Record<string, unknown>;
    targetDurationSec: number;
    materialStyle: MaterialStyle | null;
    materialFidelity: number | null;
  }): Promise<{
    brief: ParsedBrief;
    modelUsed: string;
    providerUsed: string;
    costActual: number;
    planner: 'model' | 'local';
  }> {
    const textModels = await this.prisma.aiModel.count({
      where: { modality: 'TEXT', commercialUse: true },
    });

    if (textModels === 0) {
      const local = buildLocalPlan({
        rawIdea: input.rawIdea,
        targetDurationSec: input.targetDurationSec,
        typeTitle: input.type.title,
        attributes: input.attributes,
      });
      return {
        brief: local as ParsedBrief,
        modelUsed: 'برنامه‌ریزِ محلی',
        providerUsed: 'بدونِ درگاه',
        costActual: 0,
        planner: 'local',
      };
    }

    const prompt = buildBriefPrompt({
      rawIdea: input.rawIdea,
      promptGuide: input.type.promptGuide,
      typeKey: input.type.key,
      typeTitle: input.type.title,
      fieldSchema: input.type.fieldSchema,
      attributes: input.attributes,
      targetDurationSec: input.targetDurationSec,
      materialStyle: input.materialStyle,
      materialFidelity: input.materialFidelity,
    });
    const aiResult = await this.gateway.chat({ text: prompt });
    return {
      brief: this.parseBriefJson(aiResult.text),
      modelUsed: aiResult.modelUsed,
      providerUsed: aiResult.providerUsed,
      costActual: aiResult.costActual,
      planner: 'model',
    };
  }

  /**
   * ویرایش کارگردانی یک نما توسط کاربر.
   *
   * هر فیلدی که کاربر دست بزند، مبدأش به USER تغییر می‌کند — چون از آن لحظه
   * دیگر پیشنهاد ماشین نیست، تصمیم کاربر است. همین تفکیک بعدا اجازه می‌دهد
   * سنجیده شود کدام پیشنهادهای ماشین پذیرفته شدند.
   */
  async updateDirection(
    userId: string,
    shotId: string,
    patch: Record<string, string | null>,
  ) {
    const shot = await this.prisma.shot.findFirst({
      where: { id: shotId, sequence: { project: { userId } } },
      include: { direction: true },
    });
    if (!shot) throw new BadRequestException('نما پیدا نشد.');

    const EDITABLE = [
      'miseEnScene',
      'cameraMovement',
      'shotSize',
      'cameraAngle',
      'lighting',
      'colorMood',
    ] as const;

    const data: Record<string, unknown> = {};
    const origins: Record<string, string> = {
      ...((shot.direction?.origins as Record<string, string>) ?? {}),
    };

    for (const key of EDITABLE) {
      if (!(key in patch)) continue;
      const value = patch[key];
      if (key === 'shotSize' && value && !VALID_SHOT_SIZES.includes(value)) {
        throw new BadRequestException(`اندازه نما باید یکی از ${VALID_SHOT_SIZES.join('، ')} باشد.`);
      }
      if (key === 'cameraAngle' && value && !VALID_ANGLES.includes(value)) {
        throw new BadRequestException(`زاویه دوربین باید یکی از ${VALID_ANGLES.join('، ')} باشد.`);
      }
      data[key] = value;
      origins[key] = 'USER';
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('هیچ فیلد قابل ویرایشی فرستاده نشد.');
    }

    // حرکت دوربین در دو جا زندگی می‌کند: روی خود نما (که موتور تولید از آن
    // می‌خواند) و در کارگردانی. هر دو با هم به‌روز می‌شوند تا واگرا نشوند.
    if (typeof data.cameraMovement === 'string') {
      await this.prisma.shot.update({
        where: { id: shotId },
        data: { cameraMovement: this.normalizeMovement(data.cameraMovement) },
      });
    }

    return this.prisma.sceneDirection.upsert({
      where: { shotId },
      update: { ...data, origins },
      create: { shotId, ...data, origins },
    });
  }

  /** `userId` در شرط است، نه فقط `id` — آرشیو کاربر دیگر دیده نمی‌شود. */
  async findOne(userId: string, id: string) {
    return this.prisma.project.findFirst({
      where: { id, userId },
      include: this.fullInclude(),
    });
  }

  async list(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        productionType: { select: { key: true, title: true } },
        serviceTier: { select: { key: true, title: true } },
        publications: { select: { target: true, status: true, externalUrl: true } },
        sequences: {
          include: { shots: { orderBy: { order: 'asc' }, include: { direction: true } } },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  private fullInclude() {
    return {
      productionType: true,
      serviceTier: true,
      publications: true,
      sequences: {
        include: { shots: { orderBy: { order: 'asc' as const }, include: { direction: true } } },
        orderBy: { order: 'asc' as const },
      },
    };
  }

  private machineOrigins(shot: ParsedShot): Record<string, string> {
    const keys: Array<keyof ParsedShot> = [
      'miseEnScene',
      'cameraMovement',
      'shotSize',
      'cameraAngle',
      'lighting',
      'colorMood',
    ];
    const o: Record<string, string> = {};
    for (const k of keys) {
      if (shot[k]) o[k] = 'MACHINE';
    }
    return o;
  }

  private pick(value: string | undefined, allowed: string[]): string | null {
    const v = (value ?? '').toUpperCase().trim();
    return allowed.includes(v) ? v : null;
  }

  private clampDuration(raw: number): number {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return 4;
    return Math.min(15, Math.max(2, n));
  }

  private normalizeMovement(raw: string): CameraMovement {
    const upper = (raw ?? '').toUpperCase().trim() as CameraMovement;
    return VALID_MOVEMENTS.includes(upper) ? upper : 'STATIC';
  }

  private normalizeMaterial(raw?: string): MaterialStyle | null {
    if (!raw) return null;
    const upper = raw.toUpperCase().trim() as MaterialStyle;
    if (!VALID_MATERIALS.includes(upper)) {
      throw new BadRequestException(`جنس تصویر باید یکی از ${VALID_MATERIALS.join('، ')} باشد.`);
    }
    return upper;
  }

  /**
   * مدل ممکن است JSON را داخل حصار markdown بپیچد یا متن اضافه بگذارد.
   * این‌جا سخت‌گیرانه استخراج می‌شود و اگر شکل درست نبود صریح خطا داده
   * می‌شود — نه اینکه بی‌صدا یک شات‌لیست ساختگی برگردد.
   */
  private parseBriefJson(raw: string): ParsedBrief {
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      text = text.slice(firstBrace, lastBrace + 1);
    }

    let parsed: ParsedBrief;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BadRequestException(
        'پاسخ مدل JSON معتبر نبود. دوباره تلاش کن یا مدل دیگری در رجیستری اضافه کن.',
      );
    }

    if (!parsed?.title || !Array.isArray(parsed.sequences) || parsed.sequences.length === 0) {
      throw new BadRequestException('پاسخ مدل ساختار شات‌لیست نداشت.');
    }
    for (const seq of parsed.sequences) {
      if (!Array.isArray(seq.shots) || seq.shots.length === 0) {
        throw new BadRequestException('یکی از سکانس‌ها هیچ نمایی ندارد.');
      }
    }
    return parsed;
  }
}
