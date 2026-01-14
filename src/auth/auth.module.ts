import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OAuthService } from './oauth.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { KakaoStrategy } from './strategies/kakao.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { OAuthAccount } from './entities/oauth-account.entity';
import { EmailVerification } from './entities/email-verification.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import authConfig from '../config/auth.config';

/**
 * OAuth Strategy 조건부 등록
 * 환경 변수가 설정된 경우에만 해당 Strategy를 등록합니다.
 * 이를 통해 OAuth를 설정하지 않은 환경(테스트, 개발)에서도 앱이 정상 시작됩니다.
 */
const getOAuthProviders = (): Provider[] => {
  const providers: Provider[] = [];

  if (process.env.GOOGLE_CLIENT_ID) {
    providers.push(GoogleStrategy);
  }
  if (process.env.KAKAO_CLIENT_ID) {
    providers.push(KakaoStrategy);
  }
  if (process.env.GITHUB_CLIENT_ID) {
    providers.push(GitHubStrategy);
  }

  return providers;
};

@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwt.secret')!,
        signOptions: {
          expiresIn: 900,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      OAuthAccount,
      EmailVerification,
      PasswordResetToken,
    ]),
    UsersModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OAuthService,
    EmailVerificationService,
    PasswordResetService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    ...getOAuthProviders(),
  ],
  exports: [AuthService, OAuthService],
})
export class AuthModule {}
