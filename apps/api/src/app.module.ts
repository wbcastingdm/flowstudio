import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { RegistryModule } from './modules/registry/registry.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AdminModule } from './modules/admin/admin.module';
import { PublicationsModule } from './modules/publications/publications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiGatewayModule,
    AuthModule,
    ProjectsModule,
    WalletModule,
    JobsModule,
    RegistryModule,
    AssetsModule,
    AdminModule,
    PublicationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
