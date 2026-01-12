import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: '이메일 인증 토큰',
    example: 'verification-token-xxx',
  })
  @IsString()
  @IsNotEmpty({ message: '인증 토큰은 필수입니다.' })
  token: string;
}
