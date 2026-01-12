import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from '../../common/decorators/match.decorator';

export class ResetPasswordDto {
  @ApiProperty({
    description: '비밀번호 재설정 토큰',
    example: 'reset-token-xxx',
  })
  @IsString()
  @IsNotEmpty({ message: '재설정 토큰은 필수입니다.' })
  token: string;

  @ApiProperty({
    description: '새 비밀번호 (8자 이상, 영문+숫자+특수문자)',
    example: 'NewSecureP@ss456',
  })
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '비밀번호는 영문, 숫자, 특수문자를 포함해야 합니다.',
  })
  password: string;

  @ApiProperty({
    description: '비밀번호 확인',
    example: 'NewSecureP@ss456',
  })
  @IsString()
  @Match('password', { message: '비밀번호가 일치하지 않습니다.' })
  passwordConfirm: string;
}
