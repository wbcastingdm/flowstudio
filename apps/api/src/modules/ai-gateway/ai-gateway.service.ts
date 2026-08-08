import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { encryptApiKey, decryptApiKey, maskApiKey } from './encryption.util';
import type { Modality } from '@prisma/client';

interface CreateProviderInput {
  name: string;
  baseUrl: string;
  apiKey: string;
}

interface CreateModelInput {
  providerId: string;
  modelKey: string;
  modality: Modality;
  costPerUnit: number;
  maxDurationSec?: number | null;
  acceptsSeed: boolean;
  cameraControl: string;
  commercialUse: boolean;
  regionReachable: string;
}

interface ChatInput {
  text: string;
}

/**
 * الگویِ کاندیدا + failover — از ai-provider.service.ts وبکستینگ برداشته شد.
 * گاردریلِ منشورِ اجرا شمارهٔ ۵: اگر commercialUse=false، هرگز انتخاب نشود
 * — حتی ارزان‌ترین. گاردریلِ ۶: اینجا فقط هزینه+دسترسی است، ادعای
 * «بهینه‌سازی» گذاشته نشود.
 */
@Injectable()
export class AiGatewayService {
  constructor(private readonly prisma: PrismaService) {}

  async createProvider(input: CreateProviderInput) {
    if (!input.name || !input.baseUrl || !input.apiKey) {
      throw new BadRequestException('name, baseUrl, apiKey لازم است');
    }
    const provider = await this.prisma.aiProvider.create({
      data: {
        name: input.name,
        baseUrl: input.baseUrl,
        apiKeyEncrypted: encryptApiKey(input.apiKey),
      },
    });
    return { ...provider, apiKeyEncrypted: undefined, apiKeyMasked: maskApiKey(input.apiKey) };
  }

  async createModel(input: CreateModelInput) {
    const model = await this.prisma.aiModel.create({
      data: {
        providerId: input.providerId,
        modelKey: input.modelKey,
        modality: input.modality,
        costPerUnit: input.costPerUnit,
        maxDurationSec: input.maxDurationSec ?? null,
        acceptsSeed: input.acceptsSeed,
        cameraControl: input.cameraControl,
        commercialUse: input.commercialUse,
        regionReachable: input.regionReachable,
      },
    });
    return model;
  }

  async listModels() {
    const models = await this.prisma.aiModel.findMany({
      include: { provider: { select: { id: true, name: true, baseUrl: true } } },
      orderBy: [{ modality: 'asc' }, { costPerUnit: 'asc' }],
    });
    return models;
  }

  /**
   * روتینگِ TEXT — انتخابِ ارزان‌ترینِ در دسترس‌بودهٔ commercialUse=true،
   * با failover به کاندیدایِ بعدی در خطا. یک فراخوانِ واقعیِ سازگار با
   * OpenAI؛ رایگان همیشه برایِ TEXT (D-007 نیازِ ۷، docs/60).
   */
  async chat(input: ChatInput) {
    if (!input.text?.trim()) {
      throw new BadRequestException('text لازم است');
    }

    const candidates = await this.prisma.aiModel.findMany({
      where: { modality: 'TEXT', commercialUse: true },
      include: { provider: true },
      orderBy: { costPerUnit: 'asc' },
    });

    if (candidates.length === 0) {
      throw new ServiceUnavailableException(
        'هیچ مدلِ TEXTی با commercialUse=true ثبت نشده — اول یک درگاه و مدل در /admin/models اضافه کنید.',
      );
    }

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const apiKey = decryptApiKey(candidate.provider.apiKeyEncrypted);
        const responseText = await this.callOpenAiCompatible(
          candidate.provider.baseUrl,
          apiKey,
          candidate.modelKey,
          input.text,
        );
        return {
          text: responseText,
          modelUsed: candidate.modelKey,
          providerUsed: candidate.provider.name,
          costActual: 0, // TEXT همیشه رایگان
        };
      } catch (err) {
        lastError = err;
        continue; // failover به کاندیدایِ بعدی
      }
    }
    throw new ServiceUnavailableException(
      `همهٔ ${candidates.length} کاندیدایِ TEXT شکست خوردند: ${String(lastError)}`,
    );
  }

  private async callOpenAiCompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    text: string,
  ): Promise<string> {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) {
      // کلیدِ API هرگز در لاگ/پیامِ خطا ظاهر نشود (گاردریلِ منشورِ اجرا).
      throw new Error(`HTTP ${res.status} از ${new URL(baseUrl).host}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('پاسخِ نامعتبر — بدونِ content');
    return content;
  }
}
