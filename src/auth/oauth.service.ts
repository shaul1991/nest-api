import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthAccount, OAuthProvider } from './entities/oauth-account.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { GoogleProfile } from './strategies/google.strategy';
import { KakaoProfile } from './strategies/kakao.strategy';
import { GitHubProfile } from './strategies/github.strategy';

export interface OAuthUser {
  user: User;
  isNewUser: boolean;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectRepository(OAuthAccount)
    private readonly oauthAccountRepository: Repository<OAuthAccount>,
    private readonly usersService: UsersService,
  ) {}

  async findOrCreateGoogleUser(
    profile: GoogleProfile & { accessToken: string; refreshToken: string },
  ): Promise<OAuthUser> {
    const existingOAuth = await this.oauthAccountRepository.findOne({
      where: {
        provider: OAuthProvider.GOOGLE,
        providerAccountId: profile.id,
      },
      relations: ['user'],
    });

    if (existingOAuth) {
      await this.oauthAccountRepository.update(existingOAuth.id, {
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      });

      return { user: existingOAuth.user, isNewUser: false };
    }

    const existingUser = await this.usersService.findByEmail(profile.email);
    if (existingUser) {
      await this.createOAuthAccount(
        existingUser.id,
        OAuthProvider.GOOGLE,
        profile.id,
        profile.accessToken,
        profile.refreshToken,
      );
      return { user: existingUser, isNewUser: false };
    }

    const newUser = await this.usersService.createOAuthUser({
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      profileImage: profile.picture,
      displayName: `${profile.firstName} ${profile.lastName}`.trim(),
    });

    await this.createOAuthAccount(
      newUser.id,
      OAuthProvider.GOOGLE,
      profile.id,
      profile.accessToken,
      profile.refreshToken,
    );

    this.logger.log(`New Google user created: ${profile.email}`);
    return { user: newUser, isNewUser: true };
  }

  async findOrCreateKakaoUser(
    profile: KakaoProfile & { accessToken: string; refreshToken: string },
  ): Promise<OAuthUser> {
    const existingOAuth = await this.oauthAccountRepository.findOne({
      where: {
        provider: OAuthProvider.KAKAO,
        providerAccountId: profile.id,
      },
      relations: ['user'],
    });

    if (existingOAuth) {
      await this.oauthAccountRepository.update(existingOAuth.id, {
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      });

      return { user: existingOAuth.user, isNewUser: false };
    }

    if (profile.email) {
      const existingUser = await this.usersService.findByEmail(profile.email);
      if (existingUser) {
        await this.createOAuthAccount(
          existingUser.id,
          OAuthProvider.KAKAO,
          profile.id,
          profile.accessToken,
          profile.refreshToken,
        );
        return { user: existingUser, isNewUser: false };
      }
    }

    const email = profile.email || `kakao_${profile.id}@commu.local`;
    const newUser = await this.usersService.createOAuthUser({
      email,
      displayName: profile.nickname,
      profileImage: profile.profileImage,
    });

    await this.createOAuthAccount(
      newUser.id,
      OAuthProvider.KAKAO,
      profile.id,
      profile.accessToken,
      profile.refreshToken,
    );

    this.logger.log(`New Kakao user created: ${email}`);
    return { user: newUser, isNewUser: true };
  }

  async findOrCreateGitHubUser(
    profile: GitHubProfile & { accessToken: string; refreshToken: string },
  ): Promise<OAuthUser> {
    const existingOAuth = await this.oauthAccountRepository.findOne({
      where: {
        provider: OAuthProvider.GITHUB,
        providerAccountId: profile.id,
      },
      relations: ['user'],
    });

    if (existingOAuth) {
      await this.oauthAccountRepository.update(existingOAuth.id, {
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
      });

      return { user: existingOAuth.user, isNewUser: false };
    }

    if (profile.email) {
      const existingUser = await this.usersService.findByEmail(profile.email);
      if (existingUser) {
        await this.createOAuthAccount(
          existingUser.id,
          OAuthProvider.GITHUB,
          profile.id,
          profile.accessToken,
          profile.refreshToken,
        );
        return { user: existingUser, isNewUser: false };
      }
    }

    const email = profile.email || `github_${profile.id}@commu.local`;
    const newUser = await this.usersService.createOAuthUser({
      email,
      displayName: profile.displayName || profile.username,
      profileImage: profile.avatarUrl,
    });

    await this.createOAuthAccount(
      newUser.id,
      OAuthProvider.GITHUB,
      profile.id,
      profile.accessToken,
      profile.refreshToken,
    );

    this.logger.log(`New GitHub user created: ${email}`);
    return { user: newUser, isNewUser: true };
  }

  private async createOAuthAccount(
    userId: string,
    provider: OAuthProvider,
    providerAccountId: string,
    accessToken: string,
    refreshToken: string,
  ): Promise<OAuthAccount> {
    const oauthAccount = this.oauthAccountRepository.create({
      userId,
      provider,
      providerAccountId,
      accessToken,
      refreshToken,
    });

    return this.oauthAccountRepository.save(oauthAccount);
  }

  async getConnectedProviders(userId: string): Promise<OAuthProvider[]> {
    const accounts = await this.oauthAccountRepository.find({
      where: { userId },
      select: ['provider'],
    });

    return accounts.map((account) => account.provider);
  }
}
