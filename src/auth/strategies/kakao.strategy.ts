import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { ConfigService } from '@nestjs/config';

export interface KakaoProfile {
  id: string;
  email: string;
  nickname: string;
  profileImage: string;
}

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID'),
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET'),
      callbackURL: configService.get<string>('KAKAO_CALLBACK_URL'),
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void,
  ): Promise<void> {
    const { id, _json } = profile;
    const kakaoAccount = _json.kakao_account;

    const user: KakaoProfile = {
      id: String(id),
      email: kakaoAccount?.email || '',
      nickname: kakaoAccount?.profile?.nickname || '',
      profileImage: kakaoAccount?.profile?.profile_image_url || '',
    };

    done(null, { ...user, accessToken, refreshToken });
  }
}
