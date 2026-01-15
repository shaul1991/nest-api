import { ApiProperty } from '@nestjs/swagger';

export class TrendingPostDto {
  @ApiProperty({ description: '게시글 ID' })
  id: string;

  @ApiProperty({ description: '제목' })
  title: string;

  @ApiProperty({ description: '내용 (미리보기)' })
  content: string;

  @ApiProperty({ description: '작성자 표시명' })
  author: string;

  @ApiProperty({ description: '채널/카테고리 (첫 번째 태그 또는 "일반")' })
  channel: string;

  @ApiProperty({ description: '좋아요 수' })
  upvotes: number;

  @ApiProperty({ description: '싫어요 수' })
  downvotes: number;

  @ApiProperty({ description: '댓글 수' })
  comments: number;

  @ApiProperty({ description: '작성일시' })
  createdAt: string;

  @ApiProperty({ description: '트렌딩 여부' })
  trending: boolean;
}
