import { Body, Controller, Get, Headers, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PublicationsService } from './publications.service';
import { StorageService } from '../assets/storage.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { SessionPayload } from '../auth/token.util';
import type { PublicationTarget } from '@prisma/client';

/**
 * سربرگ `Range` را به بازه بایتی تبدیل می‌کند.
 *
 * فقط شکل تک‌بازه‌ای پشتیبانی می‌شود — همان چیزی که مرورگرها برای ویدیو
 * می‌فرستند. هر شکل دیگری `null` می‌گیرد و پاسخ کامل داده می‌شود، که
 * رفتار درست و امن است.
 */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec((header ?? '').trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  // `bytes=-500` یعنی «۵۰۰ بایت آخر»، نه «از صفر تا ۵۰۰».
  const start = rawStart === '' ? Math.max(0, size - Number(rawEnd || 0)) : Number(rawStart);
  const end = rawStart === '' ? size - 1 : Math.min(size - 1, rawEnd === '' ? size - 1 : Number(rawEnd));

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end };
}

/** انتشار و برداشتن توسط خود کاربر. */
@Controller('api/publications')
@UseGuards(AuthGuard)
export class PublicationsController {
  constructor(private readonly pubs: PublicationsService) {}

  @Get(':projectId')
  status(@CurrentUser() s: SessionPayload, @Param('projectId') projectId: string) {
    return this.pubs.statusFor(s.sub, projectId);
  }

  @Post(':projectId/publish')
  publish(
    @CurrentUser() s: SessionPayload,
    @Param('projectId') projectId: string,
    @Body() body: { target: PublicationTarget },
  ) {
    return this.pubs.publish(s.sub, projectId, body.target);
  }

  @Post(':projectId/withdraw')
  withdraw(
    @CurrentUser() s: SessionPayload,
    @Param('projectId') projectId: string,
    @Body() body: { target: PublicationTarget },
  ) {
    return this.pubs.withdraw(projectId, body.target, `user:${s.sub}`, { userId: s.sub });
  }
}

/**
 * سایت عمومی — بدون ورود.
 *
 * 🔒 هیچ مسیری این‌جا شماره موبایل برنمی‌گرداند. نام نمایشی از یک تابع
 * واحد می‌آید تا اگر فردا فیلدی اضافه شد، از یک جا کنترل شود.
 */
@Controller('api/public')
export class PublicSiteController {
  constructor(
    private readonly pubs: PublicationsService,
    private readonly storage: StorageService,
  ) {}

  /**
   * پخش ویدیوی اثر عمومی — بدون ورود، ولی فقط برای اثری که واقعا منتشر
   * شده. تنها مسیر بدون گارد که به بایت فایل می‌رسد.
   *
   * پاسخ بازه‌ای اجباری است: بدون آن نوار زمان کار نمی‌کند و سافاری اصلا
   * ویدیو را شروع نمی‌کند.
   */
  @Get('works/:projectId/video')
  async video(
    @Param('projectId') projectId: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ) {
    const asset = await this.pubs.publicVideo(projectId);
    const size = await this.storage.size(asset.storageKey);
    const range = parseRange(rangeHeader, size);

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    // فایل منتشرشده تغییر نمی‌کند — انتشار دوباره دارایی تازه‌ای می‌سازد.
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (!range) {
      res.setHeader('Content-Length', String(size));
      this.storage.stream(asset.storageKey).pipe(res);
      return;
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
    res.setHeader('Content-Length', String(range.end - range.start + 1));
    this.storage.stream(asset.storageKey, range).pipe(res);
  }

  @Get('discover')
  discover(@Query('type') type?: string, @Query('take') take?: string) {
    return this.pubs.discover({ typeKey: type, take: take ? Number(take) : undefined });
  }

  @Get('works/:projectId')
  work(@Param('projectId') projectId: string) {
    return this.pubs.publicWork(projectId);
  }

  @Get('creators/:userId')
  creator(@Param('userId') userId: string) {
    return this.pubs.creatorProfile(userId);
  }
}

/** دیدگاه — نوشتنش ورود می‌خواهد، خواندنش نه (در صفحه اثر می‌آید). */
@Controller('api/comments')
@UseGuards(AuthGuard)
export class CommentsController {
  constructor(private readonly pubs: PublicationsService) {}

  @Post(':projectId')
  add(
    @CurrentUser() s: SessionPayload,
    @Param('projectId') projectId: string,
    @Body() body: { body: string },
  ) {
    return this.pubs.addComment(s.sub, projectId, body?.body);
  }
}

/** نمای راهبر: مدیریت نمایش‌ها و نظرات از یک جا. */
@Controller('api/admin')
@UseGuards(AdminGuard)
export class PublicationsAdminController {
  constructor(private readonly pubs: PublicationsService) {}

  @Get('publications')
  list(@Query('status') status?: string) {
    return this.pubs.adminPublications(status);
  }

  @Get('comments')
  comments(@Query('status') status?: string) {
    return this.pubs.adminComments(status);
  }

  @Post('publications/:projectId/withdraw')
  withdraw(
    @Param('projectId') projectId: string,
    @Body() body: { target?: PublicationTarget; reasonCode?: string; all?: boolean },
  ) {
    if (body?.all || !body?.target) {
      return this.pubs.withdrawEverywhere(projectId, 'admin', body?.reasonCode);
    }
    return this.pubs.withdraw(projectId, body.target, 'admin', { reasonCode: body.reasonCode });
  }

  @Post('comments/:id/moderate')
  moderate(
    @Param('id') id: string,
    @Body() body: { action: 'APPROVED' | 'HIDDEN' | 'REJECTED'; reasonCode?: string },
  ) {
    return this.pubs.moderateComment(id, 'admin', body.action, body.reasonCode);
  }
}
