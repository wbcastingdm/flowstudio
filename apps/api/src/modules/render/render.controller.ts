import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RenderService } from './render.service';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionPayload } from '../auth/token.util';

/**
 * صف‌کردنِ تولید و دیدنِ وضعیتش.
 *
 * ⚠️ این‌جا هیچ کاری **اجرا** نمی‌شود — فقط پلان ساخته و در صف گذاشته
 * می‌شود. اجرا کارِ پروسهٔ کارگر است (قاعدهٔ ۱۱: هیچ حلقهٔ اجرایی داخلِ API).
 */
@Controller('api/projects')
@UseGuards(AuthGuard)
export class RenderController {
  constructor(private readonly render: RenderService) {}

  @Post(':id/render')
  enqueue(
    @CurrentUser() session: SessionPayload,
    @Param('id') id: string,
    @Body() body: { budgetCap?: number },
  ) {
    return this.render.enqueueProject(session.sub, id, { budgetCap: body?.budgetCap });
  }

  /** صفحهٔ زنده هر چند ثانیه همین را می‌پرسد. `null` یعنی هنوز صف نشده. */
  @Get(':id/render')
  latest(@CurrentUser() session: SessionPayload, @Param('id') id: string) {
    return this.render.latestForProject(session.sub, id);
  }
}
