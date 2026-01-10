import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ChatRedisService, GuestSession } from './chat-redis.service';
import { ParticipantType } from './interfaces/participant-type.enum';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn(),
    scard: jest.fn(),
    keys: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn().mockResolvedValue(1),
  }));
});

describe('ChatRedisService', () => {
  let service: ChatRedisService;
  let mockRedis: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        'redis.host': 'localhost',
        'redis.port': 6379,
        'redis.password': '',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatRedisService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ChatRedisService>(ChatRedisService);
    // Access the private redis instance for mocking
    mockRedis = (service as any).redis;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Guest Session Management', () => {
    const guestSession: GuestSession = {
      guestId: 'guest-uuid-1',
      nickname: 'Guest_abc12345',
      createdAt: new Date().toISOString(),
    };

    it('게스트 세션을 저장해야 함 (30일 TTL)', async () => {
      await service.setGuestSession('guest-uuid-1', guestSession);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chat:guest:guest-uuid-1',
        30 * 24 * 60 * 60,
        JSON.stringify(guestSession),
      );
    });

    it('게스트 세션을 조회해야 함', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(guestSession));

      const result = await service.getGuestSession('guest-uuid-1');

      expect(mockRedis.get).toHaveBeenCalledWith('chat:guest:guest-uuid-1');
      expect(result).toEqual(guestSession);
    });

    it('존재하지 않는 게스트 세션은 null을 반환해야 함', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getGuestSession('non-existent');

      expect(result).toBeNull();
    });

    it('게스트 닉네임을 업데이트해야 함', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(guestSession));

      await service.updateGuestNickname('guest-uuid-1', 'NewNickname');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chat:guest:guest-uuid-1',
        30 * 24 * 60 * 60,
        expect.stringContaining('NewNickname'),
      );
    });
  });

  describe('Online User Management', () => {
    it('온라인 사용자를 추가해야 함', async () => {
      await service.addOnlineUser('room-uuid-1', 'participant-uuid-1');

      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'chat:room:room-uuid-1:online',
        'participant-uuid-1',
      );
    });

    it('온라인 사용자를 제거해야 함', async () => {
      await service.removeOnlineUser('room-uuid-1', 'participant-uuid-1');

      expect(mockRedis.srem).toHaveBeenCalledWith(
        'chat:room:room-uuid-1:online',
        'participant-uuid-1',
      );
    });

    it('온라인 사용자 목록을 조회해야 함', async () => {
      const onlineUsers = ['participant-1', 'participant-2', 'participant-3'];
      mockRedis.smembers.mockResolvedValue(onlineUsers);

      const result = await service.getOnlineUsers('room-uuid-1');

      expect(mockRedis.smembers).toHaveBeenCalledWith(
        'chat:room:room-uuid-1:online',
      );
      expect(result).toEqual(onlineUsers);
    });

    it('온라인 사용자 수를 조회해야 함', async () => {
      mockRedis.scard.mockResolvedValue(5);

      const result = await service.getOnlineCount('room-uuid-1');

      expect(mockRedis.scard).toHaveBeenCalledWith(
        'chat:room:room-uuid-1:online',
      );
      expect(result).toBe(5);
    });
  });

  describe('Typing Status Management', () => {
    it('타이핑 상태를 설정해야 함 (3초 TTL)', async () => {
      await service.setTyping('room-uuid-1', 'participant-1', 'TestUser');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chat:room:room-uuid-1:typing:participant-1',
        3,
        'TestUser',
      );
    });

    it('타이핑 상태를 제거해야 함', async () => {
      await service.removeTyping('room-uuid-1', 'participant-1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'chat:room:room-uuid-1:typing:participant-1',
      );
    });

    it('타이핑 중인 사용자 목록을 조회해야 함', async () => {
      const typingKeys = [
        'chat:room:room-uuid-1:typing:participant-1',
        'chat:room:room-uuid-1:typing:participant-2',
      ];
      mockRedis.keys.mockResolvedValue(typingKeys);
      mockRedis.get
        .mockResolvedValueOnce('User1')
        .mockResolvedValueOnce('User2');

      const result = await service.getTypingUsers('room-uuid-1');

      expect(mockRedis.keys).toHaveBeenCalledWith(
        'chat:room:room-uuid-1:typing:*',
      );
      expect(result).toEqual(['User1', 'User2']);
    });

    it('타이핑 중인 사용자가 없으면 빈 배열을 반환해야 함', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await service.getTypingUsers('room-uuid-1');

      expect(result).toEqual([]);
    });
  });

  describe('Socket Connection Management', () => {
    const redisSocketData = {
      participantType: 'user' as const,
      userId: 'user-uuid-1',
      nickname: 'TestUser',
      isAuthenticated: true,
      currentRooms: ['room-1', 'room-2'],
    };

    it('소켓 연결 정보를 저장해야 함 (24시간 TTL)', async () => {
      await service.setSocketConnection('socket-id-1', redisSocketData);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chat:socket:socket-id-1',
        24 * 60 * 60,
        JSON.stringify(redisSocketData),
      );
    });

    it('소켓 연결 정보를 조회해야 함', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(redisSocketData));

      const result = await service.getSocketConnection('socket-id-1');

      expect(mockRedis.get).toHaveBeenCalledWith('chat:socket:socket-id-1');
      expect(result).toEqual({
        ...redisSocketData,
        participantType: ParticipantType.USER,
        currentRooms: new Set(['room-1', 'room-2']),
      });
    });

    it('소켓 연결 정보를 삭제해야 함', async () => {
      await service.deleteSocketConnection('socket-id-1');

      expect(mockRedis.del).toHaveBeenCalledWith('chat:socket:socket-id-1');
    });
  });

  describe('User Socket Mapping', () => {
    it('사용자 소켓 ID를 저장해야 함', async () => {
      await service.setUserSocket('user-uuid-1', 'socket-id-1');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chat:user:user-uuid-1:socket',
        24 * 60 * 60,
        'socket-id-1',
      );
    });

    it('사용자 소켓 ID를 조회해야 함', async () => {
      mockRedis.get.mockResolvedValue('socket-id-1');

      const result = await service.getUserSocket('user-uuid-1');

      expect(mockRedis.get).toHaveBeenCalledWith(
        'chat:user:user-uuid-1:socket',
      );
      expect(result).toBe('socket-id-1');
    });

    it('사용자 소켓 ID를 삭제해야 함', async () => {
      await service.deleteUserSocket('user-uuid-1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'chat:user:user-uuid-1:socket',
      );
    });
  });

  describe('Guest Socket Mapping', () => {
    it('게스트 소켓 ID를 저장해야 함', async () => {
      await service.setGuestSocket('guest-uuid-1', 'socket-id-1');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chat:guest:guest-uuid-1:socket',
        24 * 60 * 60,
        'socket-id-1',
      );
    });

    it('게스트 소켓 ID를 조회해야 함', async () => {
      mockRedis.get.mockResolvedValue('socket-id-1');

      const result = await service.getGuestSocket('guest-uuid-1');

      expect(mockRedis.get).toHaveBeenCalledWith(
        'chat:guest:guest-uuid-1:socket',
      );
      expect(result).toBe('socket-id-1');
    });

    it('게스트 소켓 ID를 삭제해야 함', async () => {
      await service.deleteGuestSocket('guest-uuid-1');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'chat:guest:guest-uuid-1:socket',
      );
    });
  });

  describe('Rate Limiting', () => {
    it('첫 번째 요청에서 TTL을 설정해야 함', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const result = await service.checkRateLimit('msg:user-1', 60, 60);

      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:msg:user-1');
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:msg:user-1', 60);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59);
    });

    it('제한 내에서는 요청을 허용해야 함', async () => {
      mockRedis.incr.mockResolvedValue(30);

      const result = await service.checkRateLimit('msg:user-1', 60, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(30);
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('제한을 초과하면 요청을 거부해야 함', async () => {
      mockRedis.incr.mockResolvedValue(61);

      const result = await service.checkRateLimit('msg:user-1', 60, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('정확히 제한에 도달하면 허용해야 함', async () => {
      mockRedis.incr.mockResolvedValue(60);

      const result = await service.checkRateLimit('msg:user-1', 60, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('게스트는 더 낮은 제한을 적용해야 함', async () => {
      mockRedis.incr.mockResolvedValue(21);

      const result = await service.checkRateLimit('msg:guest-1', 20, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Module Lifecycle', () => {
    it('모듈 종료 시 Redis 연결을 해제해야 함', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
