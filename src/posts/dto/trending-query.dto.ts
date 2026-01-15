import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum TrendingPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  ALL = 'all',
}

export class TrendingQueryDto {
  @ApiPropertyOptional({
    description:
      '기간 필터 (today: 오늘, week: 이번 주, month: 이번 달, all: 전체)',
    example: 'today',
    default: 'today',
    enum: TrendingPeriod,
  })
  @IsOptional()
  @IsEnum(TrendingPeriod, {
    message: '기간은 today, week, month, all 중 하나여야 합니다',
  })
  period?: TrendingPeriod = TrendingPeriod.TODAY;

  @ApiPropertyOptional({
    description: '조회할 게시글 수',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
