import { Module } from '@nestjs/common';
import { RegistryService } from './registry.service';
import { RegistryAdminController, RegistryController } from './registry.controller';

@Module({
  controllers: [RegistryController, RegistryAdminController],
  providers: [RegistryService],
  exports: [RegistryService],
})
export class RegistryModule {}
