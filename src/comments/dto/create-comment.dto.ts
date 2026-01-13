import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: '댓글 내용',
    example: '좋은 글이네요!',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: '댓글 내용은 필수입니다' })
  @MaxLength(1000, { message: '댓글은 1000자를 초과할 수 없습니다' })
  content: string;

  @ApiPropertyOptional({
    description: '대댓글인 경우 부모 댓글 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: '유효한 UUID 형식이 아닙니다' })
  parentId?: string;
}
