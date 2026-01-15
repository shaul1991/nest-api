import { ApiProperty } from '@nestjs/swagger';

export class TagResponseDto {
  @ApiProperty({
    description: '태그 이름',
    example: 'react',
  })
  name: string;

  @ApiProperty({
    description: '사용 횟수',
    example: 150,
  })
  count: number;
}

export class TagSuggestResponseDto {
  @ApiProperty({
    description: '추천 태그 목록',
    type: [TagResponseDto],
  })
  tags: TagResponseDto[];
}

export class TagPopularResponseDto {
  @ApiProperty({
    description: '인기 태그 목록',
    type: [TagResponseDto],
  })
  tags: TagResponseDto[];
}
