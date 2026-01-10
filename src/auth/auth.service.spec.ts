import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { AUTH_ERRORS } from '../common/constants/auth.constants';

jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let cacheManager: jest.Mocked<{
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  }>;

  const mockRole: Role = {
    id: 'role-uuid',
    name: 'USER',
    description: 'Default user role',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    users: [],
    permissions: [],
  };

  const mockUser: User = {
    id: 'user-uuid',
    email: 'test@example.com',
    password: 'hashedPassword123',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    isEmailVerified: false,
    lastLoginAt: null as unknown as Date,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [mockRole],
    get roleNames() {
      return this.roles?.map((role) => role.name) || [];
    },
    get permissions() {
      return [];
    },
  };

  const mockInactiveUser: User = {
    ...mockUser,
    id: 'inactive-user-uuid',
    email: 'inactive@example.com',
    isActive: false,
    get roleNames() {
      return this.roles?.map((role) => role.name) || [];
    },
    get permissions() {
      return [];
    },
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateLastLogin: jest.fn(),
      updatePassword: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    cacheManager = module.get(CACHE_MANAGER);

    // Default config mock
    configService.get.mockImplementation((key: string) => {
      const config: Record<string, string | number> = {
        'auth.jwt.secret': 'test-jwt-secret',
        'auth.jwtRefresh.secret': 'test-refresh-secret',
        'auth.bcrypt.saltRounds': 12,
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('유효한 자격 증명으로 사용자를 반환해야 함', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toEqual(mockUser);
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashedPassword123',
      );
    });

    it('존재하지 않는 이메일로 null을 반환해야 함', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'nonexistent@example.com',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('잘못된 비밀번호로 null을 반환해야 함', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongpassword',
        'hashedPassword123',
      );
    });

    it('비활성 사용자에 대해 null을 반환해야 함', async () => {
      usersService.findByEmail.mockResolvedValue(mockInactiveUser);

      const result = await authService.validateUser(
        'inactive@example.com',
        'password123',
      );

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const createUserDto = {
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
    };

    it('새 사용자를 성공적으로 등록해야 함', async () => {
      const hashedPassword = 'hashedPassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      usersService.create.mockResolvedValue({
        ...mockUser,
        email: createUserDto.email,
      });

      const result = await authService.register(createUserDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 12);
      expect(usersService.create).toHaveBeenCalledWith(
        createUserDto,
        hashedPassword,
      );
      expect(result.email).toBe(createUserDto.email);
    });

    it('중복 이메일 등록시 예외가 발생해야 함 (UsersService에서 처리)', async () => {
      const hashedPassword = 'hashedPassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      usersService.create.mockRejectedValue(
        new Error(AUTH_ERRORS.EMAIL_EXISTS),
      );

      await expect(authService.register(createUserDto)).rejects.toThrow(
        AUTH_ERRORS.EMAIL_EXISTS,
      );
    });
  });

  describe('login', () => {
    it('성공적인 로그인시 토큰을 반환해야 함', async () => {
      const accessToken = 'access-token';
      const refreshToken = 'refresh-token';

      jwtService.signAsync
        .mockResolvedValueOnce(accessToken)
        .mockResolvedValueOnce(refreshToken);
      usersService.updateLastLogin.mockResolvedValue(undefined);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await authService.login(mockUser);

      expect(result).toEqual({
        accessToken,
        refreshToken,
        expiresIn: 900,
      });
      expect(usersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
      expect(cacheManager.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.id}`,
        refreshToken,
        7 * 24 * 60 * 60 * 1000,
      );
    });

    it('토큰 생성시 올바른 페이로드를 사용해야 함', async () => {
      jwtService.signAsync.mockResolvedValue('token');
      usersService.updateLastLogin.mockResolvedValue(undefined);
      cacheManager.set.mockResolvedValue(undefined);

      await authService.login(mockUser);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          type: 'access',
        }),
        expect.objectContaining({
          secret: 'test-jwt-secret',
          expiresIn: 900,
        }),
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          email: mockUser.email,
          type: 'refresh',
        }),
        expect.objectContaining({
          secret: 'test-refresh-secret',
          expiresIn: 604800,
        }),
      );
    });
  });

  describe('refreshTokens', () => {
    const userId = 'user-uuid';
    const refreshToken = 'valid-refresh-token';

    it('유효한 리프레시 토큰으로 새 토큰을 반환해야 함', async () => {
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      cacheManager.get.mockResolvedValue(refreshToken);
      usersService.findById.mockResolvedValue(mockUser);
      cacheManager.del.mockResolvedValue(undefined);
      jwtService.signAsync
        .mockResolvedValueOnce(newAccessToken)
        .mockResolvedValueOnce(newRefreshToken);
      cacheManager.set.mockResolvedValue(undefined);

      const result = await authService.refreshTokens(userId, refreshToken);

      expect(result).toEqual({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 900,
      });
      expect(cacheManager.del).toHaveBeenCalledWith(`refresh_token:${userId}`);
    });

    it('저장된 토큰이 없으면 예외를 던져야 함', async () => {
      cacheManager.get.mockResolvedValue(null);

      await expect(
        authService.refreshTokens(userId, refreshToken),
      ).rejects.toThrow(
        new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_INVALID),
      );
    });

    it('토큰이 일치하지 않으면 예외를 던져야 함', async () => {
      cacheManager.get.mockResolvedValue('different-token');

      await expect(
        authService.refreshTokens(userId, refreshToken),
      ).rejects.toThrow(
        new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_INVALID),
      );
    });

    it('비활성 사용자에 대해 예외를 던져야 함', async () => {
      cacheManager.get.mockResolvedValue(refreshToken);
      usersService.findById.mockResolvedValue(mockInactiveUser);

      await expect(
        authService.refreshTokens(mockInactiveUser.id, refreshToken),
      ).rejects.toThrow(new UnauthorizedException(AUTH_ERRORS.USER_INACTIVE));
    });

    it('사용자가 존재하지 않으면 예외를 던져야 함', async () => {
      cacheManager.get.mockResolvedValue(refreshToken);
      usersService.findById.mockResolvedValue(null);

      await expect(
        authService.refreshTokens(userId, refreshToken),
      ).rejects.toThrow(new UnauthorizedException(AUTH_ERRORS.USER_INACTIVE));
    });
  });

  describe('logout', () => {
    it('성공적으로 로그아웃해야 함', async () => {
      cacheManager.del.mockResolvedValue(undefined);

      await authService.logout('user-uuid');

      expect(cacheManager.del).toHaveBeenCalledWith('refresh_token:user-uuid');
    });
  });

  describe('changePassword', () => {
    const userId = 'user-uuid';
    const currentPassword = 'oldPassword123!';
    const newPassword = 'newPassword456!';

    it('비밀번호를 성공적으로 변경해야 함', async () => {
      const hashedNewPassword = 'hashedNewPassword';

      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedNewPassword);
      usersService.updatePassword.mockResolvedValue(undefined);
      cacheManager.del.mockResolvedValue(undefined);

      await authService.changePassword(userId, currentPassword, newPassword);

      expect(usersService.findById).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        currentPassword,
        mockUser.password,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(usersService.updatePassword).toHaveBeenCalledWith(
        userId,
        hashedNewPassword,
      );
      expect(cacheManager.del).toHaveBeenCalledWith(`refresh_token:${userId}`);
    });

    it('사용자가 존재하지 않으면 예외를 던져야 함', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        authService.changePassword(userId, currentPassword, newPassword),
      ).rejects.toThrow(new UnauthorizedException(AUTH_ERRORS.USER_NOT_FOUND));
    });

    it('현재 비밀번호가 틀리면 예외를 던져야 함', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.changePassword(userId, 'wrongPassword', newPassword),
      ).rejects.toThrow(
        new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS),
      );
    });
  });

  describe('hashPassword', () => {
    it('비밀번호를 해시해야 함', async () => {
      const password = 'testPassword123!';
      const hashedPassword = 'hashedPassword';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await authService.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });
});
