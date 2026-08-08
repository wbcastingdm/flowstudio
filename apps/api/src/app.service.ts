import { Injectable } from '@nestjs/common';
import { PrismaService } from './common/prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * سلامتِ واقعی، نه یک 200 ثابت (گاردریلِ منشورِ اجرا: «HTTP 200 اثباتِ
   * تولید نیست»). یک SELECT 1 واقعی به دیتابیس زده می‌شود.
   */
  async checkHealth(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', database: 'connected' };
    } catch {
      return { status: 'unhealthy', database: 'disconnected' };
    }
  }
}
