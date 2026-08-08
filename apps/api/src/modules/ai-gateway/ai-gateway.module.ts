import { Module } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { AiGatewayAdminController, ChatController } from './ai-gateway.controller';

@Module({
  controllers: [AiGatewayAdminController, ChatController],
  providers: [AiGatewayService],
})
export class AiGatewayModule {}
