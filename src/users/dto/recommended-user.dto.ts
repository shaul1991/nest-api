import { ApiProperty } from '@nestjs/swagger';

export class RecommendedUserDto {
  @ApiProperty({ description: '사용자 ID' })
  id: string;

  @ApiProperty({ description: '사용자명' })
  username: string;

  @ApiProperty({ description: '표시 이름' })
  displayName: string;

  @ApiProperty({ description: '프로필 이미지', nullable: true })
  profileImage: string | null;

  @ApiProperty({ description: '자기소개', nullable: true })
  bio: string | null;

  @ApiProperty({ description: '팔로워 수' })
  followerCount: number;

  @ApiProperty({ description: '현재 사용자의 팔로우 여부' })
  isFollowing: boolean;
}
