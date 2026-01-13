import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';

export interface KakaoProfile {
  id: string;
  email: string;
  nickname: string;
  profileImage: string;
}

interface KakaoAccount {
  email?: string;
  profile?: {
    nickname?: string;
    profile_image_url?: string;
  };
}

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(private readonly configService: ConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID')!,
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('KAKAO_CALLBACK_URL')!,
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (
      error: Error | null,
      user?: KakaoProfile & { accessToken: string; refreshToken: string },
    ) => void,
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { id, _json } = profile;
    const kakaoAccount = (_json as { kakao_account?: KakaoAccount })
      .kakao_account;

    const user: KakaoProfile = {
      id: String(id),
      email: kakaoAccount?.email || '',
      nickname: kakaoAccount?.profile?.nickname || '',
      profileImage: kakaoAccount?.profile?.profile_image_url || '',
    };

    done(null, { ...user, accessToken, refreshToken });
  }
}
