import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiGatewayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
