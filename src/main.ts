import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { RedisIoAdapter } from './adapters/redis-io.adapter';
import { SanitizePipe } from './common/pipes/sanitize.pipe';
import { SecurityLoggingInterceptor } from './common/interceptors/security-logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createCorsOptions } from './config/cors.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware (SEC-MVP-001)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'wss:', 'ws:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // WebSocket 호환성
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Cookie parser with secure options
  app.use(cookieParser(configService.get<string>('auth.jwt.secret')));

  // Global Pipes (SEC-MVP-002: Sanitization + Validation)
  app.useGlobalPipes(
    new SanitizePipe(), // XSS 방지
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Global Interceptors (SEC-MVP-003: Security Logging)
  app.useGlobalInterceptors(new SecurityLoggingInterceptor());

  // Global Exception Filter (BE-MVP-005: 일관된 에러 응답)
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS (SEC-MVP-004: Enhanced CORS configuration)
  app.enableCors(createCorsOptions());

  // Redis WebSocket Adapter (production에서만 사용)
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv === 'development') {
    try {
      const redisIoAdapter = new RedisIoAdapter(app, configService);
      await redisIoAdapter.connectToRedis();
      app.useWebSocketAdapter(redisIoAdapter);
      logger.log('Redis WebSocket adapter connected');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Redis adapter failed, using default: ${errorMessage}`);
    }
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  // Swagger (development only)
  if (nodeEnv !== 'production') {
    // Add no-cache headers for Swagger assets to prevent CDN caching issues
    app.use('/api-docs', (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });
    setupSwagger(app);
    logger.log('Swagger documentation available at /api-docs');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`WebSocket available at: ws://localhost:${port}/chat`);
}

void bootstrap();
