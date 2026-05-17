import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
const helmet = require('helmet') as any;

async function bootstrap() {
  // Disable built-in body parser so we can set our own size limit (needed for logo uploads)
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Increase body size limit to 5 MB — required for base64-encoded logo images
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // Graceful shutdown
  app.enableShutdownHooks();

  // Security headers (XSS, clickjacking, MIME sniffing, etc.)
  app.use(helmet());

  // Global validation pipe — strips unknown fields, validates all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter — consistent error response format
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS — frontend origin only
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  // Swagger / OpenAPI — internal docs at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Exchange Manager API')
    .setDescription('Currency exchange management system — REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
