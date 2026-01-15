import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CommentAuthorDto {
  @ApiProperty({ description: '작성자 ID' })
  id: string;

  @ApiProperty({ description: '작성자 이메일' })
  email: string;

  @ApiPropertyOptional({ description: '작성자 표시 이름' })
  displayName?: string;

  @ApiPropertyOptional({ description: '작성자 프로필 이미지' })
  profileImage?: string;
}

export class CommentResponseDto {
  @ApiProperty({ description: '댓글 ID' })
  id: string;

  @ApiProperty({ description: '댓글 내용' })
  content: string;

  @ApiProperty({ description: '게시글 ID' })
  postId: string;

  @ApiProperty({ description: '작성자 ID' })
  authorId: string;

  @ApiPropertyOptional({ description: '부모 댓글 ID (대댓글인 경우)' })
  parentId?: string | null;

  @ApiProperty({ description: '좋아요 수', default: 0 })
  likeCount: number;

  @ApiProperty({ description: '현재 사용자의 좋아요 여부', default: false })
  isLiked: boolean;

  @ApiProperty({ description: '삭제된 댓글 여부', default: false })
  isDeleted: boolean;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정 일시' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: '작성자 정보', type: CommentAuthorDto })
  author?: CommentAuthorDto;

  @ApiPropertyOptional({
    description: '대댓글 목록',
    type: () => [CommentResponseDto],
  })
  replies?: CommentResponseDto[];
}

export class CommentLikeToggleResponseDto {
  @ApiProperty({ description: '좋아요 여부' })
  isLiked: boolean;

  @ApiProperty({ description: '좋아요 수' })
  likeCount: number;
}

export class CommentListResponseDto {
  @ApiProperty({ description: '댓글 목록', type: [CommentResponseDto] })
  data: CommentResponseDto[];

  @ApiProperty({ description: '전체 댓글 수 (대댓글 포함)' })
  total: number;
}
