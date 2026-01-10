import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';

export class JoinRoomDto {
  @ApiProperty({
    description: '채팅방 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  roomId: string;

  @ApiPropertyOptional({
    description: '게스트 닉네임 (게스트 전용)',
    example: '익명의 사용자',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50)
  nickname?: string;

  @ApiPropertyOptional({
    description: '초대 코드 (비공개 방 입장 시)',
    example: 'ABC123',
  })
  @IsString()
  @IsOptional()
  inviteCode?: string;
}

export class LeaveRoomDto {
  @ApiProperty({
    description: '채팅방 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  roomId: string;
}
