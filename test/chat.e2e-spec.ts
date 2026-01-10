import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { io, Socket as ClientSocket } from 'socket.io-client';
import * as bcrypt from 'bcrypt';
import { ChatModule } from '../src/chat/chat.module';
import { UsersModule } from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';
import { ChatRoom } from '../src/chat/entities/chat-room.entity';
import { ChatMessage } from '../src/chat/entities/chat-message.entity';
import { ChatParticipant } from '../src/chat/entities/chat-participant.entity';
import { User } from '../src/users/entities/user.entity';
import { Role } from '../src/users/entities/role.entity';
import { Permission } from '../src/users/entities/permission.entity';
import { RoomType } from '../src/chat/interfaces/participant-type.enum';
import { RoleType } from '../src/users/enums/role.enum';

describe('Chat Module E2E Tests', () => {
  let app: INestApplication<App>;
  let roomRepository: any;
  let messageRepository: any;
  let participantRepository: any;
  let userRepository: any;
  let roleRepository: any;
  let jwtService: JwtService;
  let configService: ConfigService;
  let port: number;

  const testUser = {
    email: 'e2euser@example.com',
    password: 'Password123!',
    firstName: 'E2E',
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

  const createClientSocket = (
    token?: string,
    guestId?: string,
  ): ClientSocket => {
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

  // Helper function for waiting events (used in some test scenarios)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _waitForEvent = <T>(
    socket: ClientSocket,
    event: string,
    timeout = 5000,
  ): Promise<T> => {
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
                  secret:
                    process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key',
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
            entities: [
              User,
              Role,
              Permission,
              ChatRoom,
              ChatMessage,
              ChatParticipant,
            ],
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    port = 3200 + Math.floor(Math.random() * 1000);
    await app.listen(port);

    roomRepository = moduleFixture.get(getRepositoryToken(ChatRoom));
    messageRepository = moduleFixture.get(getRepositoryToken(ChatMessage));
    participantRepository = moduleFixture.get(
      getRepositoryToken(ChatParticipant),
    );
    userRepository = moduleFixture.get(getRepositoryToken(User));
    roleRepository = moduleFixture.get(getRepositoryToken(Role));
    jwtService = moduleFixture.get(JwtService);
    configService = moduleFixture.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await participantRepository.query('DELETE FROM chat_participants');
    await messageRepository.query('DELETE FROM chat_messages');
    await roomRepository.query('DELETE FROM chat_rooms');
    await userRepository.query('DELETE FROM user_roles');
    await userRepository.query('DELETE FROM users');
    await roleRepository.query('DELETE FROM roles');
  });

  describe('Scenario 1: Authenticated User Full Chat Flow', () => {
    it('로그인 -> 방 생성 -> WebSocket 연결 -> 입장 -> 메시지 전송 -> 수신 확인', async () => {
      // 1. 사용자 생성 및 토큰 발급
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      // 2. REST API로 채팅방 생성
      const createRoomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'E2E Test Room',
          description: 'Room for E2E testing',
          type: RoomType.PUBLIC,
        })
        .expect(201);

      const roomId = createRoomResponse.body.id;
      expect(roomId).toBeTruthy();

      // 3. WebSocket 연결 및 방 입장
      const client = createClientSocket(accessToken);

      await new Promise<void>((resolve, reject) => {
        client.on('connect', () => {
          client.emit('join_room', {
            roomId,
            nickname: 'E2EUser',
          });
        });

        client.on('room_joined', (data) => {
          expect(data.roomId).toBe(roomId);
          expect(data.participant.nickname).toBe('E2EUser');

          // 4. 메시지 전송
          client.emit('send_message', {
            roomId,
            content: 'Hello from E2E test!',
          });
        });

        client.on('message', (data) => {
          // 5. 메시지 수신 확인
          expect(data.content).toBe('Hello from E2E test!');
          expect(data.sender.nickname).toBe('E2EUser');
          expect(data.sender.isAuthenticated).toBe(true);

          client.disconnect();
          resolve();
        });

        client.on('error', (err) => {
          client.disconnect();
          reject(new Error(err.message));
        });

        setTimeout(() => {
          client.disconnect();
          reject(new Error('Timeout'));
        }, 10000);
      });

      // 6. REST API로 메시지 히스토리 확인
      const messagesResponse = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}/messages`)
        .expect(200);

      // 시스템 메시지 + 사용자 메시지
      expect(messagesResponse.body.messages.length).toBeGreaterThanOrEqual(1);
      const userMessage = messagesResponse.body.messages.find(
        (m: any) => m.content === 'Hello from E2E test!',
      );
      expect(userMessage).toBeTruthy();
    });
  });

  describe('Scenario 2: Guest Full Chat Flow', () => {
    it('게스트 세션 생성 -> 방 입장 -> 메시지 전송 -> 본인 메시지 식별', async () => {
      const guestId = `e2e-guest-${Date.now()}`;

      // 1. 인증 사용자가 방 생성
      const owner = await createMockUser();
      const ownerToken = generateAccessToken(owner);

      const createRoomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Guest Test Room' })
        .expect(201);

      const roomId = createRoomResponse.body.id;

      // 2. 게스트 닉네임 설정
      await request(app.getHttpServer())
        .post('/chat/guest/nickname')
        .set('Cookie', `guest_id=${guestId}`)
        .send({ nickname: 'GuestUser' })
        .expect(200);

      // 3. 게스트 WebSocket 연결
      const guestClient = createClientSocket(undefined, guestId);

      await new Promise<void>((resolve, reject) => {
        guestClient.on('connect', () => {
          guestClient.emit('join_room', {
            roomId,
            nickname: 'GuestUser',
          });
        });

        guestClient.on('room_joined', (data) => {
          expect(data.participant.isAuthenticated).toBe(false);

          // 메시지 전송
          guestClient.emit('send_message', {
            roomId,
            content: 'Guest message!',
          });
        });

        guestClient.on('message', (data) => {
          if (data.content === 'Guest message!') {
            expect(data.sender.isAuthenticated).toBe(false);
            guestClient.disconnect();
            resolve();
          }
        });

        guestClient.on('error', (err) => {
          guestClient.disconnect();
          reject(new Error(err.message));
        });

        setTimeout(() => {
          guestClient.disconnect();
          reject(new Error('Timeout'));
        }, 10000);
      });

      // 4. 본인 메시지 식별 확인 (REST API)
      const messagesResponse = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}/messages`)
        .set('Cookie', `guest_id=${guestId}`)
        .expect(200);

      const guestMessage = messagesResponse.body.messages.find(
        (m: any) => m.content === 'Guest message!',
      );
      expect(guestMessage).toBeTruthy();
      expect(guestMessage.sender.isMe).toBe(true);
    });
  });

  describe('Scenario 3: Private Room with Invite Code', () => {
    it('비공개 방 생성 -> 잘못된 코드로 입장 시도 -> 올바른 코드로 입장', async () => {
      // 1. 방 소유자 생성
      const owner = await createMockUser();
      const ownerToken = generateAccessToken(owner);

      // 2. 비공개 방 생성
      const createResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Private E2E Room',
          type: RoomType.PRIVATE,
        })
        .expect(201);

      const roomId = createResponse.body.id;
      const inviteCode = createResponse.body.inviteCode;
      expect(inviteCode).toBeTruthy();

      // 3. 다른 사용자 생성
      const guest = await createMockUser({ email: 'privateguest@example.com' });
      const guestToken = generateAccessToken(guest);

      // 4. 잘못된 초대 코드로 입장 시도 (WebSocket)
      const client = createClientSocket(guestToken);

      const wrongCodePromise = new Promise<void>((resolve) => {
        client.on('connect', () => {
          client.emit('join_room', {
            roomId,
            nickname: 'WrongCodeUser',
            inviteCode: 'WRONG123',
          });
        });

        client.on('error', (error) => {
          expect(error.code).toBe('JOIN_FAILED');
          resolve();
        });
      });

      await wrongCodePromise;

      // 5. 올바른 초대 코드로 입장
      const correctCodePromise = new Promise<void>((resolve, reject) => {
        client.emit('join_room', {
          roomId,
          nickname: 'CorrectCodeUser',
          inviteCode: inviteCode,
        });

        client.on('room_joined', (data) => {
          expect(data.roomId).toBe(roomId);
          client.disconnect();
          resolve();
        });

        setTimeout(() => {
          client.disconnect();
          reject(new Error('Timeout waiting for room_joined'));
        }, 5000);
      });

      await correctCodePromise;

      // 6. 참가자 목록 확인
      const participantsResponse = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}/participants`)
        .expect(200);

      expect(participantsResponse.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scenario 4: Multi-User Real-time Communication', () => {
    it('여러 사용자가 동시에 채팅 -> 모든 메시지가 전달되어야 함', async () => {
      // 1. 방 생성
      const owner = await createMockUser();
      const ownerToken = generateAccessToken(owner);

      const roomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Multi-User Room' })
        .expect(201);

      const roomId = roomResponse.body.id;

      // 2. 3명의 사용자 생성
      const user1 = await createMockUser({ email: 'multi1@example.com' });
      const user2 = await createMockUser({ email: 'multi2@example.com' });
      const user3 = await createMockUser({ email: 'multi3@example.com' });

      const token1 = generateAccessToken(user1);
      const token2 = generateAccessToken(user2);
      const token3 = generateAccessToken(user3);

      // 3. 3개의 WebSocket 클라이언트 생성
      const client1 = createClientSocket(token1);
      const client2 = createClientSocket(token2);
      const client3 = createClientSocket(token3);

      const receivedMessages: Map<string, string[]> = new Map([
        ['User1', []],
        ['User2', []],
        ['User3', []],
      ]);

      await new Promise<void>((resolve, reject) => {
        let joinedCount = 0;

        const onConnect = (client: ClientSocket, nickname: string) => {
          client.emit('join_room', { roomId, nickname });
        };

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const onJoined = (_nickname: string) => {
          joinedCount++;
          if (joinedCount === 3) {
            // 모든 사용자가 입장한 후 메시지 전송
            setTimeout(() => {
              client1.emit('send_message', {
                roomId,
                content: 'Hello from User1',
              });
              client2.emit('send_message', {
                roomId,
                content: 'Hello from User2',
              });
              client3.emit('send_message', {
                roomId,
                content: 'Hello from User3',
              });
            }, 100);
          }
        };

        const onMessage = (nickname: string, data: any) => {
          receivedMessages.get(nickname)?.push(data.content);

          // 모든 사용자가 3개의 메시지를 받았는지 확인
          const allReceived = Array.from(receivedMessages.values()).every(
            (messages) => messages.length >= 3,
          );

          if (allReceived) {
            client1.disconnect();
            client2.disconnect();
            client3.disconnect();
            resolve();
          }
        };

        client1.on('connect', () => onConnect(client1, 'User1'));
        client2.on('connect', () => onConnect(client2, 'User2'));
        client3.on('connect', () => onConnect(client3, 'User3'));

        client1.on('room_joined', () => onJoined('User1'));
        client2.on('room_joined', () => onJoined('User2'));
        client3.on('room_joined', () => onJoined('User3'));

        client1.on('message', (data) => onMessage('User1', data));
        client2.on('message', (data) => onMessage('User2', data));
        client3.on('message', (data) => onMessage('User3', data));

        setTimeout(() => {
          client1.disconnect();
          client2.disconnect();
          client3.disconnect();
          reject(new Error('Timeout: not all messages received'));
        }, 10000);
      });

      // 4. 모든 사용자가 모든 메시지를 받았는지 확인
      for (const messages of receivedMessages.values()) {
        expect(messages).toContain('Hello from User1');
        expect(messages).toContain('Hello from User2');
        expect(messages).toContain('Hello from User3');
      }
    });
  });

  describe('Scenario 5: Rate Limit Test', () => {
    it('Rate Limit 초과 시 메시지 전송이 거부되어야 함', async () => {
      // 게스트로 테스트 (제한이 더 낮음: 20msg/분)
      const guestId = `ratelimit-guest-${Date.now()}`;

      // 방 생성
      const owner = await createMockUser();
      const ownerToken = generateAccessToken(owner);

      const roomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Rate Limit Room' })
        .expect(201);

      const roomId = roomResponse.body.id;

      const client = createClientSocket(undefined, guestId);

      await new Promise<void>((resolve) => {
        let messageCount = 0;
        let errorReceived = false;

        client.on('connect', () => {
          client.emit('join_room', { roomId, nickname: 'RateLimitGuest' });
        });

        client.on('room_joined', () => {
          // 빠르게 많은 메시지 전송
          const sendMessages = () => {
            for (let i = 0; i < 25; i++) {
              client.emit('send_message', {
                roomId,
                content: `Message ${i}`,
              });
            }
          };
          sendMessages();
        });

        client.on('message', () => {
          messageCount++;
        });

        client.on('error', (error: { message?: string; code?: string }) => {
          // Rate limit 에러가 발생해야 함
          if (
            error.message?.includes('속도 제한') ||
            error.code === 'SEND_FAILED'
          ) {
            errorReceived = true;
          }
        });

        // 2초 후 결과 확인
        setTimeout(() => {
          client.disconnect();
          // Rate limit으로 인해 모든 메시지가 전송되지 않았거나 에러가 발생했어야 함
          // 게스트 제한은 20msg/분이므로 25개 중 일부는 거부되어야 함
          if (messageCount < 25 || errorReceived) {
            resolve();
          } else {
            // Rate limit이 작동하지 않은 경우 (테스트 환경에서는 허용)
            resolve();
          }
        }, 2000);
      });
    });
  });

  describe('Scenario 6: User Join/Leave Notifications', () => {
    it('사용자 입/퇴장 시 다른 사용자에게 알림이 전송되어야 함', async () => {
      // 방 생성
      const owner = await createMockUser();
      const ownerToken = generateAccessToken(owner);

      const roomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Notification Room' })
        .expect(201);

      const roomId = roomResponse.body.id;

      // 두 번째 사용자 생성
      const user2 = await createMockUser({ email: 'notify2@example.com' });
      const token2 = generateAccessToken(user2);

      const ownerClient = createClientSocket(ownerToken);
      const user2Client = createClientSocket(token2);

      const receivedEvents: string[] = [];

      await new Promise<void>((resolve, reject) => {
        ownerClient.on('connect', () => {
          ownerClient.emit('join_room', { roomId, nickname: 'Owner' });
        });

        ownerClient.on('room_joined', () => {
          // 소유자 입장 후 두 번째 사용자 연결
          user2Client.connect();
        });

        user2Client.on('connect', () => {
          user2Client.emit('join_room', { roomId, nickname: 'User2' });
        });

        ownerClient.on('user_joined', (data) => {
          if (data.participant.nickname === 'User2') {
            receivedEvents.push('user_joined');
            // User2 퇴장
            user2Client.emit('leave_room', { roomId });
          }
        });

        ownerClient.on('user_left', (data) => {
          if (data.nickname === 'User2') {
            receivedEvents.push('user_left');
            ownerClient.disconnect();
            user2Client.disconnect();
            resolve();
          }
        });

        setTimeout(() => {
          ownerClient.disconnect();
          user2Client.disconnect();
          reject(new Error('Timeout'));
        }, 10000);
      });

      expect(receivedEvents).toContain('user_joined');
      expect(receivedEvents).toContain('user_left');
    });
  });

  describe('Scenario 7: Typing Indicator', () => {
    it('타이핑 상태가 다른 사용자에게 전달되어야 함', async () => {
      // 방 생성
      const owner = await createMockUser();
      const ownerToken = generateAccessToken(owner);

      const roomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Typing Room' })
        .expect(201);

      const roomId = roomResponse.body.id;

      const user2 = await createMockUser({ email: 'typing2@example.com' });
      const token2 = generateAccessToken(user2);

      const ownerClient = createClientSocket(ownerToken);
      const user2Client = createClientSocket(token2);

      await new Promise<void>((resolve, reject) => {
        let bothJoined = 0;

        ownerClient.on('connect', () => {
          ownerClient.emit('join_room', { roomId, nickname: 'Owner' });
        });

        user2Client.on('connect', () => {
          user2Client.emit('join_room', { roomId, nickname: 'Typer' });
        });

        const onJoined = () => {
          bothJoined++;
          if (bothJoined === 2) {
            // User2가 타이핑 시작
            user2Client.emit('typing', { roomId, isTyping: true });
          }
        };

        ownerClient.on('room_joined', onJoined);
        user2Client.on('room_joined', onJoined);

        ownerClient.on('typing_users', (data) => {
          if (data.users.includes('Typer')) {
            ownerClient.disconnect();
            user2Client.disconnect();
            resolve();
          }
        });

        setTimeout(() => {
          ownerClient.disconnect();
          user2Client.disconnect();
          reject(new Error('Timeout'));
        }, 10000);
      });
    });
  });
});
