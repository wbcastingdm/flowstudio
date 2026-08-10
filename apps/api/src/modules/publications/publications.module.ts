import { Module } from '@nestjs/common';
import { PublicationsService } from './publications.service';
import {
  CommentsController,
  PublicSiteController,
  PublicationsAdminController,
  PublicationsController,
} from './publications.controller';
import { RegistryModule } from '../registry/registry.module';

@Module({
  imports: [RegistryModule],
  controllers: [
    PublicationsController,
    PublicSiteController,
    CommentsController,
    PublicationsAdminController,
  ],
  providers: [PublicationsService],
  exports: [PublicationsService],
})
export class PublicationsModule {}
