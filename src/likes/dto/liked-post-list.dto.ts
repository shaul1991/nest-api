import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class LikedPostQueryDto {
  @ApiPropertyOptional({
    description: '페이지 번호 (1부터 시작)',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

class PostAuthorDto {
  @ApiProperty({ description: '작성자 ID' })
  id: string;

  @ApiProperty({ description: '작성자 이메일' })
  email: string;

  @ApiPropertyOptional({ description: '작성자 표시 이름' })
  displayName?: string;

  @ApiPropertyOptional({ description: '작성자 프로필 이미지' })
  profileImage?: string;
}

class LikedPostItemDto {
  @ApiProperty({ description: '게시글 ID' })
  id: string;

  @ApiProperty({ description: '게시글 제목' })
  title: string;

  @ApiProperty({ description: '게시글 내용' })
  content: string;

  @ApiProperty({ description: '작성자 ID' })
  authorId: string;

  @ApiProperty({ description: '조회수' })
  viewCount: number;

  @ApiProperty({ description: '좋아요 수' })
  likeCount: number;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정 일시' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: '작성자 정보', type: PostAuthorDto })
  author?: PostAuthorDto;

  @ApiProperty({ description: '좋아요 일시' })
  likedAt: Date;
}

class PaginationMeta {
  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지당 항목 수' })
  limit: number;

  @ApiProperty({ description: '전체 항목 수' })
  total: number;

  @ApiProperty({ description: '전체 페이지 수' })
  totalPages: number;

  @ApiProperty({ description: '다음 페이지 존재 여부' })
  hasNextPage: boolean;

  @ApiProperty({ description: '이전 페이지 존재 여부' })
  hasPreviousPage: boolean;
}

export class LikedPostListResponseDto {
  @ApiProperty({
    description: '좋아요한 게시글 목록',
    type: [LikedPostItemDto],
  })
  data: LikedPostItemDto[];

  @ApiProperty({ description: '페이지네이션 메타 정보', type: PaginationMeta })
  meta: PaginationMeta;
}

export class BookmarkedPostListResponseDto {
  @ApiProperty({
    description: '북마크한 게시글 목록',
    type: [LikedPostItemDto],
  })
  data: LikedPostItemDto[];

  @ApiProperty({ description: '페이지네이션 메타 정보', type: PaginationMeta })
  meta: PaginationMeta;
}
