import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostResponseDto } from './post-response.dto';

class PaginationMeta {
  @ApiPropertyOptional({ description: '현재 페이지 (오프셋 페이지네이션)' })
  page?: number;

  @ApiProperty({ description: '페이지당 항목 수' })
  limit: number;

  @ApiPropertyOptional({ description: '전체 항목 수 (오프셋 페이지네이션)' })
  total?: number;

  @ApiPropertyOptional({ description: '전체 페이지 수 (오프셋 페이지네이션)' })
  totalPages?: number;

  @ApiProperty({ description: '다음 페이지 존재 여부' })
  hasNextPage: boolean;

  @ApiPropertyOptional({
    description: '이전 페이지 존재 여부 (오프셋 페이지네이션)',
  })
  hasPreviousPage?: boolean;

  @ApiPropertyOptional({
    description: '다음 페이지 커서 (커서 기반 페이지네이션)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  nextCursor?: string | null;
}

export class PostListResponseDto {
  @ApiProperty({ description: '게시글 목록', type: [PostResponseDto] })
  data: PostResponseDto[];

  @ApiProperty({ description: '페이지네이션 메타 정보', type: PaginationMeta })
  meta: PaginationMeta;
}
