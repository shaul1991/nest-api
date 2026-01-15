import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment } from './comment.entity';

@Entity('comment_likes')
@Unique(['userId', 'commentId']) // 유니크 제약조건: 사용자당 댓글 하나에 한 번만 좋아요 가능
@Index(['userId']) // 사용자별 좋아요 목록 조회 최적화
@Index(['commentId']) // 댓글별 좋아요 수 조회 최적화
export class CommentLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'comment_id' })
  commentId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;
}
