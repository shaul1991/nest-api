/**
 * DAU/MAU 분석 쿼리 정의
 * DATA-MVP-002: 기본 분석 쿼리 작성
 *
 * 이 파일은 TypeORM QueryBuilder로 구현된 메서드들의
 * Raw SQL 참조용으로 작성되었습니다.
 */

/**
 * 일일 활성 사용자 수 (DAU) 조회 쿼리
 * 특정 날짜에 하나 이상의 활동을 수행한 고유 사용자 수
 */
export const DAU_QUERY = `
SELECT COUNT(DISTINCT user_id) as count
FROM user_activity_logs
WHERE created_at >= :startOfDay
  AND created_at <= :endOfDay
  AND user_id IS NOT NULL;
`;

/**
 * 월간 활성 사용자 수 (MAU) 조회 쿼리
 * 특정 월에 하나 이상의 활동을 수행한 고유 사용자 수
 */
export const MAU_QUERY = `
SELECT COUNT(DISTINCT user_id) as count
FROM user_activity_logs
WHERE created_at >= :startOfMonth
  AND created_at <= :endOfMonth
  AND user_id IS NOT NULL;
`;

/**
 * 일별 활성 사용자 추이 조회 쿼리
 * 지정된 기간 동안의 일별 DAU 추이
 */
export const DAU_TREND_QUERY = `
SELECT
  TO_CHAR(created_at, 'YYYY-MM-DD') as date,
  COUNT(DISTINCT user_id) as count
FROM user_activity_logs
WHERE created_at >= :startDate
  AND created_at <= :endDate
  AND user_id IS NOT NULL
GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
ORDER BY date ASC;
`;

/**
 * 이벤트 타입별 집계 쿼리
 */
export const EVENT_TYPE_STATS_QUERY = `
SELECT
  event_type as "eventType",
  COUNT(*) as count
FROM user_activity_logs
WHERE created_at >= :startDate
  AND created_at <= :endDate
GROUP BY event_type
ORDER BY count DESC;
`;

/**
 * 시간대별 활성 사용자 분포 쿼리
 */
export const HOURLY_ACTIVE_USERS_QUERY = `
SELECT
  EXTRACT(HOUR FROM created_at) as hour,
  COUNT(DISTINCT user_id) as count
FROM user_activity_logs
WHERE created_at >= :startDate
  AND created_at <= :endDate
  AND user_id IS NOT NULL
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hour ASC;
`;

/**
 * 사용자별 세션 수 및 활동량 쿼리
 */
export const USER_ACTIVITY_SUMMARY_QUERY = `
SELECT
  user_id as "userId",
  COUNT(*) as "totalEvents",
  COUNT(DISTINCT DATE(created_at)) as "activeDays",
  MIN(created_at) as "firstActivity",
  MAX(created_at) as "lastActivity"
FROM user_activity_logs
WHERE created_at >= :startDate
  AND created_at <= :endDate
  AND user_id IS NOT NULL
GROUP BY user_id
ORDER BY "totalEvents" DESC
LIMIT :limit;
`;

/**
 * 신규 vs 재방문 사용자 비율 쿼리
 */
export const NEW_VS_RETURNING_USERS_QUERY = `
WITH user_first_seen AS (
  SELECT
    user_id,
    MIN(DATE(created_at)) as first_seen_date
  FROM user_activity_logs
  WHERE user_id IS NOT NULL
  GROUP BY user_id
),
daily_users AS (
  SELECT DISTINCT
    user_id,
    DATE(created_at) as activity_date
  FROM user_activity_logs
  WHERE created_at >= :startDate
    AND created_at <= :endDate
    AND user_id IS NOT NULL
)
SELECT
  du.activity_date as date,
  COUNT(CASE WHEN ufs.first_seen_date = du.activity_date THEN 1 END) as "newUsers",
  COUNT(CASE WHEN ufs.first_seen_date < du.activity_date THEN 1 END) as "returningUsers"
FROM daily_users du
JOIN user_first_seen ufs ON du.user_id = ufs.user_id
GROUP BY du.activity_date
ORDER BY du.activity_date ASC;
`;
