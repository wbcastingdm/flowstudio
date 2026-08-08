import { Body, Controller, Get, Post } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import type { Modality } from '@prisma/client';

@Controller('api/admin')
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
    },
  ) {
    return this.gateway.createModel(body);
  }

  @Get('models')
  listModels() {
    return this.gateway.listModels();
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
