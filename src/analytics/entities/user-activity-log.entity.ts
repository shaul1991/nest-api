import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 이벤트 타입 정의
 */
export enum EventType {
  PAGE_VIEW = 'page_view',
  POST_CREATE = 'post_create',
  POST_VIEW = 'post_view',
  COMMENT_CREATE = 'comment_create',
  LIKE = 'like',
  BOOKMARK = 'bookmark',
  LOGIN = 'login',
  LOGOUT = 'logout',
}

/**
 * 사용자 활동 로그 엔티티
 * DATA-MVP-001: 사용자 활동 로그 테이블 설계
 */
@Entity('user_activity_logs')
@Index(['userId', 'createdAt'])
@Index(['eventType', 'createdAt'])
@Index(['createdAt'])
export class UserActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index()
  userId: string | null;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: EventType,
  })
  eventType: EventType;

  @Column({
    name: 'event_data',
    type: 'jsonb',
    nullable: true,
  })
  eventData: Record<string, any> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
