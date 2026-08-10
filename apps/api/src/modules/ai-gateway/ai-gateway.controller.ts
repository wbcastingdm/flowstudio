import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiGatewayService, STEP_TYPES } from './ai-gateway.service';
import { AdminGuard } from '../auth/admin.guard';
import type { Modality } from '@prisma/client';

/**
 * 🔒 از ۱۹ مرداد قفل است. تا آن روز روی زیردامنه باز بود؛ با زنده‌شدنِ
 * `flowstudio.ir` روی دامنهٔ عمومی، درِ بازِ «ثبتِ درگاه» یعنی هر رهگذری
 * می‌تواند `baseUrl`ِ خودش را جا بزند و فراخوان‌های کاربران را به سرورِ
 * خودش ببرد. راز در هدرِ `x-admin-key`.
 */
@Controller('api/admin')
@UseGuards(AdminGuard)
export class AiGatewayAdminController {
  constructor(private readonly gateway: AiGatewayService) {}

  @Post('providers')
  createProvider(@Body() body: { name: string; baseUrl: string; apiKey: string }) {
    return this.gateway.createProvider(body);
  }

  @Post('models')
  createModel(
    @Body()
    body: {
      providerId: string;
      modelKey: string;
      modality: Modality;
      costPerUnit: number;
      maxDurationSec?: number | null;
      acceptsSeed: boolean;
      cameraControl: string;
      commercialUse: boolean;
      regionReachable: string;
      stepTypes?: string[];
      listPricePerUnit?: number | null;
      listPriceCurrency?: string | null;
    },
  ) {
    return this.gateway.createModel(body);
  }

  @Get('models')
  listModels() {
    return this.gateway.listModels();
  }

  /** تاکسونومیِ بستهٔ گام‌ها — پنلِ ادمین از همین‌جا می‌خواند، نه از فهرستِ تکراری. */
  @Get('step-types')
  stepTypes() {
    return STEP_TYPES;
  }
}

@Controller('api')
export class ChatController {
  constructor(private readonly gateway: AiGatewayService) {}

  @Post('chat')
  chat(@Body() body: { text: string }) {
    return this.gateway.chat(body);
  }
}
