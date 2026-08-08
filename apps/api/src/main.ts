import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // فقط برایِ توسعهٔ لوکال — پنلِ ادمین (apps/web) از originِ دیگری صدا می‌زند.
  app.enableCors();
  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`FlowStudio API listening on :${port}`);
}
bootstrap();
