import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import type { CampaignGoal, Tone } from '@prisma/client';

@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  create(
    @Body()
    body: {
      rawIdea: string;
      goal: CampaignGoal;
      tone: Tone;
      targetDurationSec?: number;
    },
  ) {
    return this.projects.createFromIdea(body);
  }

  @Get()
  list() {
    return this.projects.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }
}
