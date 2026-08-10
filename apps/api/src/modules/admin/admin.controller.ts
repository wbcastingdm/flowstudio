import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/admin.guard';

/** پنل راهبر — همه چیز پشت راز ادمین، fail-closed. */
@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  users(@Query('q') q?: string, @Query('take') take?: string) {
    return this.admin.users({ q, take: take ? Number(take) : undefined });
  }

  @Get('stats/production')
  production() {
    return this.admin.productionStats();
  }

  @Get('stats/consumption')
  consumption() {
    return this.admin.consumption();
  }

  @Get('stats/providers')
  providers(@Query('days') days?: string) {
    return this.admin.providerHealth(days ? Number(days) : 7);
  }

  @Get('ledger')
  ledger(@Query('userId') userId?: string, @Query('take') take?: string) {
    return this.admin.ledger({ userId, take: take ? Number(take) : undefined });
  }
}
