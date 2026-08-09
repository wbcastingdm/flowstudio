import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { buildBriefPrompt } from './brief.prompt';
import type { CampaignGoal, Tone, CameraMovement } from '@prisma/client';

const VALID_MOVEMENTS: CameraMovement[] = [
  'STATIC',
  'PAN',
  'TILT',
  'DOLLY',
  'HANDHELD',
  'COMBINED',
];

interface CreateFromIdeaInput {
  rawIdea: string;
  goal: CampaignGoal;
  tone: Tone;
  targetDurationSec?: number;
}

interface ParsedShot {
  durationSec: number;
  description: string;
  cameraMovement: string;
}

interface ParsedSequence {
  title: string;
  shots: ParsedShot[];
}

interface ParsedBrief {
  title: string;
  sequences: ParsedSequence[];
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
  ) {}

  // ✅ جای‌گیرِ `+000000000000` در اسپرینتِ ۴ برداشته شد — هر پروژه به کاربرِ
  // واردشده (D-008: موبایل+OTP) تعلق دارد.

  async createFromIdea(userId: string, input: CreateFromIdeaInput) {
    if (!input.rawIdea?.trim()) {
      throw new BadRequestException('ایده نمی‌تواند خالی باشد');
    }
    const targetDurationSec = input.targetDurationSec ?? 30;

    // مرحلهٔ متن همیشه رایگان است (نیازِ ۷، docs/60).
    const prompt = buildBriefPrompt({
      rawIdea: input.rawIdea,
      goal: input.goal,
      tone: input.tone,
      targetDurationSec,
    });
    const aiResult = await this.gateway.chat({ text: prompt });

    const parsed = this.parseBriefJson(aiResult.text);

    const project = await this.prisma.project.create({
      data: {
        userId,
        title: parsed.title,
        goal: input.goal,
        tone: input.tone,
        sequences: {
          create: parsed.sequences.map((seq, seqIdx) => ({
            order: seqIdx + 1,
            title: seq.title,
            shots: {
              create: seq.shots.map((shot, shotIdx) => ({
                order: shotIdx + 1,
                durationSec: shot.durationSec,
                description: shot.description,
                cameraMovement: this.normalizeMovement(shot.cameraMovement),
                aspectRatio: 'R9_16',
                continuityRef: undefined, // فازِ ۱ خالی می‌گذارد، حذف نمی‌کند
              })),
            },
          })),
        },
      },
      include: { sequences: { include: { shots: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
    });

    return {
      project,
      modelUsed: aiResult.modelUsed,
      providerUsed: aiResult.providerUsed,
      costActual: aiResult.costActual, // همیشه ۰ برایِ TEXT
    };
  }

  /** `userId` در شرط است، نه فقط `id` — کتابخانهٔ کاربرِ دیگر دیده نمی‌شود. */
  async findOne(userId: string, id: string) {
    return this.prisma.project.findFirst({
      where: { id, userId },
      include: {
        sequences: { include: { shots: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } },
      },
    });
  }

  async list(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sequences: { include: { shots: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } },
      },
      take: 50,
    });
  }

  private normalizeMovement(raw: string): CameraMovement {
    const upper = (raw ?? '').toUpperCase().trim() as CameraMovement;
    return VALID_MOVEMENTS.includes(upper) ? upper : 'STATIC';
  }

  /**
   * مدل ممکن است JSON را داخلِ ```json ... ``` بپیچد یا متنِ اضافه بگذارد.
   * اینجا سخت‌گیرانه استخراج می‌کنیم و اگر شکل درست نبود، صریح خطا می‌دهیم —
   * نه اینکه بی‌صدا یک شات‌لیستِ ساختگی برگردانیم.
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
        'پاسخِ مدل JSONِ معتبر نبود. دوباره تلاش کن یا مدلِ دیگری در رجیستری اضافه کن.',
      );
    }

    if (!parsed?.title || !Array.isArray(parsed.sequences) || parsed.sequences.length === 0) {
      throw new BadRequestException('پاسخِ مدل ساختارِ شات‌لیست نداشت (title/sequences).');
    }
    for (const seq of parsed.sequences) {
      if (!Array.isArray(seq.shots) || seq.shots.length === 0) {
        throw new BadRequestException('یکی از سکانس‌ها هیچ نمایی ندارد.');
      }
    }
    return parsed;
  }
}
