import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from './role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ name: 'first_name', nullable: true })
  firstName: string;

  @Column({ name: 'last_name', nullable: true })
  lastName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;

  @Column({ name: 'profile_image', nullable: true })
  profileImage: string;

  @Column({ name: 'display_name', length: 50, nullable: true })
  displayName: string;

  @Column({ length: 50, nullable: true, unique: true })
  username: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ name: 'follower_count', default: 0 })
  followerCount: number;

  @Column({ name: 'following_count', default: 0 })
  followingCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // eager: false - 필요한 곳에서만 명시적으로 relations 로드
  // 성능 최적화: 모든 User 쿼리에서 자동 JOIN 방지
  @ManyToMany(() => Role, (role) => role.users, { eager: false })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];

  get roleNames(): string[] {
    return this.roles?.map((role) => role.name) || [];
  }

  get permissions(): string[] {
    if (!this.roles) return [];
    const permissionSet = new Set<string>();
    this.roles.forEach((role) => {
      role.permissions?.forEach((permission) => {
        permissionSet.add(permission.name);
      });
    });
    return Array.from(permissionSet);
  }
}
