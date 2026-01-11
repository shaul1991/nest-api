import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileCategory, FileStatus } from '../entities/file.entity';

export class FileResponseDto {
  @ApiProperty({
    description: '파일 ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: '원본 파일명',
    example: 'profile-image.jpg',
  })
  originalName: string;

  @ApiProperty({
    description: 'MIME 타입',
    example: 'image/jpeg',
  })
  mimeType: string;

  @ApiProperty({
    description: '파일 크기 (bytes)',
    example: 1024000,
  })
  size: number;

  @ApiProperty({
    description: '파일 카테고리',
    enum: FileCategory,
    example: FileCategory.IMAGE,
  })
  category: FileCategory;

  @ApiProperty({
    description: '파일 상태',
    enum: FileStatus,
    example: FileStatus.COMPLETED,
  })
  status: FileStatus;

  @ApiProperty({
    description: '썸네일 존재 여부',
    example: true,
  })
  hasThumbnail: boolean;

  @ApiPropertyOptional({
    description: '파일 메타데이터',
    type: 'object',
  })
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: '업로더 ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  uploaderId: string;

  @ApiProperty({
    description: '생성일시',
  })
  createdAt: Date;
}

export class DownloadUrlResponseDto {
  @ApiProperty({
    description: 'Pre-signed 다운로드 URL',
    example: 'https://minio.example.com/bucket/path?X-Amz-...',
  })
  url: string;

  @ApiProperty({
    description: 'URL 만료 시간 (초)',
    example: 3600,
  })
  expiresIn: number;

  @ApiProperty({
    description: 'URL 만료 일시',
  })
  expiresAt: Date;
}

export class ThumbnailUrlResponseDto extends DownloadUrlResponseDto {
  @ApiProperty({
    description: '썸네일 크기',
    example: 'medium',
  })
  size: string;

  @ApiPropertyOptional({
    description: '썸네일 크기 정보',
    example: { width: 400, height: 400 },
  })
  dimensions?: {
    width: number;
    height: number;
  };
}
