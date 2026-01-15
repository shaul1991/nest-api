import { ApiProperty } from '@nestjs/swagger';

export class ImageUploadResponseDto {
  @ApiProperty({
    description: '업로드된 이미지 URL 목록',
    example: [
      'https://storage.example.com/uploads/2026/01/image1.jpg?...',
      'https://storage.example.com/uploads/2026/01/image2.jpg?...',
    ],
    type: [String],
  })
  urls: string[];
}
