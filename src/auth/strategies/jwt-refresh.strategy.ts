import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AUTH_ERRORS, TOKEN_TYPE } from '../../common/constants/auth.constants';

// 쿠키에서 refreshToken 추출 함수
function extractRefreshTokenFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.refreshToken ?? null;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('auth.jwtRefresh.secret');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1순위: 쿠키에서 추출 (httpOnly 쿠키 - 보안 권장)
        extractRefreshTokenFromCookie,
        // 2순위: Authorization 헤더에서 추출 (fallback)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    } as const);
  }

  validate(
    req: Request,
    payload: JwtPayload,
  ): { userId: string; refreshToken: string } {
    if (payload.type !== TOKEN_TYPE.REFRESH) {
      throw new UnauthorizedException(AUTH_ERRORS.TOKEN_INVALID);
    }

    // 쿠키 또는 Authorization 헤더에서 refreshToken 추출
    const cookieToken = extractRefreshTokenFromCookie(req);
    const headerToken = req.get('Authorization')?.replace('Bearer ', '').trim();
    const refreshToken = cookieToken || headerToken;

    if (!refreshToken) {
      throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_INVALID);
    }

    return {
      userId: payload.sub,
      refreshToken,
    };
  }
}
