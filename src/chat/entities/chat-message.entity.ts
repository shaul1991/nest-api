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
import { ParticipantType, MessageType } from '../interfaces/participant-type.enum';

@Entity('chat_messages')
@Index(['roomId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ChatRoom, (room) => room.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', name: 'guest_id', nullable: true })
  guestId: string | null;

  @Column({
    type: 'enum',
    enum: ParticipantType,
    name: 'sender_type',
  })
  senderType: ParticipantType;

  @Column({ name: 'sender_nickname', length: 50 })
  senderNickname: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
    name: 'message_type',
  })
  messageType: MessageType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
