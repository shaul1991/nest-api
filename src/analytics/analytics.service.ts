import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserActivityLog,
  EventType,
} from './entities/user-activity-log.entity';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';

/**
 * DAU/MAU 쿼리 결과 타입
 */
interface CountQueryResult {
  count: string;
}

/**
 * 일일 활성 사용자 추이 쿼리 결과 타입
 */
interface DailyActiveUsersResult {
  date: string;
  count: string;
}

/**
 * 이벤트 타입별 집계 쿼리 결과 타입
 */
interface EventTypeStatsResult {
  eventType: EventType;
  count: string;
}

/**
 * 분석 서비스
 * DATA-MVP-001: 활동 로그 관리
 * DATA-MVP-002: DAU/MAU 분석 쿼리
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(UserActivityLog)
    private readonly activityLogRepository: Repository<UserActivityLog>,
  ) {}

  /**
   * 활동 로그 생성
   */
  async createLog(dto: CreateActivityLogDto): Promise<UserActivityLog> {
    const log = this.activityLogRepository.create({
      userId: dto.userId || null,
      eventType: dto.eventType,
      eventData: dto.eventData || null,
      ipAddress: dto.ipAddress || null,
      userAgent: dto.userAgent || null,
    });
    return this.activityLogRepository.save(log);
  }

  /**
   * 활동 로그 일괄 생성 (벌크 인서트)
   */
  async createLogs(dtos: CreateActivityLogDto[]): Promise<UserActivityLog[]> {
    const logs = dtos.map((dto) =>
      this.activityLogRepository.create({
        userId: dto.userId || null,
        eventType: dto.eventType,
        eventData: dto.eventData || null,
        ipAddress: dto.ipAddress || null,
        userAgent: dto.userAgent || null,
      }),
    );
    return this.activityLogRepository.save(logs);
  }

  /**
   * DATA-MVP-002: 일일 활성 사용자 수 (DAU) 조회
   * @param date - 조회할 날짜 (YYYY-MM-DD 형식)
   */
  async getDailyActiveUsers(date: string): Promise<number> {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    const result = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.user_id)', 'count')
      .where('log.created_at BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .andWhere('log.user_id IS NOT NULL')
      .getRawOne<CountQueryResult>();

    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * DATA-MVP-002: 월간 활성 사용자 수 (MAU) 조회
   * @param month - 조회할 월 (YYYY-MM 형식)
   */
  async getMonthlyActiveUsers(month: string): Promise<number> {
    const [year, monthNum] = month.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    const result = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('COUNT(DISTINCT log.user_id)', 'count')
      .where('log.created_at BETWEEN :start AND :end', {
        start: startOfMonth,
        end: endOfMonth,
      })
      .andWhere('log.user_id IS NOT NULL')
      .getRawOne<CountQueryResult>();

    return parseInt(result?.count ?? '0', 10);
  }

  /**
   * 특정 기간의 DAU 추이 조회
   */
  async getDailyActiveUsersTrend(
    startDate: string,
    endDate: string,
  ): Promise<{ date: string; count: number }[]> {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const result = await this.activityLogRepository
      .createQueryBuilder('log')
      .select("TO_CHAR(log.created_at, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(DISTINCT log.user_id)', 'count')
      .where('log.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('log.user_id IS NOT NULL')
      .groupBy("TO_CHAR(log.created_at, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany<DailyActiveUsersResult>();

    return result.map((row) => ({
      date: row.date,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * 이벤트 타입별 집계
   */
  async getEventTypeStats(
    startDate: string,
    endDate: string,
  ): Promise<{ eventType: EventType; count: number }[]> {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const result = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('log.event_type', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where('log.created_at BETWEEN :start AND :end', { start, end })
      .groupBy('log.event_type')
      .orderBy('count', 'DESC')
      .getRawMany<EventTypeStatsResult>();

    return result.map((row) => ({
      eventType: row.eventType,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * 특정 사용자의 최근 활동 조회
   */
  async getUserRecentActivities(
    userId: string,
    limit: number = 20,
  ): Promise<UserActivityLog[]> {
    return this.activityLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
