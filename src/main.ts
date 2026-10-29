import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { ConfigValidationService } from './config/config-validation.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configValidation = app.get(ConfigValidationService);
  await configValidation.validateConfig();
  await configValidation.initDirectories();

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
  process.exit(1);
});
