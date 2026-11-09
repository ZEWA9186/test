import * as dotenv from 'dotenv';
import * as path from 'node:path';

const envPath =
  process.env.NODE_ENV === 'production'
    ? path.join(path.dirname(process.execPath), '.env')
    : path.resolve(process.cwd(), '.env');

dotenv.config({ path: envPath });

import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { ConfigValidationService } from './config/config-validation.service';

async function bootstrap() {
  const configValidation = new ConfigValidationService();

  try {
    await configValidation.validateConfig();
  } catch {
    process.exitCode = 1;
    return;
  }

  await configValidation.initDirectories();
  const { AppModule } = await import('./app.module');

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  await app.listen(process.env.PORT ?? 4001);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
