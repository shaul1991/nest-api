import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule, CACHE_MANAGER } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { User } from '../src/users/entities/user.entity';
import { Role } from '../src/users/entities/role.entity';
import { Permission } from '../src/users/entities/permission.entity';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { RoleType } from '../src/users/enums/role.enum';

describe('Auth Module (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: any;
  let roleRepository: any;
  let jwtService: JwtService;
  let configService: ConfigService;
  let cacheManager: any;

  const testUser = {
    email: 'test@example.com',
    password: 'Password123!',
    firstName: 'Test',
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

  const generateRefreshToken = (user: User): string => {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roleNames || [],
      permissions: user.permissions || [],
      type: 'refresh',
    };
    return jwtService.sign(payload, {
      secret: configService.get<string>('auth.jwtRefresh.secret'),
      expiresIn: '7d',
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
            entities: [User, Role, Permission],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        CacheModule.register({
          isGlobal: true,
          ttl: 60000,
        }),
        AuthModule,
        UsersModule,
      ],
      providers: [
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: RolesGuard,
        },
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

    userRepository = moduleFixture.get(getRepositoryToken(User));
    roleRepository = moduleFixture.get(getRepositoryToken(Role));
    jwtService = moduleFixture.get(JwtService);
    configService = moduleFixture.get(ConfigService);
    cacheManager = moduleFixture.get(CACHE_MANAGER);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // 각 테스트 전에 사용자 데이터 정리
    await userRepository.query('DELETE FROM user_roles');
    await userRepository.query('DELETE FROM users');
    await roleRepository.query('DELETE FROM roles');
    if (cacheManager.reset) {
      await cacheManager.reset();
    }
  });

  describe('POST /auth/register', () => {
    it('성공 (201) - 새 사용자 등록', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.firstName).toBe(testUser.firstName);
      expect(response.body.lastName).toBe(testUser.lastName);
      expect(response.body).not.toHaveProperty('password');
    });

    it('중복 이메일 (409) - 이미 존재하는 이메일로 등록', async () => {
      await createMockUser();

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.message).toContain('Email already exists');
    });

    it('유효하지 않은 데이터 (400) - 이메일 형식 오류', async () => {
      const invalidUser = {
        ...testUser,
        email: 'invalid-email',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.message).toContain('email must be an email');
    });

    it('유효하지 않은 데이터 (400) - 비밀번호 형식 오류', async () => {
      const invalidUser = {
        ...testUser,
        password: 'weak',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('유효하지 않은 데이터 (400) - 필수 필드 누락', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({})
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await createMockUser();
    });

    it('성공 (200) - 유효한 자격 증명으로 로그인', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');
    });

    it('잘못된 자격 증명 (401) - 잘못된 이메일', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'wrong@example.com',
          password: testUser.password,
        })
        .expect(401);
    });

    it('잘못된 자격 증명 (401) - 잘못된 비밀번호', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('잘못된 자격 증명 (401) - 비활성 사용자', async () => {
      await userRepository.query('DELETE FROM user_roles');
      await userRepository.query('DELETE FROM users');
      await createMockUser({ isActive: false });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let user: User;
    let refreshToken: string;

    beforeEach(async () => {
      user = await createMockUser();
      refreshToken = generateRefreshToken(user);
      // 리프레시 토큰을 캐시에 저장
      await cacheManager.set(
        `refresh_token:${user.id}`,
        refreshToken,
        7 * 24 * 60 * 60 * 1000,
      );
    });

    it('성공 (200) - 유효한 리프레시 토큰으로 갱신', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');
    });

    it('유효하지 않은 토큰 (401) - 토큰 없음', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('유효하지 않은 토큰 (401) - 잘못된 토큰', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('유효하지 않은 토큰 (401) - 캐시에 없는 토큰', async () => {
      await cacheManager.del(`refresh_token:${user.id}`);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let user: User;
    let accessToken: string;

    beforeEach(async () => {
      user = await createMockUser();
      accessToken = generateAccessToken(user);
    });

    it('성공 (200) - 로그아웃 성공', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });

    it('인증되지 않음 (401) - 토큰 없이 로그아웃 시도', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('인증되지 않음 (401) - 잘못된 토큰으로 로그아웃 시도', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('GET /users/me', () => {
    let user: User;
    let accessToken: string;

    beforeEach(async () => {
      user = await createMockUser();
      accessToken = generateAccessToken(user);
    });

    it('성공 (200) - 현재 사용자 정보 조회', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
      expect(response.body.firstName).toBe(user.firstName);
      expect(response.body.lastName).toBe(user.lastName);
      expect(response.body).not.toHaveProperty('password');
    });

    it('인증되지 않음 (401) - 토큰 없이 조회 시도', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('인증되지 않음 (401) - 잘못된 토큰으로 조회 시도', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('인증되지 않음 (401) - 만료된 토큰으로 조회 시도', async () => {
      const expiredToken = jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          roles: [],
          permissions: [],
          type: 'access',
        },
        {
          secret: configService.get<string>('auth.jwt.secret'),
          expiresIn: '-1h',
        },
      );

      await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('POST /auth/change-password', () => {
    let user: User;
    let accessToken: string;

    beforeEach(async () => {
      user = await createMockUser();
      accessToken = generateAccessToken(user);
    });

    it('성공 (200) - 비밀번호 변경 성공', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewPassword456!',
        })
        .expect(200);

      expect(response.body.message).toBe('Password changed successfully');
    });

    it('인증되지 않음 (401) - 현재 비밀번호가 틀림', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword456!',
        })
        .expect(401);
    });

    it('인증되지 않음 (401) - 토큰 없이 비밀번호 변경 시도', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewPassword456!',
        })
        .expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    let user: User;
    let accessToken: string;

    beforeEach(async () => {
      user = await createMockUser();
      accessToken = generateAccessToken(user);
    });

    it('성공 (200) - 프로필 업데이트 성공', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.firstName).toBe(updateData.firstName);
      expect(response.body.lastName).toBe(updateData.lastName);
    });

    it('인증되지 않음 (401) - 토큰 없이 프로필 업데이트 시도', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .send({
          firstName: 'Updated',
        })
        .expect(401);
    });
  });
});
