import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * 분석 컨트롤러
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * 활동 로그 생성 (내부 서비스용)
   */
  @Post('logs')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createLog(@Body() dto: CreateActivityLogDto) {
    const log = await this.analyticsService.createLog(dto);
    return {
      success: true,
      data: { id: log.id },
    };
  }

  /**
   * 일일 활성 사용자 수 (DAU) 조회
   * @param date - YYYY-MM-DD 형식
   */
  @Get('dau')
  @Roles('admin')
  async getDailyActiveUsers(@Query('date') date: string) {
    const count = await this.analyticsService.getDailyActiveUsers(date);
    return {
      success: true,
      data: {
        date,
        activeUsers: count,
      },
    };
  }

  /**
   * 월간 활성 사용자 수 (MAU) 조회
   * @param month - YYYY-MM 형식
   */
  @Get('mau')
  @Roles('admin')
  async getMonthlyActiveUsers(@Query('month') month: string) {
    const count = await this.analyticsService.getMonthlyActiveUsers(month);
    return {
      success: true,
      data: {
        month,
        activeUsers: count,
      },
    };
  }

  /**
   * DAU 추이 조회
   */
  @Get('dau/trend')
  @Roles('admin')
  async getDailyActiveUsersTrend(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const trend = await this.analyticsService.getDailyActiveUsersTrend(
      startDate,
      endDate,
    );
    return {
      success: true,
      data: trend,
    };
  }

  /**
   * 이벤트 타입별 통계
   */
  @Get('events/stats')
  @Roles('admin')
  async getEventTypeStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const stats = await this.analyticsService.getEventTypeStats(
      startDate,
      endDate,
    );
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 특정 사용자 활동 이력 조회
   */
  @Get('users/:userId/activities')
  @Roles('admin')
  async getUserActivities(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    const activities = await this.analyticsService.getUserRecentActivities(
      userId,
      limit,
    );
    return {
      success: true,
      data: activities,
    };
  }
}
