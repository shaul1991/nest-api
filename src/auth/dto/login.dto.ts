import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '비밀번호',
    example: '********',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}
