import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SearchType {
  ALL = 'all',
  POST = 'post',
  COMMENT = 'comment',
  USER = 'user',
}

export enum SearchSort {
  RELEVANCE = 'relevance',
  LATEST = 'latest',
  POPULAR = 'popular',
}

export class SearchRequestDto {
  @ApiProperty({ description: '검색 쿼리', example: 'React' })
  @IsString()
  query: string;

  @ApiPropertyOptional({
    enum: SearchType,
    default: SearchType.ALL,
    description: '검색 타입 (전체/게시글/댓글/사용자)',
  })
  @IsOptional()
  @IsEnum(SearchType)
  type?: SearchType = SearchType.ALL;

  @ApiPropertyOptional({
    enum: SearchSort,
    default: SearchSort.RELEVANCE,
    description: '정렬 기준 (관련도/최신순/인기순)',
  })
  @IsOptional()
  @IsEnum(SearchSort)
  sort?: SearchSort = SearchSort.RELEVANCE;

  @ApiPropertyOptional({ default: 1, description: '페이지 번호' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, description: '페이지당 결과 수' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
