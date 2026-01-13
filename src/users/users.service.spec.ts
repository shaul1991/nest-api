import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { AUTH_ERRORS } from '../common/constants/auth.constants';
import { RoleType } from './enums/role.enum';

describe('UsersService', () => {
  let usersService: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let roleRepository: jest.Mocked<Repository<Role>>;

  const mockRole: Role = {
    id: 'role-uuid',
    name: RoleType.USER,
    description: 'Default user role',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    users: [],
    permissions: [],
  };

  const mockUser = {
    id: 'user-uuid',
    email: 'test@example.com',
    password: 'hashedPassword123',
    firstName: 'Test',
    lastName: 'User',
    profileImage: 'https://example.com/avatar.png',
    displayName: 'Test User',
    isActive: true,
    isEmailVerified: false,
    lastLoginAt: null as unknown as Date,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [mockRole],
    roleNames: [RoleType.USER],
    permissions: [],
  } as User;

  beforeEach(async () => {
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockRoleRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    roleRepository = module.get(getRepositoryToken(Role));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
    };
    const hashedPassword = 'hashedPassword';

    it('새 사용자를 성공적으로 생성해야 함', async () => {
      userRepository.findOne.mockResolvedValue(null);
      roleRepository.findOne.mockResolvedValue(mockRole);
      userRepository.create.mockReturnValue({
        ...mockUser,
        email: createUserDto.email,
        password: hashedPassword,
      } as User);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        email: createUserDto.email,
        password: hashedPassword,
      } as User);

      const result = await usersService.create(createUserDto, hashedPassword);

      expect(result.email).toBe(createUserDto.email);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
        relations: ['roles', 'roles.permissions'],
      });
      expect(userRepository.create).toHaveBeenCalledWith({
        ...createUserDto,
        password: hashedPassword,
        roles: [mockRole],
      });
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('기본 역할이 없으면 새로 생성해야 함', async () => {
      const newRole = { ...mockRole, id: 'new-role-uuid' };

      userRepository.findOne.mockResolvedValue(null);
      roleRepository.findOne.mockResolvedValue(null);
      roleRepository.create.mockReturnValue(newRole);
      roleRepository.save.mockResolvedValue(newRole);
      userRepository.create.mockReturnValue({
        ...mockUser,
        email: createUserDto.email,
        password: hashedPassword,
        roles: [newRole],
      } as User);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        email: createUserDto.email,
        password: hashedPassword,
        roles: [newRole],
      } as User);

      const result = await usersService.create(createUserDto, hashedPassword);

      expect(result).toBeDefined();
      expect(roleRepository.create).toHaveBeenCalledWith({
        name: RoleType.USER,
        description: 'Default user role',
      });
      expect(roleRepository.save).toHaveBeenCalled();
    });

    it('이미 존재하는 이메일로 생성시 예외를 던져야 함', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        usersService.create(createUserDto, hashedPassword),
      ).rejects.toThrow(new ConflictException(AUTH_ERRORS.EMAIL_EXISTS));
    });
  });

  describe('findByEmail', () => {
    it('이메일로 사용자를 찾아 반환해야 함', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await usersService.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        relations: ['roles', 'roles.permissions'],
      });
    });

    it('사용자가 없으면 null을 반환해야 함', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await usersService.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('ID로 사용자를 찾아 반환해야 함', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await usersService.findById('user-uuid');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        relations: ['roles', 'roles.permissions'],
      });
    });

    it('사용자가 없으면 null을 반환해야 함', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await usersService.findById('nonexistent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('ID로 사용자를 찾아 반환해야 함', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await usersService.findByIdOrFail('user-uuid');

      expect(result).toEqual(mockUser);
    });

    it('사용자가 없으면 NotFoundException을 던져야 함', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        usersService.findByIdOrFail('nonexistent-uuid'),
      ).rejects.toThrow(new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND));
    });
  });

  describe('update', () => {
    const updateUserDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('사용자 정보를 성공적으로 업데이트해야 함', async () => {
      const updatedUser = {
        ...mockUser,
        firstName: updateUserDto.firstName,
        lastName: updateUserDto.lastName,
      } as User;

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await usersService.update('user-uuid', updateUserDto);

      expect(result.firstName).toBe(updateUserDto.firstName);
      expect(result.lastName).toBe(updateUserDto.lastName);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('사용자가 없으면 NotFoundException을 던져야 함', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        usersService.update('nonexistent-uuid', updateUserDto),
      ).rejects.toThrow(new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND));
    });
  });

  describe('updateLastLogin', () => {
    it('마지막 로그인 시간을 업데이트해야 함', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 } as any);

      await usersService.updateLastLogin('user-uuid');

      expect(userRepository.update).toHaveBeenCalledWith('user-uuid', {
        lastLoginAt: expect.any(Date),
      });
    });
  });

  describe('updatePassword', () => {
    it('비밀번호를 업데이트해야 함', async () => {
      const hashedPassword = 'newHashedPassword';
      userRepository.update.mockResolvedValue({ affected: 1 } as any);

      await usersService.updatePassword('user-uuid', hashedPassword);

      expect(userRepository.update).toHaveBeenCalledWith('user-uuid', {
        password: hashedPassword,
      });
    });
  });
});
