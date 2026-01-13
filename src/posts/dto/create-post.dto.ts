import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: '게시글 제목',
    example: '첫 번째 게시글입니다',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: '제목은 필수입니다' })
  @MinLength(1)
  @MaxLength(200, { message: '제목은 200자를 초과할 수 없습니다' })
  title: string;

  @ApiProperty({
    description: '게시글 내용',
    example: '게시글 내용입니다. 자유롭게 작성해 주세요.',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty({ message: '내용은 필수입니다' })
  @MinLength(1)
  content: string;
}
