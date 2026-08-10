import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AssetsService } from './assets.service';
import { StorageService } from './storage.service';
import { AssetsController } from './assets.controller';

/**
 * فایل در حافظه گرفته می‌شود نه روی دیسک موقت: پیش از نوشتن باید هشش را
 * بگیریم و سیاست پذیرش را بسنجیم. سقف اینجا سخت‌گیرانه‌ترین سقف ممکن است
 * (کلیپ)؛ سقف دقیق هر جنس در سرویس اعمال می‌شود.
 */
@Module({
  imports: [MulterModule.register({ limits: { fileSize: 200 * 1024 * 1024, files: 1 } })],
  controllers: [AssetsController],
  providers: [AssetsService, StorageService],
  exports: [AssetsService, StorageService],
})
export class AssetsModule {}
