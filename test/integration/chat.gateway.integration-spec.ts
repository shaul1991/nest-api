import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { CacheModule } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { io, Socket as ClientSocket } from 'socket.io-client';
import * as bcrypt from 'bcrypt';
import { ChatModule } from '../../src/chat/chat.module';
import { UsersModule } from '../../src/users/users.module';
import { AuthModule } from '../../src/auth/auth.module';
import { ChatRoom } from '../../src/chat/entities/chat-room.entity';
import { ChatMessage } from '../../src/chat/entities/chat-message.entity';
import { ChatParticipant } from '../../src/chat/entities/chat-participant.entity';
import { User } from '../../src/users/entities/user.entity';
import { Role } from '../../src/users/entities/role.entity';
import { Permission } from '../../src/users/entities/permission.entity';
import { RoomType } from '../../src/chat/interfaces/participant-type.enum';
import { RoleType } from '../../src/users/enums/role.enum';

describe('Chat Gateway (Integration)', () => {
  let app: INestApplication;
  let roomRepository: any;
  let userRepository: any;
  let roleRepository: any;
  let participantRepository: any;
  let jwtService: JwtService;
  let configService: ConfigService;
  let port: number;

  const testUser = {
    email: 'wsuser@example.com',
    password: 'Password123!',
    firstName: 'WebSocket',
    lastName: 'User',
  };

  const createMockUser = async (overrides = {}): Promise<User> => {
    let defaultRole = await roleRepository.findOne({
      where: { name: RoleType.USER },
    });

    if (!defaultRole) {
      defaultRole = roleRepository.create({
        name: RoleType.USER,
        description: 'Default user role',
      });
      await roleRepository.save(defaultRole);
    }

    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = userRepository.create({
      ...testUser,
      password: hashedPassword,
      roles: [defaultRole],
      ...overrides,
    });
    return userRepository.save(user);
  };

  const generateAccessToken = (user: User): string => {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roleNames || [],
      permissions: user.permissions || [],
      type: 'access',
    };
    return jwtService.sign(payload, {
      secret: configService.get<string>('auth.jwt.secret'),
      expiresIn: '15m',
    });
  };

  const createClientSocket = (token?: string, guestId?: string): ClientSocket => {
    const extraHeaders: Record<string, string> = {};
    if (token) {
      extraHeaders['authorization'] = `Bearer ${token}`;
    }
    if (guestId) {
      extraHeaders['cookie'] = `guest_id=${guestId}`;
    }

    return io(`http://localhost:${port}/chat`, {
      transports: ['websocket'],
      auth: token ? { token: `Bearer ${token}` } : undefined,
      extraHeaders,
    });
  };

  const waitForEvent = <T>(socket: ClientSocket, event: string, timeout = 5000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              database: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432', 10),
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'postgres',
                name: process.env.DB_NAME || 'nest_api_test',
              },
              redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                password: process.env.REDIS_PASSWORD || '',
              },
              auth: {
                jwt: {
                  secret: process.env.JWT_SECRET || 'test-jwt-secret-key',
                },
                jwtRefresh: {
                  secret: process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key',
                },
                bcrypt: {
                  saltRounds: 10,
                },
              },
            }),
          ],
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
            entities: [User, Role, Permission, ChatRoom, ChatMessage, ChatParticipant],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        CacheModule.register({
          isGlobal: true,
          ttl: 60000,
        }),
        ChatModule,
        UsersModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 랜덤 포트로 시작
    port = 3100 + Math.floor(Math.random() * 1000);
    await app.listen(port);

    roomRepository = moduleFixture.get(getRepositoryToken(ChatRoom));
    userRepository = moduleFixture.get(getRepositoryToken(User));
    roleRepository = moduleFixture.get(getRepositoryToken(Role));
    participantRepository = moduleFixture.get(getRepositoryToken(ChatParticipant));
    jwtService = moduleFixture.get(JwtService);
    configService = moduleFixture.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await participantRepository.query('DELETE FROM chat_participants');
    await roomRepository.query('DELETE FROM chat_messages');
    await roomRepository.query('DELETE FROM chat_rooms');
    await userRepository.query('DELETE FROM user_roles');
    await userRepository.query('DELETE FROM users');
    await roleRepository.query('DELETE FROM roles');
  });

  describe('Connection', () => {
    it('인증된 사용자가 WebSocket에 연결할 수 있어야 함', async () => {
      const user = await createMockUser();
      const token = generateAccessToken(user);
      const client = createClientSocket(token);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          expect(client.connected).toBe(true);
          client.disconnect();
          resolve();
        });

        client.on('connect_error', (err) => {
          client.disconnect();
          reject(err);
        });
      });
    });

    it('게스트가 WebSocket에 연결할 수 있어야 함', async () => {
      const client = createClientSocket(undefined, 'test-guest-uuid');

      const guestIdEvent = waitForEvent<{ guestId: string }>(client, 'set_guest_id');

      await new Promise<void>((resolve, reject) => {
        client.on('connect', async () => {
          expect(client.connected).toBe(true);

          // 게스트 ID가 발급되어야 함
          const data = await guestIdEvent;
          expect(data.guestId).toBeTruthy();

          client.disconnect();
          resolve();
        });

        client.on('connect_error', (err) => {
          client.disconnect();
          reject(err);
        });
      });
    });

    it('잘못된 토큰으로 연결 시 에러가 발생해야 함', async () => {
      const client = createClientSocket('invalid-token');

      await new Promise<void>((resolve) => {
        client.on('error', (error) => {
          expect(error.code).toBe('INVALID_TOKEN');
          client.disconnect();
          resolve();
        });

        client.on('disconnect', () => {
          resolve();
        });
      });
    });
  });

  describe('Room Events', () => {
    let testRoom: ChatRoom;
    let user: User;
    let token: string;

    beforeEach(async () => {
      user = await createMockUser();
      token = generateAccessToken(user);

      testRoom = roomRepository.create({
        name: 'Test Room',
        type: RoomType.PUBLIC,
        maxParticipants: 100,
        isActive: true,
        createdBy: user,
      });
      await roomRepository.save(testRoom);
    });

    it('인증된 사용자가 방에 입장할 수 있어야 함', async () => {
      const client = createClientSocket(token);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          client.emit('join_room', {
            roomId: testRoom.id,
            nickname: 'TestUser',
          });
        });

        client.on('room_joined', (data) => {
          expect(data.roomId).toBe(testRoom.id);
          expect(data.participant.nickname).toBe('TestUser');
          client.disconnect();
          resolve();
        });

        client.on('error', (err) => {
          client.disconnect();
          reject(new Error(err.message));
        });
      });
    });

    it('게스트가 방에 입장할 수 있어야 함', async () => {
      const guestId = 'guest-join-test';
      const client = createClientSocket(undefined, guestId);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          client.emit('join_room', {
            roomId: testRoom.id,
            nickname: 'GuestUser',
          });
        });

        client.on('room_joined', (data) => {
          expect(data.roomId).toBe(testRoom.id);
          expect(data.participant.nickname).toBe('GuestUser');
          expect(data.participant.isAuthenticated).toBe(false);
          client.disconnect();
          resolve();
        });

        client.on('error', (err) => {
          client.disconnect();
          reject(new Error(err.message));
        });
      });
    });

    it('다른 사용자가 입장하면 알림을 받아야 함', async () => {
      const client1 = createClientSocket(token);
      const user2 = await createMockUser({ email: 'user2@example.com' });
      const token2 = generateAccessToken(user2);
      const client2 = createClientSocket(token2);

      await new Promise<void>((resolve, reject) => {
        let client1Joined = false;

        client1.on('connect', () => {
          client1.emit('join_room', {
            roomId: testRoom.id,
            nickname: 'User1',
          });
        });

        client1.on('room_joined', () => {
          client1Joined = true;
          // 첫 번째 사용자가 입장한 후 두 번째 사용자 입장
          client2.connect();
        });

        client2.on('connect', () => {
          client2.emit('join_room', {
            roomId: testRoom.id,
            nickname: 'User2',
          });
        });

        client1.on('user_joined', (data) => {
          if (client1Joined) {
            expect(data.roomId).toBe(testRoom.id);
            expect(data.participant.nickname).toBe('User2');
            client1.disconnect();
            client2.disconnect();
            resolve();
          }
        });

        setTimeout(() => {
          client1.disconnect();
          client2.disconnect();
          reject(new Error('Timeout: user_joined event not received'));
        }, 5000);
      });
    });

    it('방을 나가면 다른 사용자에게 알림이 가야 함', async () => {
      const client1 = createClientSocket(token);
      const user2 = await createMockUser({ email: 'user3@example.com' });
      const token2 = generateAccessToken(user2);
      const client2 = createClientSocket(token2);

      await new Promise<void>((resolve, reject) => {
        let bothJoined = false;

        client1.on('connect', () => {
          client1.emit('join_room', {
            roomId: testRoom.id,
            nickname: 'User1',
          });
        });

        client1.on('room_joined', () => {
          client2.connect();
        });

        client2.on('connect', () => {
          client2.emit('join_room', {
            roomId: testRoom.id,
            nickname: 'User2',
          });
        });

        client2.on('room_joined', () => {
          bothJoined = true;
          // 두 번째 사용자가 방을 나감
          client2.emit('leave_room', { roomId: testRoom.id });
        });

        client1.on('user_left', (data) => {
          if (bothJoined) {
            expect(data.roomId).toBe(testRoom.id);
            expect(data.nickname).toBe('User2');
            client1.disconnect();
            client2.disconnect();
            resolve();
          }
        });

        setTimeout(() => {
          client1.disconnect();
          client2.disconnect();
          reject(new Error('Timeout: user_left event not received'));
        }, 5000);
      });
    });
  });

  describe('Message Events', () => {
    let testRoom: ChatRoom;
    let user: User;
    let token: string;

    beforeEach(async () => {
      user = await createMockUser();
      token = generateAccessToken(user);

      testRoom = roomRepository.create({
        name: 'Message Test Room',
        type: RoomType.PUBLIC,
        maxParticipants: 100,
        isActive: true,
        createdBy: user,
      });
      await roomRepository.save(testRoom);
    });

    it('메시지를 전송하면 방의 모든 사용자에게 브로드캐스트되어야 함', async () => {
      const client1 = createClientSocket(token);
      const user2 = await createMockUser({ email: 'msguser@example.com' });
      const token2 = generateAccessToken(user2);
      const client2 = createClientSocket(token2);

      await new Promise<void>((resolve, reject) => {
        let bothJoined = 0;

        const onConnect = (client: ClientSocket, nickname: string) => {
          client.emit('join_room', {
            roomId: testRoom.id,
            nickname,
          });
        };

        client1.on('connect', () => onConnect(client1, 'User1'));
        client2.on('connect', () => onConnect(client2, 'User2'));

        const onJoined = () => {
          bothJoined++;
          if (bothJoined === 2) {
            // 두 명 모두 입장 후 메시지 전송
            client1.emit('send_message', {
              roomId: testRoom.id,
              content: 'Hello, World!',
            });
          }
        };

        client1.on('room_joined', onJoined);
        client2.on('room_joined', onJoined);

        // 두 클라이언트 모두 메시지를 받아야 함
        let messagesReceived = 0;
        const onMessage = (data: any) => {
          expect(data.content).toBe('Hello, World!');
          expect(data.sender.nickname).toBe('User1');
          messagesReceived++;

          if (messagesReceived === 2) {
            client1.disconnect();
            client2.disconnect();
            resolve();
          }
        };

        client1.on('message', onMessage);
        client2.on('message', onMessage);

        setTimeout(() => {
          client1.disconnect();
          client2.disconnect();
          reject(new Error('Timeout: message event not received'));
        }, 5000);
      });
    });

    it('참가하지 않은 방에 메시지 전송 시 에러가 발생해야 함', async () => {
      const client = createClientSocket(token);

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          // 방에 입장하지 않고 메시지 전송 시도
          client.emit('send_message', {
            roomId: testRoom.id,
            content: 'Unauthorized message',
          });
        });

        client.on('error', (error) => {
          expect(error.code).toBe('SEND_FAILED');
          client.disconnect();
          resolve();
        });
      });
    });
  });

  describe('Typing Events', () => {
    let testRoom: ChatRoom;
    let user: User;
    let token: string;

    beforeEach(async () => {
      user = await createMockUser();
      token = generateAccessToken(user);

      testRoom = roomRepository.create({
        name: 'Typing Test Room',
        type: RoomType.PUBLIC,
        maxParticipants: 100,
        isActive: true,
        createdBy: user,
      });
      await roomRepository.save(testRoom);
    });

    it('타이핑 상태가 다른 사용자에게 전달되어야 함', async () => {
      const client1 = createClientSocket(token);
      const user2 = await createMockUser({ email: 'typinguser@example.com' });
      const token2 = generateAccessToken(user2);
      const client2 = createClientSocket(token2);

      await new Promise<void>((resolve, reject) => {
        let bothJoined = 0;

        client1.on('connect', () => {
          client1.emit('join_room', { roomId: testRoom.id, nickname: 'User1' });
        });

        client2.on('connect', () => {
          client2.emit('join_room', { roomId: testRoom.id, nickname: 'User2' });
        });

        const onJoined = () => {
          bothJoined++;
          if (bothJoined === 2) {
            // User1이 타이핑 시작
            client1.emit('typing', { roomId: testRoom.id, isTyping: true });
          }
        };

        client1.on('room_joined', onJoined);
        client2.on('room_joined', onJoined);

        client2.on('typing_users', (data) => {
          expect(data.users).toContain('User1');
          client1.disconnect();
          client2.disconnect();
          resolve();
        });

        setTimeout(() => {
          client1.disconnect();
          client2.disconnect();
          reject(new Error('Timeout: typing_users event not received'));
        }, 5000);
      });
    });
  });

  describe('Private Room', () => {
    let privateRoom: ChatRoom;
    let user: User;
    let token: string;

    beforeEach(async () => {
      user = await createMockUser();
      token = generateAccessToken(user);

      privateRoom = roomRepository.create({
        name: 'Private Room',
        type: RoomType.PRIVATE,
        inviteCode: 'ABC12345',
        maxParticipants: 100,
        isActive: true,
        createdBy: user,
      });
      await roomRepository.save(privateRoom);
    });

    it('올바른 초대 코드로 비공개 방에 입장할 수 있어야 함', async () => {
      const user2 = await createMockUser({ email: 'privateuser@example.com' });
      const token2 = generateAccessToken(user2);
      const client = createClientSocket(token2);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          client.emit('join_room', {
            roomId: privateRoom.id,
            nickname: 'PrivateUser',
            inviteCode: 'ABC12345',
          });
        });

        client.on('room_joined', (data) => {
          expect(data.roomId).toBe(privateRoom.id);
          client.disconnect();
          resolve();
        });

        client.on('error', (err) => {
          client.disconnect();
          reject(new Error(err.message));
        });
      });
    });

    it('잘못된 초대 코드로 비공개 방 입장 시 에러가 발생해야 함', async () => {
      const user2 = await createMockUser({ email: 'wrongcode@example.com' });
      const token2 = generateAccessToken(user2);
      const client = createClientSocket(token2);

      await new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.emit('join_room', {
            roomId: privateRoom.id,
            nickname: 'WrongCodeUser',
            inviteCode: 'WRONG123',
          });
        });

        client.on('error', (error) => {
          expect(error.code).toBe('JOIN_FAILED');
          client.disconnect();
          resolve();
        });
      });
    });
  });
});
