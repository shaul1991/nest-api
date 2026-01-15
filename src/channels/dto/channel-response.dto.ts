import { ApiProperty } from '@nestjs/swagger';

export class ChannelResponseDto {
  @ApiProperty({ description: '채널 ID' })
  id: string;

  @ApiProperty({ description: '채널 슬러그 (URL용)' })
  slug: string;

  @ApiProperty({ description: '채널 이름' })
  name: string;

  @ApiProperty({ description: '채널 설명', nullable: true })
  description: string | null;

  @ApiProperty({ description: '채널 아이콘', nullable: true })
  icon: string | null;

  @ApiProperty({ description: '채널 색상' })
  color: string;

  @ApiProperty({ description: '게시글 수' })
  postCount: number;

  @ApiProperty({ description: '구독자 수' })
  subscriberCount: number;

  @ApiProperty({ description: '현재 사용자의 구독 여부' })
  isSubscribed: boolean;

  @ApiProperty({ description: '생성일' })
  createdAt: Date;
}

export class ChannelListQueryDto {
  @ApiProperty({
    description: '정렬 기준',
    enum: ['popular', 'latest', 'name'],
    required: false,
  })
  sortBy?: 'popular' | 'latest' | 'name';

  @ApiProperty({ description: '조회 개수', required: false, default: 10 })
  limit?: number;

  @ApiProperty({ description: '페이지 번호', required: false, default: 1 })
  page?: number;
}
