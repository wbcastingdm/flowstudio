import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [AiGatewayModule, RegistryModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
