import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
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
import { RoomType, ParticipantType } from '../../src/chat/interfaces/participant-type.enum';
import { RoleType } from '../../src/users/enums/role.enum';

describe('Chat Controller (Integration)', () => {
  let app: INestApplication<App>;
  let roomRepository: any;
  let messageRepository: any;
  let participantRepository: any;
  let userRepository: any;
  let roleRepository: any;
  let jwtService: JwtService;
  let configService: ConfigService;

  const testUser = {
    email: 'chatuser@example.com',
    password: 'Password123!',
    firstName: 'Chat',
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    roomRepository = moduleFixture.get(getRepositoryToken(ChatRoom));
    messageRepository = moduleFixture.get(getRepositoryToken(ChatMessage));
    participantRepository = moduleFixture.get(getRepositoryToken(ChatParticipant));
    userRepository = moduleFixture.get(getRepositoryToken(User));
    roleRepository = moduleFixture.get(getRepositoryToken(Role));
    jwtService = moduleFixture.get(JwtService);
    configService = moduleFixture.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // 각 테스트 전에 데이터 정리
    await participantRepository.query('DELETE FROM chat_participants');
    await messageRepository.query('DELETE FROM chat_messages');
    await roomRepository.query('DELETE FROM chat_rooms');
    await userRepository.query('DELETE FROM user_roles');
    await userRepository.query('DELETE FROM users');
    await roleRepository.query('DELETE FROM roles');
  });

  describe('POST /chat/rooms', () => {
    it('인증된 사용자가 공개 채팅방을 생성해야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Public Room',
          description: 'A public chat room for testing',
          type: RoomType.PUBLIC,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Public Room');
      expect(response.body.type).toBe(RoomType.PUBLIC);
      expect(response.body).not.toHaveProperty('inviteCode');
    });

    it('인증된 사용자가 비공개 채팅방을 생성하면 초대 코드가 발급되어야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test Private Room',
          type: RoomType.PRIVATE,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe(RoomType.PRIVATE);
      expect(response.body).toHaveProperty('inviteCode');
      expect(response.body.inviteCode.length).toBe(8);
    });

    it('게스트가 채팅방을 생성할 수 있어야 함 (guestId 쿠키 필요)', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Cookie', 'guest_id=guest-uuid-123')
        .send({
          name: 'Guest Room',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Guest Room');
    });

    it('유효하지 않은 데이터로 채팅방 생성 시 400 에러', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /chat/rooms', () => {
    it('공개 채팅방 목록을 조회해야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      // 채팅방 생성
      await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Room 1', type: RoomType.PUBLIC });

      await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Room 2', type: RoomType.PUBLIC });

      // 비공개 방 (목록에 표시되면 안됨)
      await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Private Room', type: RoomType.PRIVATE });

      const response = await request(app.getHttpServer())
        .get('/chat/rooms')
        .expect(200);

      expect(response.body.rooms.length).toBe(2);
      expect(response.body.total).toBe(2);
      expect(response.body.rooms.every((room: any) => room.type === RoomType.PUBLIC)).toBe(true);
    });

    it('페이지네이션이 동작해야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      // 3개 방 생성
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/chat/rooms')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: `Room ${i}`, type: RoomType.PUBLIC });
      }

      const response = await request(app.getHttpServer())
        .get('/chat/rooms?page=1&limit=2')
        .expect(200);

      expect(response.body.rooms.length).toBe(2);
      expect(response.body.total).toBe(3);
    });
  });

  describe('GET /chat/rooms/:id', () => {
    it('채팅방 상세 정보를 조회해야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      const createResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Detail Test Room' })
        .expect(201);

      const roomId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}`)
        .expect(200);

      expect(response.body.id).toBe(roomId);
      expect(response.body.name).toBe('Detail Test Room');
      expect(response.body).toHaveProperty('participantCount');
      expect(response.body).toHaveProperty('onlineCount');
    });

    it('소유자가 조회 시 초대 코드가 포함되어야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      const createResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Private Detail', type: RoomType.PRIVATE })
        .expect(201);

      const roomId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('inviteCode');
    });

    it('존재하지 않는 채팅방 조회 시 404 에러', async () => {
      await request(app.getHttpServer())
        .get('/chat/rooms/non-existent-uuid')
        .expect(404);
    });
  });

  describe('DELETE /chat/rooms/:id', () => {
    it('소유자가 채팅방을 삭제할 수 있어야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      const createResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Room to Delete' })
        .expect(201);

      const roomId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/chat/rooms/${roomId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 삭제된 방은 목록에 표시되지 않아야 함
      const listResponse = await request(app.getHttpServer())
        .get('/chat/rooms')
        .expect(200);

      expect(listResponse.body.rooms.find((r: any) => r.id === roomId)).toBeUndefined();
    });

    it('소유자가 아닌 경우 403 에러', async () => {
      const owner = await createMockUser();
      const other = await createMockUser({ email: 'other@example.com' });
      const ownerToken = generateAccessToken(owner);
      const otherToken = generateAccessToken(other);

      const createResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Owner Room' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/chat/rooms/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('GET /chat/rooms/:id/messages', () => {
    it('메시지 히스토리를 조회해야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      // 방 생성
      const roomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Message Test Room' })
        .expect(201);

      const roomId = roomResponse.body.id;

      // 참가자로 추가 (메시지 전송을 위해)
      const participant = participantRepository.create({
        roomId,
        userId: user.id,
        participantType: ParticipantType.USER,
        nickname: 'TestUser',
        isOnline: true,
      });
      await participantRepository.save(participant);

      // 메시지 직접 추가 (WebSocket 없이 테스트)
      for (let i = 0; i < 3; i++) {
        const message = messageRepository.create({
          roomId,
          userId: user.id,
          senderType: ParticipantType.USER,
          senderNickname: 'TestUser',
          content: `Message ${i}`,
          messageType: 'TEXT',
        });
        await messageRepository.save(message);
      }

      const response = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}/messages`)
        .expect(200);

      expect(response.body.messages.length).toBe(3);
      expect(response.body.total).toBe(3);
    });
  });

  describe('GET /chat/rooms/:id/participants', () => {
    it('참가자 목록을 조회해야 함', async () => {
      const user = await createMockUser();
      const accessToken = generateAccessToken(user);

      // 방 생성
      const roomResponse = await request(app.getHttpServer())
        .post('/chat/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Participant Test Room' })
        .expect(201);

      const roomId = roomResponse.body.id;

      // 참가자 추가
      const participant = participantRepository.create({
        roomId,
        userId: user.id,
        participantType: ParticipantType.USER,
        nickname: 'TestUser',
        isOnline: true,
      });
      await participantRepository.save(participant);

      const response = await request(app.getHttpServer())
        .get(`/chat/rooms/${roomId}/participants`)
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].nickname).toBe('TestUser');
      expect(response.body[0].isAuthenticated).toBe(true);
    });
  });

  describe('Guest API', () => {
    it('게스트 닉네임을 변경할 수 있어야 함', async () => {
      const guestId = 'guest-test-uuid';

      const response = await request(app.getHttpServer())
        .post('/chat/guest/nickname')
        .set('Cookie', `guest_id=${guestId}`)
        .send({ nickname: 'NewGuestName' })
        .expect(200);

      expect(response.body.nickname).toBe('NewGuestName');
    });

    it('게스트 정보를 조회할 수 있어야 함', async () => {
      const guestId = 'guest-info-uuid';

      // 먼저 닉네임 설정으로 세션 생성
      await request(app.getHttpServer())
        .post('/chat/guest/nickname')
        .set('Cookie', `guest_id=${guestId}`)
        .send({ nickname: 'InfoTestGuest' });

      const response = await request(app.getHttpServer())
        .get('/chat/guest/me')
        .set('Cookie', `guest_id=${guestId}`)
        .expect(200);

      expect(response.body.guestId).toBe(guestId);
      expect(response.body.nickname).toBe('InfoTestGuest');
    });
  });
});
