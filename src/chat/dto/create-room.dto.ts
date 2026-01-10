import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoomType } from '../interfaces/participant-type.enum';

export class CreateRoomDto {
  @ApiProperty({
    description: '채팅방 이름',
    example: '일반 채팅방',
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: '채팅방 설명',
    example: '자유롭게 대화하는 공간입니다.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: '채팅방 유형',
    enum: RoomType,
    default: RoomType.PUBLIC,
  })
  @IsEnum(RoomType)
  @IsOptional()
  type?: RoomType;

  @ApiPropertyOptional({
    description: '최대 참가자 수',
    default: 100,
    minimum: 2,
    maximum: 500,
  })
  @IsInt()
  @Min(2)
  @Max(500)
  @IsOptional()
  maxParticipants?: number;
}
