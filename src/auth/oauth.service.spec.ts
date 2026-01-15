import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthService } from './oauth.service';
import { OAuthAccount, OAuthProvider } from './entities/oauth-account.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { GitHubProfile } from './strategies/github.strategy';

describe('OAuthService', () => {
  let oauthService: OAuthService;
  let oauthAccountRepository: jest.Mocked<Repository<OAuthAccount>>;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: User = {
    id: 'user-uuid',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'Test',
    lastName: 'User',
    displayName: 'Test User',
    profileImage: 'https://example.com/avatar.png',
    username: 'testuser',
    bio: '',
    followerCount: 0,
    followingCount: 0,
    isActive: true,
    isEmailVerified: true,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [],
    roleNames: ['USER'],
    permissions: [],
  } as User;

  const mockOAuthAccount: OAuthAccount = {
    id: 'oauth-uuid',
    userId: 'user-uuid',
    provider: OAuthProvider.GITHUB,
    providerAccountId: '12345678',
    accessToken: 'old-access-token',
    refreshToken: 'old-refresh-token',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
  };

  const mockGitHubProfile: GitHubProfile & {
    accessToken: string;
    refreshToken: string;
  } = {
    id: '12345678',
    email: 'github@example.com',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12345678',
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
  };

  beforeEach(async () => {
    const mockOAuthAccountRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockUsersService = {
      findByEmail: jest.fn(),
      createOAuthUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        {
          provide: getRepositoryToken(OAuthAccount),
          useValue: mockOAuthAccountRepository,
        },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    oauthService = module.get<OAuthService>(OAuthService);
    oauthAccountRepository = module.get(getRepositoryToken(OAuthAccount));
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOrCreateGitHubUser', () => {
    it('기존 GitHub OAuth 계정이 있으면 토큰을 업데이트하고 사용자를 반환해야 함', async () => {
      oauthAccountRepository.findOne.mockResolvedValue(mockOAuthAccount);
      oauthAccountRepository.update.mockResolvedValue({} as never);

      const result =
        await oauthService.findOrCreateGitHubUser(mockGitHubProfile);

      expect(result.user).toEqual(mockUser);
      expect(result.isNewUser).toBe(false);
      expect(oauthAccountRepository.findOne).toHaveBeenCalledWith({
        where: {
          provider: OAuthProvider.GITHUB,
          providerAccountId: mockGitHubProfile.id,
        },
        relations: ['user'],
      });
      expect(oauthAccountRepository.update).toHaveBeenCalledWith(
        mockOAuthAccount.id,
        {
          accessToken: mockGitHubProfile.accessToken,
          refreshToken: mockGitHubProfile.refreshToken,
        },
      );
    });

    it('이메일이 있고 기존 사용자가 있으면 계정을 연결해야 함', async () => {
      oauthAccountRepository.findOne.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(mockUser);
      oauthAccountRepository.create.mockReturnValue(mockOAuthAccount);
      oauthAccountRepository.save.mockResolvedValue(mockOAuthAccount);

      const result =
        await oauthService.findOrCreateGitHubUser(mockGitHubProfile);

      expect(result.user).toEqual(mockUser);
      expect(result.isNewUser).toBe(false);
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        mockGitHubProfile.email,
      );
      expect(oauthAccountRepository.create).toHaveBeenCalledWith({
        userId: mockUser.id,
        provider: OAuthProvider.GITHUB,
        providerAccountId: mockGitHubProfile.id,
        accessToken: mockGitHubProfile.accessToken,
        refreshToken: mockGitHubProfile.refreshToken,
      });
    });

    it('이메일이 없는 GitHub 계정으로 새 사용자를 생성해야 함 (github_{id}@commu.local)', async () => {
      const profileWithoutEmail = {
        ...mockGitHubProfile,
        email: '',
      };
      const newUser = {
        ...mockUser,
        id: 'new-user-uuid',
        email: `github_${profileWithoutEmail.id}@commu.local`,
      };

      oauthAccountRepository.findOne.mockResolvedValue(null);
      usersService.createOAuthUser.mockResolvedValue(newUser as User);
      oauthAccountRepository.create.mockReturnValue({
        ...mockOAuthAccount,
        userId: newUser.id,
      });
      oauthAccountRepository.save.mockResolvedValue({
        ...mockOAuthAccount,
        userId: newUser.id,
      });

      const result =
        await oauthService.findOrCreateGitHubUser(profileWithoutEmail);

      expect(result.user).toEqual(newUser);
      expect(result.isNewUser).toBe(true);
      expect(usersService.createOAuthUser).toHaveBeenCalledWith({
        email: `github_${profileWithoutEmail.id}@commu.local`,
        displayName: profileWithoutEmail.displayName,
        profileImage: profileWithoutEmail.avatarUrl,
      });
    });

    it('새로운 GitHub 사용자를 생성해야 함', async () => {
      const newUser = {
        ...mockUser,
        id: 'new-user-uuid',
        email: mockGitHubProfile.email,
      };

      oauthAccountRepository.findOne.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createOAuthUser.mockResolvedValue(newUser as User);
      oauthAccountRepository.create.mockReturnValue({
        ...mockOAuthAccount,
        userId: newUser.id,
      });
      oauthAccountRepository.save.mockResolvedValue({
        ...mockOAuthAccount,
        userId: newUser.id,
      });

      const result =
        await oauthService.findOrCreateGitHubUser(mockGitHubProfile);

      expect(result.user).toEqual(newUser);
      expect(result.isNewUser).toBe(true);
      expect(usersService.createOAuthUser).toHaveBeenCalledWith({
        email: mockGitHubProfile.email,
        displayName: mockGitHubProfile.displayName,
        profileImage: mockGitHubProfile.avatarUrl,
      });
      expect(oauthAccountRepository.create).toHaveBeenCalledWith({
        userId: newUser.id,
        provider: OAuthProvider.GITHUB,
        providerAccountId: mockGitHubProfile.id,
        accessToken: mockGitHubProfile.accessToken,
        refreshToken: mockGitHubProfile.refreshToken,
      });
    });

    it('displayName이 없으면 username을 사용해야 함', async () => {
      const profileWithoutDisplayName = {
        ...mockGitHubProfile,
        displayName: '',
      };
      const newUser = {
        ...mockUser,
        id: 'new-user-uuid',
        email: mockGitHubProfile.email,
        displayName: mockGitHubProfile.username,
      };

      oauthAccountRepository.findOne.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createOAuthUser.mockResolvedValue(newUser as User);
      oauthAccountRepository.create.mockReturnValue({
        ...mockOAuthAccount,
        userId: newUser.id,
      });
      oauthAccountRepository.save.mockResolvedValue({
        ...mockOAuthAccount,
        userId: newUser.id,
      });

      await oauthService.findOrCreateGitHubUser(profileWithoutDisplayName);

      expect(usersService.createOAuthUser).toHaveBeenCalledWith({
        email: profileWithoutDisplayName.email,
        displayName: profileWithoutDisplayName.username,
        profileImage: profileWithoutDisplayName.avatarUrl,
      });
    });
  });

  describe('getConnectedProviders', () => {
    it('사용자의 연결된 OAuth 제공자 목록을 반환해야 함', async () => {
      const mockAccounts = [
        { provider: OAuthProvider.GOOGLE },
        { provider: OAuthProvider.GITHUB },
      ];
      oauthAccountRepository.find.mockResolvedValue(
        mockAccounts as OAuthAccount[],
      );

      const result = await oauthService.getConnectedProviders('user-uuid');

      expect(result).toEqual([OAuthProvider.GOOGLE, OAuthProvider.GITHUB]);
      expect(oauthAccountRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        select: ['provider'],
      });
    });

    it('연결된 OAuth 계정이 없으면 빈 배열을 반환해야 함', async () => {
      oauthAccountRepository.find.mockResolvedValue([]);

      const result = await oauthService.getConnectedProviders('user-uuid');

      expect(result).toEqual([]);
    });
  });
});
