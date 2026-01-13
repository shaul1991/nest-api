import { ApiProperty } from '@nestjs/swagger';

export class SuggestResponseDto {
  @ApiProperty({ type: [String], description: '자동완성 제안 목록' })
  suggestions: string[];

  @ApiProperty({ type: [String], description: '최근 검색어 목록' })
  recentSearches: string[];

  @ApiProperty({ type: [String], description: '인기 검색어 목록' })
  trendingSearches: string[];
}

export class TrendingKeywordDto {
  @ApiProperty({ description: '검색어' })
  keyword: string;

  @ApiProperty({ description: '검색 횟수' })
  count: number;

  @ApiProperty({ enum: ['up', 'down', 'stable'], description: '트렌드 방향' })
  trend: 'up' | 'down' | 'stable';
}

export class TrendingResponseDto {
  @ApiProperty({ type: [TrendingKeywordDto], description: '인기 검색어 목록' })
  keywords: TrendingKeywordDto[];
}
