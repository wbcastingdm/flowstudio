import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AssetsService, type UploadedFile as FsFile } from './assets.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionPayload } from '../auth/token.util';

/**
 * آرشیو رسانه — همه مسیرها محافظت‌شده. هر دارایی به کاربر واردشده تعلق
 * دارد و شرط `userId` در خود کوئری است، نه در یک بررسی جداگانه.
 */
@Controller('api/assets')
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() session: SessionPayload,
    @UploadedFile() file: FsFile,
    @Body() body: { kind: string; role: string; projectId?: string },
  ) {
    return this.assets.upload(session.sub, file, body);
  }

  @Get()
  list(
    @CurrentUser() session: SessionPayload,
    @Query('projectId') projectId?: string,
    @Query('kind') kind?: string,
    @Query('role') role?: string,
  ) {
    return this.assets.list(session.sub, { projectId, kind, role });
  }

  /**
   * دانلود فایل از راه یک مسیر محافظت‌شده، نه پوشه عمومی.
   *
   * `Content-Disposition: attachment` عمدی است: فایل کاربر در همان مبدأ
   * رندر نمی‌شود، پس یک SVG یا HTML آلوده نمی‌تواند در بستر نشست ما اجرا شود.
   */
  @Get(':id/file')
  async file(
    @CurrentUser() session: SessionPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { asset, buffer } = await this.assets.readForUser(session.sub, id);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${asset.id}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.end(buffer);
  }

  @Delete(':id')
  remove(@CurrentUser() session: SessionPayload, @Param('id') id: string) {
    return this.assets.remove(session.sub, id);
  }
}
