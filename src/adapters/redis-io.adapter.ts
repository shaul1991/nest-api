import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private pubClient: ReturnType<typeof createClient>;
  private subClient: ReturnType<typeof createClient>;

  constructor(
    app: INestApplication,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisHost = this.configService.get<string>('redis.host');
    const redisPort = this.configService.get<number>('redis.port');
    const redisPassword = this.configService.get<string>('redis.password');

    const redisUrl = redisPassword
      ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
      : `redis://${redisHost}:${redisPort}`;

    this.pubClient = createClient({ url: redisUrl });
    this.subClient = this.pubClient.duplicate();

    this.pubClient.on('error', (err) => {
      this.logger.error('Redis Pub client error', err);
    });

    this.subClient.on('error', (err) => {
      this.logger.error('Redis Sub client error', err);
    });

    await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log('Redis adapter connected');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const corsOrigin = this.configService.get<string>('CORS_ORIGIN');

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: corsOrigin?.split(',') || '*',
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6, // 1MB
    }) as Server;

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }

  async close(): Promise<void> {
    if (this.pubClient) {
      await this.pubClient.quit();
    }
    if (this.subClient) {
      await this.subClient.quit();
    }
  }
}
