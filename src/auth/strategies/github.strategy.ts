import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

export interface GitHubProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

interface GitHubEmail {
  value: string;
  primary?: boolean;
  verified?: boolean;
}

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID')!,
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL')!,
      scope: ['user:email'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (
      error: Error | null,
      user?: GitHubProfile & { accessToken: string; refreshToken: string },
    ) => void,
  ): void {
    const { id, username, displayName, emails, photos } = profile;

    // 이메일 추출 (primary 또는 첫 번째 이메일)
    const typedEmails = emails as GitHubEmail[] | undefined;
    const primaryEmail =
      typedEmails?.find((e) => e.primary)?.value ||
      typedEmails?.[0]?.value ||
      '';

    const user: GitHubProfile = {
      id: String(id),
      email: primaryEmail,
      username: username || '',
      displayName: displayName || username || '',
      avatarUrl: photos?.[0]?.value || '',
    };

    done(null, { ...user, accessToken, refreshToken });
  }
}
