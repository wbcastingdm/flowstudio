import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PublicationsService } from './publications.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import type { SessionPayload } from '../auth/token.util';
import type { PublicationTarget } from '@prisma/client';

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
  constructor(private readonly pubs: PublicationsService) {}

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
