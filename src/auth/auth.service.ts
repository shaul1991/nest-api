import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { TokenResponse } from './interfaces/token-response.interface';
import { AUTH_ERRORS, TOKEN_TYPE } from '../common/constants/auth.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async register(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await this.hashPassword(createUserDto.password);
    return this.usersService.create(createUserDto, hashedPassword);
  }

  async login(user: User): Promise<TokenResponse> {
    const tokens = await this.generateTokens(user);
    await this.usersService.updateLastLogin(user.id);
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<TokenResponse> {
    const storedTokenHash = await this.getStoredRefreshToken(userId);
    const providedTokenHash = this.hashRefreshToken(refreshToken);

    // 해시값 비교로 토큰 검증
    if (!storedTokenHash || storedTokenHash !== providedTokenHash) {
      throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_INVALID);
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(AUTH_ERRORS.USER_INACTIVE);
    }

    await this.invalidateRefreshToken(userId);

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.invalidateRefreshToken(userId);
    this.logger.log(`User ${userId} logged out`);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    const hashedPassword = await this.hashPassword(newPassword);
    await this.usersService.updatePassword(userId, hashedPassword);
    await this.invalidateRefreshToken(userId);
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds =
      this.configService.get<number>('auth.bcrypt.saltRounds') ?? 12;
    return bcrypt.hash(password, saltRounds);
  }

  private async generateTokens(user: User): Promise<TokenResponse> {
    const payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      roles: user.roleNames,
      permissions: user.permissions,
    };

    const accessPayload: JwtPayload = { ...payload, type: TOKEN_TYPE.ACCESS };
    const refreshPayload: JwtPayload = { ...payload, type: TOKEN_TYPE.REFRESH };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...accessPayload },
        {
          secret: this.configService.get<string>('auth.jwt.secret')!,
          expiresIn: 900, // 15 minutes in seconds
        },
      ),
      this.jwtService.signAsync(
        { ...refreshPayload },
        {
          secret: this.configService.get<string>('auth.jwtRefresh.secret')!,
          expiresIn: 604800, // 7 days in seconds
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    // 보안: 평문 대신 해시값 저장 (Redis 유출 시 토큰 보호)
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.cacheManager.set(`refresh_token:${userId}`, tokenHash, ttl);
  }

  // Refresh Token SHA256 해시 생성
  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async getStoredRefreshToken(userId: string): Promise<string | null> {
    const token = await this.cacheManager.get<string>(
      `refresh_token:${userId}`,
    );
    return token ?? null;
  }

  private async invalidateRefreshToken(userId: string): Promise<void> {
    await this.cacheManager.del(`refresh_token:${userId}`);
  }
}
