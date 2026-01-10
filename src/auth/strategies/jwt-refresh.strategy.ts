import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AUTH_ERRORS, TOKEN_TYPE } from '../../common/constants/auth.constants';

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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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

    const authHeader = req.get('Authorization');
    const refreshToken = authHeader?.replace('Bearer ', '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_INVALID);
    }

    return {
      userId: payload.sub,
      refreshToken,
    };
  }
}
