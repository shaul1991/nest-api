import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserActivityLog } from './entities/user-activity-log.entity';

/**
 * 분석 모듈
 * DATA-MVP-001: 사용자 활동 로그 테이블 설계
 * DATA-MVP-002: 기본 분석 쿼리 (DAU/MAU)
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserActivityLog])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
