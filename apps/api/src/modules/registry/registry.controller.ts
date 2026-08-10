import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { RegistryService } from './registry.service';
import { AdminGuard } from '../auth/admin.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { PublicationTarget } from '@prisma/client';

/**
 * خواندنی و عمومی — فرم استودیو پیش از ورود هم باید بتواند نوع‌ها و سطوح را
 * نشان دهد. هیچ داده خصوصی‌ای این‌جا نیست.
 */
@Controller('api/registry')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  @Get('production-types')
  types() {
    return this.registry.listProductionTypes();
  }

  @Get('service-tiers')
  tiers() {
    return this.registry.listServiceTiers();
  }

  @Get('catalog')
  catalog(
    @Query('kind') kind?: string,
    @Query('genre') genre?: string,
    @Query('target') target?: PublicationTarget,
  ) {
    return this.registry.listCatalog({ kind, genre, target });
  }
}

/** نوشتنی — فقط راهبر. */
@Controller('api/admin/registry')
@UseGuards(AdminGuard)
export class RegistryAdminController {
  constructor(
    private readonly registry: RegistryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('production-types')
  types() {
    return this.registry.listProductionTypes(true);
  }

  @Get('service-tiers')
  tiers() {
    return this.registry.listServiceTiers(true);
  }

  @Get('licenses')
  licenses() {
    return this.registry.listLicenses();
  }

  /** روشن و خاموش کردن یک نوع تولید — یک تنظیم، نه یک استقرار. */
  @Patch('production-types/:key')
  toggleType(@Param('key') key: string, @Body() body: { isActive?: boolean; orderIndex?: number }) {
    return this.prisma.productionType.update({
      where: { key },
      data: {
        ...(body.isActive != null ? { isActive: body.isActive } : {}),
        ...(body.orderIndex != null ? { orderIndex: body.orderIndex } : {}),
      },
    });
  }

  /** تنظیم سطح خدمت، از جمله قیمتی که تا امروز عمدا خالی مانده. */
  @Patch('service-tiers/:key')
  updateTier(
    @Param('key') key: string,
    @Body()
    body: {
      priceIrt?: number | null;
      coinAllowance?: number;
      maxDurationSec?: number;
      maxCostPerUnit?: number | null;
      isActive?: boolean;
    },
  ) {
    return this.prisma.serviceTier.update({ where: { key }, data: { ...body } });
  }
}
