import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsOptional,
  IsArray,
  IsUrl,
  ArrayMaxSize,
} from 'class-validator';

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

  @ApiPropertyOptional({
    description: '태그 목록 (최대 5개)',
    example: ['react', 'typescript', 'nestjs'],
    maxItems: 5,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5, { message: '태그는 최대 5개까지 추가할 수 있습니다' })
  tags?: string[];

  @ApiPropertyOptional({
    description: '이미지 URL 목록 (최대 10개)',
    example: ['https://storage.example.com/image1.jpg'],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10, { message: '이미지는 최대 10개까지 추가할 수 있습니다' })
  images?: string[];

  @ApiPropertyOptional({
    description: '참고 링크 URL',
    example: 'https://example.com/reference',
  })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: '유효한 URL 형식이 아닙니다' })
  @MaxLength(500, { message: 'URL은 500자를 초과할 수 없습니다' })
  referenceUrl?: string;
}
