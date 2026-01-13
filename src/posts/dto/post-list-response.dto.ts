import { ApiProperty } from '@nestjs/swagger';
import { PostResponseDto } from './post-response.dto';

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

export class PostListResponseDto {
  @ApiProperty({ description: '게시글 목록', type: [PostResponseDto] })
  data: PostResponseDto[];

  @ApiProperty({ description: '페이지네이션 메타 정보', type: PaginationMeta })
  meta: PaginationMeta;
}
