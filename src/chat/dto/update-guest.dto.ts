import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class UpdateGuestNicknameDto {
  @ApiProperty({
    description: '새 닉네임',
    example: '익명의 고양이',
    minLength: 2,
    maxLength: 20,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[가-힣a-zA-Z0-9_]+$/, {
    message: '닉네임은 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.',
  })
  nickname: string;
}

export class JoinWithInviteCodeDto {
  @ApiProperty({
    description: '초대 코드',
    example: 'ABC123XY',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  inviteCode: string;
}
