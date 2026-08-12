import { Module } from '@nestjs/common';
import { PublicationsService } from './publications.service';
import {
  CommentsController,
  PublicSiteController,
  PublicationsAdminController,
  PublicationsController,
} from './publications.controller';
import { RegistryModule } from '../registry/registry.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  // `AssetsModule` فقط برای `StorageService` است — صفحه عمومی باید بایت
  // فایل را بدهد و تنها جایی که کلید به مسیر واقعی تبدیل می‌شود همان‌جاست.
  imports: [RegistryModule, AssetsModule],
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
