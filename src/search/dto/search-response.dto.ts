import { ApiProperty } from '@nestjs/swagger';

export class UserSummaryDto {
  @ApiProperty({ description: '사용자 ID' })
  id: string;

  @ApiProperty({ description: '닉네임' })
  nickname: string;

  @ApiProperty({ description: '프로필 이미지 URL', required: false })
  profileImage?: string;
}

export class SearchResultDto {
  @ApiProperty({ description: '결과 ID' })
  id: string;

  @ApiProperty({ enum: ['post', 'comment', 'user'], description: '결과 타입' })
  type: 'post' | 'comment' | 'user';

  @ApiProperty({ description: '제목 (게시글인 경우)', required: false })
  title?: string;

  @ApiProperty({ description: '내용 미리보기' })
  content: string;

  @ApiProperty({ type: [String], description: '검색어 하이라이팅된 텍스트' })
  highlights: string[];

  @ApiProperty({ type: UserSummaryDto, description: '작성자 정보' })
  author: UserSummaryDto;

  @ApiProperty({ description: '생성일' })
  createdAt: Date;

  @ApiProperty({ description: '관련도 점수' })
  score: number;
}

export class SearchResponseDto {
  @ApiProperty({ type: [SearchResultDto], description: '검색 결과 목록' })
  results: SearchResultDto[];

  @ApiProperty({ description: '총 결과 수' })
  total: number;

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '총 페이지 수' })
  totalPages: number;

  @ApiProperty({ description: '검색 쿼리' })
  query: string;
}
