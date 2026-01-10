import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: '현재 비밀번호',
    example: '********',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({
    description: '새 비밀번호 (최소 8자, 대소문자/숫자/특수문자 포함)',
    example: '********',
    minLength: 8,
    maxLength: 32,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'New password must contain at least one uppercase, one lowercase, one number and one special character',
  })
  newPassword: string;
}
