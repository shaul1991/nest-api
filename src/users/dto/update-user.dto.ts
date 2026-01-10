import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateUserDto {
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
