import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * پنل راهبر — لایه گزارش.
 *
 * 🔑 نکته: این ماژول **هیچ داده تازه‌ای نمی‌سازد**. هر عددی که نشان می‌دهد
 * از قبل در پایگاه داده ثبت شده بود و فقط خوانده نمی‌شد. برای همین افزودنش
 * ارزان بود و برای همین هم هیچ‌وقت نباید اینجا محاسبه‌ای انجام شود که در
 * جای دیگری هم انجام می‌شود — دو منبع حقیقت یعنی دو عدد متفاوت.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** خلاصه بالای داشبورد — همان چیزی که با یک نگاه باید معلوم باشد. */
  async overview() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      users,
      newUsers7d,
      projects,
      projects7d,
      shots,
      assets,
      wallets,
      jobs,
      calls24h,
      failedCalls24h,
      pendingReviews,
      activeHolds,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since7d } } }),
      this.prisma.project.count(),
      this.prisma.project.count({ where: { createdAt: { gte: since7d } } }),
      this.prisma.shot.count(),
      this.prisma.asset.count(),
      this.prisma.wallet.aggregate({ _sum: { balance: true, held: true } }),
      this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.providerCall.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.providerCall.count({ where: { createdAt: { gte: since24h }, ok: false } }),
      this.prisma.complianceCheck.count({ where: { status: { in: ['PENDING', 'AUTO_FLAGGED'] } } }),
      this.prisma.walletHold.aggregate({ where: { status: 'HELD' }, _sum: { amount: true } }),
    ]);

    const jobCounts: Record<string, number> = { PENDING: 0, RUNNING: 0, DONE: 0, FAILED: 0 };
    for (const j of jobs) jobCounts[j.status] = j._count._all;

    // مصرف واقعی از دفتر می‌آید، نه از جمع زدن دستی — دفتر منبع حقیقت است.
    const spent = await this.prisma.walletEntry.aggregate({
      where: { type: 'SETTLE' },
      _sum: { amount: true },
    });

    return {
      users: { total: users, new7d: newUsers7d },
      projects: { total: projects, new7d: projects7d, shots },
      assets,
      wallet: {
        balance: wallets._sum.balance ?? 0,
        held: wallets._sum.held ?? 0,
        activeHolds: activeHolds._sum.amount ?? 0,
        totalSpent: spent._sum.amount ?? 0,
      },
      jobs: jobCounts,
      providerCalls24h: {
        total: calls24h,
        failed: failedCalls24h,
        errorRate: calls24h > 0 ? Math.round((failedCalls24h / calls24h) * 1000) / 10 : null,
      },
      pendingReviews,
    };
  }

  /**
   * فهرست کاربران با آنچه راهبر واقعا لازم دارد.
   *
   * شماره تلفن کامل نشان داده می‌شود چون راهبر باید بتواند پشتیبانی کند —
   * ولی این مسیر پشت قفل پنل است و در هیچ پاسخ عمومی‌ای نمی‌آید.
   */
  async users(opts: { q?: string; take?: number } = {}) {
    const take = Math.min(200, Math.max(1, opts.take ?? 50));
    const rows = await this.prisma.user.findMany({
      where: opts.q ? { phone: { contains: opts.q.trim() } } : {},
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        phone: true,
        createdAt: true,
        wallet: { select: { balance: true, held: true } },
        _count: { select: { projects: true, assets: true } },
        projects: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, serviceTier: { select: { title: true } } },
        },
      },
    });

    return rows.map((u) => ({
      id: u.id,
      phone: u.phone,
      joinedAt: u.createdAt,
      balance: u.wallet?.balance ?? 0,
      held: u.wallet?.held ?? 0,
      projectCount: u._count.projects,
      assetCount: u._count.assets,
      lastActivityAt: u.projects[0]?.createdAt ?? u.createdAt,
      lastTier: u.projects[0]?.serviceTier?.title ?? null,
    }));
  }

  /** آمار تولید — چند اثر، چه نوعی، با چه سطحی، با چه جنس تصویری. */
  async productionStats() {
    const [byType, byTier, byMaterial, jobs, shotAgg] = await Promise.all([
      this.prisma.project.groupBy({ by: ['productionTypeId'], _count: { _all: true } }),
      this.prisma.project.groupBy({ by: ['serviceTierId'], _count: { _all: true } }),
      this.prisma.project.groupBy({ by: ['materialStyle'], _count: { _all: true } }),
      this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.shot.aggregate({ _avg: { durationSec: true }, _sum: { durationSec: true } }),
    ]);

    const [types, tiers] = await Promise.all([
      this.prisma.productionType.findMany({ select: { id: true, title: true } }),
      this.prisma.serviceTier.findMany({ select: { id: true, title: true } }),
    ]);
    const typeName = new Map(types.map((t) => [t.id, t.title]));
    const tierName = new Map(tiers.map((t) => [t.id, t.title]));

    const done = jobs.find((j) => j.status === 'DONE')?._count._all ?? 0;
    const failed = jobs.find((j) => j.status === 'FAILED')?._count._all ?? 0;
    const finished = done + failed;

    return {
      byType: byType.map((r) => ({
        label: r.productionTypeId ? (typeName.get(r.productionTypeId) ?? 'ناشناخته') : 'بدون نوع',
        count: r._count._all,
      })),
      byTier: byTier.map((r) => ({
        label: r.serviceTierId ? (tierName.get(r.serviceTierId) ?? 'ناشناخته') : 'بدون سطح',
        count: r._count._all,
      })),
      byMaterial: byMaterial.map((r) => ({
        label: r.materialStyle ?? 'تعیین‌نشده',
        count: r._count._all,
      })),
      // نرخ موفقیت فقط روی کارهای **تمام‌شده** معنا دارد؛ کار در صف هنوز
      // نه موفق است نه ناموفق. اگر مخرج را کل کارها بگیریم، عدد دروغ می‌شود.
      successRate: finished > 0 ? Math.round((done / finished) * 1000) / 10 : null,
      finishedJobs: finished,
      avgShotDurationSec: shotAgg._avg.durationSec
        ? Math.round(shotAgg._avg.durationSec * 10) / 10
        : null,
      totalShotSeconds: shotAgg._sum.durationSec ?? 0,
    };
  }

  /** مصرف و هزینه — به تفکیک کاربر و نوع تولید. */
  async consumption() {
    const settles = await this.prisma.walletEntry.findMany({
      where: { type: 'SETTLE' },
      select: { amount: true, wallet: { select: { user: { select: { id: true, phone: true } } } } },
    });

    const perUser = new Map<string, { phone: string; coins: number; count: number }>();
    for (const s of settles) {
      const u = s.wallet.user;
      const row = perUser.get(u.id) ?? { phone: u.phone, coins: 0, count: 0 };
      row.coins += s.amount;
      row.count += 1;
      perUser.set(u.id, row);
    }

    const byModel = await this.prisma.providerCall.groupBy({
      by: ['modelId'],
      _count: { _all: true },
      _avg: { latencyMs: true },
    });
    const models = await this.prisma.aiModel.findMany({
      select: { id: true, modelKey: true, costPerUnit: true, provider: { select: { name: true } } },
    });
    const modelInfo = new Map(models.map((m) => [m.id, m]));

    return {
      topUsers: [...perUser.entries()]
        .map(([id, r]) => ({ id, ...r }))
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 20),
      byModel: byModel
        .map((r) => {
          const m = r.modelId ? modelInfo.get(r.modelId) : null;
          return {
            model: m?.modelKey ?? 'ناشناخته',
            provider: m?.provider.name ?? '—',
            calls: r._count._all,
            avgLatencyMs: r._avg.latencyMs ? Math.round(r._avg.latencyMs) : null,
            costPerUnit: m?.costPerUnit ?? null,
          };
        })
        .sort((a, b) => b.calls - a.calls),
    };
  }

  /**
   * سلامت درگاه‌ها — نرخ خطا و زمان پاسخ.
   *
   * این همان عددی است که باید مبنای انتخاب باشد، نه ادعای فروشنده.
   */
  async providerHealth(days = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [grouped, providers] = await Promise.all([
      this.prisma.providerCall.groupBy({
        by: ['providerId', 'ok'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _avg: { latencyMs: true },
      }),
      this.prisma.aiProvider.findMany({ select: { id: true, name: true, baseUrl: true } }),
    ]);

    const errorKinds = await this.prisma.providerCall.groupBy({
      by: ['providerId', 'errorKind'],
      where: { createdAt: { gte: since }, ok: false },
      _count: { _all: true },
    });

    return providers.map((p) => {
      const ok = grouped.find((g) => g.providerId === p.id && g.ok);
      const bad = grouped.find((g) => g.providerId === p.id && !g.ok);
      const okCount = ok?._count._all ?? 0;
      const badCount = bad?._count._all ?? 0;
      const total = okCount + badCount;
      return {
        id: p.id,
        name: p.name,
        host: (() => {
          try {
            return new URL(p.baseUrl).host;
          } catch {
            return p.baseUrl;
          }
        })(),
        calls: total,
        failed: badCount,
        errorRate: total > 0 ? Math.round((badCount / total) * 1000) / 10 : null,
        avgLatencyMs: ok?._avg.latencyMs ? Math.round(ok._avg.latencyMs) : null,
        errorKinds: errorKinds
          .filter((e) => e.providerId === p.id)
          .map((e) => ({ kind: e.errorKind ?? 'unknown', count: e._count._all })),
      };
    });
  }

  /** دفتر سکه — تراکنش‌های اخیر همه کاربران. */
  async ledger(opts: { userId?: string; take?: number } = {}) {
    const take = Math.min(200, Math.max(1, opts.take ?? 60));
    const rows = await this.prisma.walletEntry.findMany({
      where: opts.userId ? { wallet: { userId: opts.userId } } : {},
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        heldAfter: true,
        note: true,
        createdAt: true,
        wallet: { select: { user: { select: { phone: true } } } },
        hold: { select: { purpose: true, status: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      balanceAfter: r.balanceAfter,
      heldAfter: r.heldAfter,
      note: r.note,
      purpose: r.hold?.purpose ?? null,
      holdStatus: r.hold?.status ?? null,
      phone: r.wallet.user.phone,
      createdAt: r.createdAt,
    }));
  }
}
