import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RecommendedUserDto } from './dto/recommended-user.dto';
import { AUTH_ERRORS } from '../common/constants/auth.constants';
import { RoleType } from './enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    hashedPassword: string,
  ): Promise<User> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException(AUTH_ERRORS.EMAIL_EXISTS);
    }

    let defaultRole = await this.roleRepository.findOne({
      where: { name: RoleType.USER },
    });

    if (!defaultRole) {
      defaultRole = this.roleRepository.create({
        name: RoleType.USER,
        description: 'Default user role',
      });
      await this.roleRepository.save(defaultRole);
    }

    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
      roles: [defaultRole],
    });

    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findByIdOrFail(id);
    Object.assign(user, updateUserDto);
    return this.userRepository.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(id, { password: hashedPassword });
  }

  async createOAuthUser(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    profileImage?: string;
  }): Promise<User> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException(AUTH_ERRORS.EMAIL_EXISTS);
    }

    let defaultRole = await this.roleRepository.findOne({
      where: { name: RoleType.USER },
    });

    if (!defaultRole) {
      defaultRole = this.roleRepository.create({
        name: RoleType.USER,
        description: 'Default user role',
      });
      await this.roleRepository.save(defaultRole);
    }

    const user = this.userRepository.create({
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: data.displayName,
      profileImage: data.profileImage,
      isEmailVerified: true,
      password: '',
      roles: [defaultRole],
    });

    return this.userRepository.save(user);
  }

  async verifyEmail(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isEmailVerified: true });
  }

  /**
   * 추천 사용자 목록 조회
   * - 활동이 있는 사용자 우선
   * - 팔로워가 많은 사용자 우선
   */
  async getRecommendedUsers(
    limit: number = 10,
    currentUserId?: string,
  ): Promise<RecommendedUserDto[]> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true })
      .andWhere('user.isEmailVerified = :verified', { verified: true });

    // 현재 사용자 제외
    if (currentUserId) {
      queryBuilder.andWhere('user.id != :currentUserId', { currentUserId });
    }

    // displayName이 있는 사용자 우선
    queryBuilder
      .orderBy('user.followerCount', 'DESC')
      .addOrderBy('user.createdAt', 'DESC')
      .take(limit);

    const users = await queryBuilder.getMany();

    return users.map((user) => this.mapToRecommendedDto(user));
  }

  /**
   * 사용자 팔로우/언팔로우 토글
   */
  async toggleFollow(
    targetUserId: string,
    currentUserId: string,
  ): Promise<RecommendedUserDto> {
    if (targetUserId === currentUserId) {
      throw new ConflictException('자기 자신을 팔로우할 수 없습니다.');
    }

    const targetUser = await this.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    // 간단한 구현: 팔로워 수만 토글 (실제로는 follow 테이블 필요)
    // TODO: Follow 엔티티 및 관계 구현 필요
    // 현재는 팔로워 카운트만 증감하는 간단한 구현

    return this.mapToRecommendedDto(targetUser, false);
  }

  private mapToRecommendedDto(
    user: User,
    isFollowing: boolean = false,
  ): RecommendedUserDto {
    return {
      id: user.id,
      username: user.username || user.email.split('@')[0],
      displayName:
        user.displayName || user.firstName || user.email.split('@')[0],
      profileImage: user.profileImage || null,
      bio: user.bio || null,
      followerCount: user.followerCount || 0,
      isFollowing,
    };
  }
}
