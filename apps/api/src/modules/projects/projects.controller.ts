import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService, type CreateFromIdeaInput } from './projects.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionPayload } from '../auth/token.util';

/**
 * ⛔ همه مسیرها محافظت‌شده‌اند. هر پروژه به کاربر واردشده تعلق دارد و آرشیو
 * رسانه فقط کار خود همان کاربر را نشان می‌دهد.
 */
@Controller('api/projects')
@UseGuards(AuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() session: SessionPayload, @Body() body: CreateFromIdeaInput) {
    return this.projects.createFromIdea(session.sub, body);
  }

  @Get()
  list(@CurrentUser() session: SessionPayload) {
    return this.projects.list(session.sub);
  }

  @Get(':id')
  async findOne(@CurrentUser() session: SessionPayload, @Param('id') id: string) {
    const project = await this.projects.findOne(session.sub, id);
    // پروژه کاربر دیگر هم «پیدا نشد» است، نه «اجازه نداری» — وجود شناسه لو نرود.
    if (!project) throw new NotFoundException('پروژه پیدا نشد.');
    return project;
  }

  /** ویرایش کارگردانی یک نما — پذیرش یا تغییر پیشنهاد ماشین. */
  @Patch('shots/:shotId/direction')
  updateDirection(
    @CurrentUser() session: SessionPayload,
    @Param('shotId') shotId: string,
    @Body() body: Record<string, string | null>,
  ) {
    return this.projects.updateDirection(session.sub, shotId, body);
  }
}
