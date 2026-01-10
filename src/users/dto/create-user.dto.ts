import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '비밀번호 (최소 8자, 대소문자/숫자/특수문자 포함)',
    example: '********',
    minLength: 8,
    maxLength: 32,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase, one lowercase, one number and one special character',
  })
  password: string;

  @ApiPropertyOptional({
    description: '이름',
    example: 'John',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: '성',
    example: 'Doe',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;
}
