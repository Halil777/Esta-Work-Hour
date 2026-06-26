// Set timezone BEFORE any other imports so new Date() uses local time
process.env.TZ = process.env.TZ || 'Asia/Ashgabat';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Name', 'X-Admin-Token'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api  [TZ=${process.env.TZ}]`);
}
bootstrap();
