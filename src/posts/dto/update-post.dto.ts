import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class UpdatePostDto {
  @ApiPropertyOptional({
    description: '게시글 제목',
    example: '수정된 게시글 제목',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200, { message: '제목은 200자를 초과할 수 없습니다' })
  title?: string;

  @ApiPropertyOptional({
    description: '게시글 내용',
    example: '수정된 게시글 내용입니다.',
    minLength: 1,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  content?: string;
}
