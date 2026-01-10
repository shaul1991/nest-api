import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface GuestSession {
  guestId: string;
  nickname: string;
  createdAt: string;
}

export interface SocketData {
  participantType: 'user' | 'guest';
  userId?: string;
  guestId?: string;
  nickname: string;
  profileImage?: string;
  isAuthenticated: boolean;
  currentRooms: string[];
}

@Injectable()
export class ChatRedisService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatRedisService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
    });

    this.redis.on('connect', () => {
      this.logger.log('ChatRedisService connected to Redis');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis connection error', err);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  // 게스트 세션 관리 (30일 유효)
  async setGuestSession(guestId: string, data: GuestSession): Promise<void> {
    await this.redis.setex(
      `chat:guest:${guestId}`,
      30 * 24 * 60 * 60, // 30 days
      JSON.stringify(data),
    );
  }

  async getGuestSession(guestId: string): Promise<GuestSession | null> {
    const data = await this.redis.get(`chat:guest:${guestId}`);
    return data ? (JSON.parse(data) as GuestSession) : null;
  }

  async updateGuestNickname(guestId: string, nickname: string): Promise<void> {
    const session = await this.getGuestSession(guestId);
    if (session) {
      session.nickname = nickname;
      await this.setGuestSession(guestId, session);
    }
  }

  // 온라인 사용자 관리
  async addOnlineUser(roomId: string, participantId: string): Promise<void> {
    await this.redis.sadd(`chat:room:${roomId}:online`, participantId);
  }

  async removeOnlineUser(roomId: string, participantId: string): Promise<void> {
    await this.redis.srem(`chat:room:${roomId}:online`, participantId);
  }

  async getOnlineUsers(roomId: string): Promise<string[]> {
    return this.redis.smembers(`chat:room:${roomId}:online`);
  }

  async getOnlineCount(roomId: string): Promise<number> {
    return this.redis.scard(`chat:room:${roomId}:online`);
  }

  // 타이핑 상태 (3초 TTL)
  async setTyping(
    roomId: string,
    participantId: string,
    nickname: string,
  ): Promise<void> {
    await this.redis.setex(
      `chat:room:${roomId}:typing:${participantId}`,
      3,
      nickname,
    );
  }

  async removeTyping(roomId: string, participantId: string): Promise<void> {
    await this.redis.del(`chat:room:${roomId}:typing:${participantId}`);
  }

  async getTypingUsers(roomId: string): Promise<string[]> {
    const keys = await this.redis.keys(`chat:room:${roomId}:typing:*`);
    if (keys.length === 0) return [];

    const nicknames: string[] = [];
    for (const key of keys) {
      const nickname = await this.redis.get(key);
      if (nickname) nicknames.push(nickname);
    }
    return nicknames;
  }

  // 소켓 연결 정보 (24시간)
  async setSocketConnection(socketId: string, data: SocketData): Promise<void> {
    await this.redis.setex(
      `chat:socket:${socketId}`,
      24 * 60 * 60,
      JSON.stringify(data),
    );
  }

  async getSocketConnection(socketId: string): Promise<SocketData | null> {
    const data = await this.redis.get(`chat:socket:${socketId}`);
    return data ? (JSON.parse(data) as SocketData) : null;
  }

  async deleteSocketConnection(socketId: string): Promise<void> {
    await this.redis.del(`chat:socket:${socketId}`);
  }

  // 사용자의 소켓 ID 매핑
  async setUserSocket(userId: string, socketId: string): Promise<void> {
    await this.redis.setex(
      `chat:user:${userId}:socket`,
      24 * 60 * 60,
      socketId,
    );
  }

  async getUserSocket(userId: string): Promise<string | null> {
    return this.redis.get(`chat:user:${userId}:socket`);
  }

  async deleteUserSocket(userId: string): Promise<void> {
    await this.redis.del(`chat:user:${userId}:socket`);
  }

  // 게스트의 소켓 ID 매핑
  async setGuestSocket(guestId: string, socketId: string): Promise<void> {
    await this.redis.setex(
      `chat:guest:${guestId}:socket`,
      24 * 60 * 60,
      socketId,
    );
  }

  async getGuestSocket(guestId: string): Promise<string | null> {
    return this.redis.get(`chat:guest:${guestId}:socket`);
  }

  async deleteGuestSocket(guestId: string): Promise<void> {
    await this.redis.del(`chat:guest:${guestId}:socket`);
  }

  // Rate limiting
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const current = await this.redis.incr(`ratelimit:${key}`);
    if (current === 1) {
      await this.redis.expire(`ratelimit:${key}`, windowSeconds);
    }
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
    };
  }
}
