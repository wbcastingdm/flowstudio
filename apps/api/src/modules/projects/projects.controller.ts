import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionPayload } from '../auth/token.util';
import type { CampaignGoal, Tone } from '@prisma/client';

/**
 * ⛔ همهٔ مسیرها محافظت‌شده‌اند. تا اسپرینتِ ۳ پروژه‌ها به کاربرِ جای‌گیرِ
 * `+000000000000` می‌چسبیدند؛ آن جای‌گیر برداشته شد و هر پروژه به کاربرِ
 * واردشده تعلق می‌گیرد. کتابخانه فقط پروژه‌های خودِ همان کاربر را می‌بیند.
 */
@Controller('api/projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(
    @CurrentUser() session: SessionPayload,
    @Body()
    body: {
      rawIdea: string;
      goal: CampaignGoal;
      tone: Tone;
      targetDurationSec?: number;
    },
  ) {
    return this.projects.createFromIdea(session.sub, body);
  }

  @Get()
  list(@CurrentUser() session: SessionPayload) {
    return this.projects.list(session.sub);
  }

  @Get(':id')
  async findOne(@CurrentUser() session: SessionPayload, @Param('id') id: string) {
    const project = await this.projects.findOne(session.sub, id);
    // پروژهٔ کاربرِ دیگر هم «پیدا نشد» است، نه «اجازه نداری» — وجودِ شناسه لو نرود.
    if (!project) throw new NotFoundException('پروژه پیدا نشد.');
    return project;
  }
}
