import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ChatRoom } from './chat-room.entity';
import { ParticipantType } from '../interfaces/participant-type.enum';

@Entity('chat_participants')
@Index(['roomId', 'userId'], { unique: true, where: '"user_id" IS NOT NULL' })
@Index(['roomId', 'guestId'], { unique: true, where: '"guest_id" IS NOT NULL' })
export class ChatParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ChatRoom, (room) => room.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ name: 'guest_id', nullable: true })
  guestId: string | null;

  @Column({
    type: 'enum',
    enum: ParticipantType,
    name: 'participant_type',
  })
  participantType: ParticipantType;

  @Column({ length: 50 })
  nickname: string;

  @Column({ name: 'is_online', default: false })
  isOnline: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @Column({ name: 'last_active_at', nullable: true })
  lastActiveAt: Date | null;
}
