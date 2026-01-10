import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType, ParticipantType } from '../interfaces/participant-type.enum';

export class SenderDto {
  @ApiProperty({ description: '발신자 ID (userId 또는 guestId)' })
  id: string;

  @ApiProperty({ description: '닉네임' })
  nickname: string;

  @ApiPropertyOptional({ description: '프로필 이미지 URL' })
  profileImage: string | null;

  @ApiProperty({ description: '인증된 사용자 여부 (인증마크 표시용)' })
  isAuthenticated: boolean;

  @ApiProperty({ description: '본인 메시지 여부' })
  isMe: boolean;
}

export class MessageResponseDto {
  @ApiProperty({ description: '메시지 ID' })
  id: string;

  @ApiProperty({ description: '메시지 내용' })
  content: string;

  @ApiProperty({ enum: MessageType, description: '메시지 유형' })
  messageType: MessageType;

  @ApiProperty({ type: SenderDto, description: '발신자 정보' })
  sender: SenderDto;

  @ApiProperty({ description: '전송 시간' })
  createdAt: Date;
}

export class ParticipantResponseDto {
  @ApiProperty({ description: '참가자 ID' })
  id: string;

  @ApiProperty({ description: '닉네임' })
  nickname: string;

  @ApiPropertyOptional({ description: '프로필 이미지 URL' })
  profileImage: string | null;

  @ApiProperty({ description: '인증된 사용자 여부' })
  isAuthenticated: boolean;

  @ApiProperty({ enum: ParticipantType, description: '참가자 유형' })
  participantType: ParticipantType;

  @ApiProperty({ description: '온라인 상태' })
  isOnline: boolean;

  @ApiProperty({ description: '참가 시간' })
  joinedAt: Date;
}

export class RoomResponseDto {
  @ApiProperty({ description: '채팅방 ID' })
  id: string;

  @ApiProperty({ description: '채팅방 이름' })
  name: string;

  @ApiPropertyOptional({ description: '채팅방 설명' })
  description: string | null;

  @ApiProperty({ description: '채팅방 유형' })
  type: string;

  @ApiProperty({ description: '최대 참가자 수' })
  maxParticipants: number;

  @ApiProperty({ description: '현재 참가자 수' })
  participantCount: number;

  @ApiProperty({ description: '현재 온라인 수' })
  onlineCount: number;

  @ApiProperty({ description: '생성 시간' })
  createdAt: Date;

  @ApiPropertyOptional({ description: '초대 코드 (소유자에게만 표시)' })
  inviteCode?: string;
}

export class GuestResponseDto {
  @ApiProperty({ description: '게스트 ID' })
  guestId: string;

  @ApiProperty({ description: '닉네임' })
  nickname: string;

  @ApiProperty({ description: '생성 시간' })
  createdAt: string;
}
