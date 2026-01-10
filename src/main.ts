import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // WebSocket 호환성을 위해
    }),
  );

  // Cookie parser
  app.use(cookieParser());

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

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
    setupSwagger(app);
    logger.log('Swagger documentation available at /api-docs');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`WebSocket available at: ws://localhost:${port}/chat`);
}

void bootstrap();
