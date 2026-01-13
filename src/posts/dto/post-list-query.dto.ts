import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum PostSortType {
  LATEST = 'latest',
  POPULAR = 'popular',
  VIEWS = 'views',
}

export class PostListQueryDto {
  @ApiPropertyOptional({
    description:
      '페이지 번호 (1부터 시작, 커서 기반 페이지네이션 사용 시 무시됨)',
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

  @ApiPropertyOptional({
    description: '정렬 방식 (latest: 최신순, popular: 인기순, views: 조회수순)',
    example: 'latest',
    default: 'latest',
    enum: PostSortType,
  })
  @IsOptional()
  @IsEnum(PostSortType, {
    message: '정렬 방식은 latest, popular, views 중 하나여야 합니다',
  })
  sort?: PostSortType = PostSortType.LATEST;

  @ApiPropertyOptional({
    description: '커서 기반 페이지네이션용 커서 (마지막 게시글 ID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: '유효한 UUID 형식이 아닙니다' })
  cursor?: string;
}
