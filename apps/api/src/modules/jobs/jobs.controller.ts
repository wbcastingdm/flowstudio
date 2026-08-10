import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobGroupsService } from './job-groups.service';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionPayload } from '../auth/token.util';

/**
 * پاکتِ بودجه — کاربر پیش از هر گامِ پولی یکی می‌سازد و سقفش را **خودش**
 * تعیین می‌کند (وارونگیِ بودجه، سندِ ۸۱ بخشِ ۱۳).
 */
@Controller('api/job-groups')
@UseGuards(AuthGuard)
export class JobGroupsController {
  constructor(private readonly groups: JobGroupsService) {}

  @Post()
  create(
    @CurrentUser() session: SessionPayload,
    @Body() body: { budgetCap: number; qualityTier?: string; escalationCap?: number },
  ) {
    return this.groups.create(session.sub, body);
  }

  @Get()
  list(@CurrentUser() session: SessionPayload) {
    return this.groups.list(session.sub);
  }
}

/**
 * تیکِ کارگر از **بیرونِ** پروسه می‌آید (قاعدهٔ ۱۱: هیچ `@Cron`ی داخلِ API).
 * روی سرور یک کرونِ سیستمی این را صدا می‌زند.
 */
@Controller('api/admin/jobs')
@UseGuards(AdminGuard)
export class JobsAdminController {
  constructor(private readonly jobs: JobsService) {}

  @Get('stats')
  stats() {
    return this.jobs.stats();
  }

  @Post('reclaim')
  reclaim(@Body() body: { olderThanMinutes?: number }) {
    return this.jobs.reclaimStale(body?.olderThanMinutes ?? 15);
  }

  @Post('claim')
  claim(@Body() body: { workerId: string }) {
    return this.jobs.claim(body?.workerId);
  }
}
