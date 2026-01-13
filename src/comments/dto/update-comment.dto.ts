import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    description: '수정할 댓글 내용',
    example: '수정된 댓글 내용입니다',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: '댓글 내용은 필수입니다' })
  @MaxLength(1000, { message: '댓글은 1000자를 초과할 수 없습니다' })
  content: string;
}
