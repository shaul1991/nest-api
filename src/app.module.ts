import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { createKeyv } from '@keyv/redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { FilesModule } from './files/files.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { validate } from './config/env.validation';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import authConfig from './config/auth.config';
import storageConfig from './config/storage.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [databaseConfig, redisConfig, authConfig, storageConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.user'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'local',
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('redis.host');
        const redisPort = configService.get<number>('redis.port');
        const redisPassword = configService.get<string>('redis.password');
        const redisUrl = redisPassword
          ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
          : `redis://${redisHost}:${redisPort}`;

        return {
          stores: [createKeyv(redisUrl)],
        };
      },
      inject: [ConfigService],
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    ChatModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
