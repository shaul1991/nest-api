import { Socket } from 'socket.io';
import { ParticipantType } from './participant-type.enum';

export interface SocketData {
  participantType: ParticipantType;
  userId?: string;
  guestId?: string;
  nickname: string;
  profileImage?: string;
  isAuthenticated: boolean;
  currentRooms: Set<string>;
}

export interface AuthenticatedSocket extends Socket {
  data: SocketData;
}

export interface ChatEvents {
  // Client -> Server
  join_room: { roomId: string; nickname?: string; inviteCode?: string };
  leave_room: { roomId: string };
  send_message: { roomId: string; content: string };
  typing: { roomId: string; isTyping: boolean };

  // Server -> Client
  message: MessagePayload;
  user_joined: UserJoinedPayload;
  user_left: UserLeftPayload;
  typing_users: { users: string[] };
  online_users: { participants: ParticipantPayload[] };
  set_guest_id: { guestId: string };
  error: { code: string; message: string };
  room_joined: { roomId: string; participant: ParticipantPayload };
  room_left: { roomId: string };
}

export interface MessagePayload {
  id: string;
  content: string;
  messageType: string;
  sender: {
    id: string;
    nickname: string;
    profileImage: string | null;
    isAuthenticated: boolean;
  };
  createdAt: Date;
}

export interface UserJoinedPayload {
  roomId: string;
  participant: ParticipantPayload;
}

export interface UserLeftPayload {
  roomId: string;
  participantId: string;
  nickname: string;
}

export interface ParticipantPayload {
  id: string;
  nickname: string;
  profileImage: string | null;
  isAuthenticated: boolean;
  isOnline: boolean;
}
