import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AuthorDto {
  @ApiProperty({ description: '작성자 ID' })
  id: string;

  @ApiProperty({ description: '작성자 이메일' })
  email: string;

  @ApiPropertyOptional({ description: '작성자 표시 이름' })
  displayName?: string;

  @ApiPropertyOptional({ description: '프로필 이미지 URL' })
  profileImage?: string;
}

export class PostResponseDto {
  @ApiProperty({ description: '게시글 ID' })
  id: string;

  @ApiProperty({ description: '게시글 제목' })
  title: string;

  @ApiProperty({ description: '게시글 내용' })
  content: string;

  @ApiProperty({ description: '작성자 ID' })
  authorId: string;

  @ApiProperty({ description: '조회수', default: 0 })
  viewCount: number;

  @ApiProperty({ description: '좋아요 수', default: 0 })
  likeCount: number;

  @ApiProperty({ description: '생성일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정일시' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: '작성자 정보', type: AuthorDto })
  author?: AuthorDto;
}
