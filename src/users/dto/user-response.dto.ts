import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: '사용자 UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: '이메일 주소',
    example: 'user@example.com',
  })
  email: string;

  @ApiPropertyOptional({
    description: '이름',
    example: 'John',
  })
  firstName: string | null;

  @ApiPropertyOptional({
    description: '성',
    example: 'Doe',
  })
  lastName: string | null;

  @ApiProperty({
    description: '계정 활성화 상태',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: '이메일 인증 여부',
    example: false,
  })
  isEmailVerified: boolean;

  @ApiProperty({
    description: '생성 일시',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '수정 일시',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;
}
