import { ApiProperty } from '@nestjs/swagger';

export class LikeToggleResponseDto {
  @ApiProperty({
    description: '좋아요 상태',
    example: true,
  })
  liked: boolean;

  @ApiProperty({
    description: '게시글의 총 좋아요 수',
    example: 42,
  })
  likeCount: number;
}

export class BookmarkToggleResponseDto {
  @ApiProperty({
    description: '북마크 상태',
    example: true,
  })
  bookmarked: boolean;
}
