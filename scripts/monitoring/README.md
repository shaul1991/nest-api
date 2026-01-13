# 모니터링 및 알림 시스템

## 개요
nest-api 프로젝트의 헬스체크 및 Slack 알림 시스템입니다.

## 파일 구조

```
scripts/monitoring/
├── health-check.sh      # 헬스체크 스크립트
├── slack-notify.sh      # Slack 알림 유틸리티
├── crontab.example      # Crontab 설정 예시
└── README.md            # 이 문서
```

## 헬스체크

### 실행 방법

```bash
# 기본 헬스체크 (prod 환경)
./scripts/monitoring/health-check.sh

# 특정 환경 헬스체크
./scripts/monitoring/health-check.sh dev
./scripts/monitoring/health-check.sh staging
./scripts/monitoring/health-check.sh prod

# 전체 체크 (헬스체크 + 의존성 + 시스템)
./scripts/monitoring/health-check.sh prod full

# 의존성 서비스만 체크
./scripts/monitoring/health-check.sh prod deps

# 시스템 리소스만 체크
./scripts/monitoring/health-check.sh prod system
```

### 체크 항목

| 체크 유형 | 설명 |
|----------|------|
| `/health/live` | 서버 생존 확인 |
| `/health/ready` | 서비스 준비 상태 확인 |
| PostgreSQL | DB 연결 상태 |
| Redis | 캐시 연결 상태 |
| 디스크 사용량 | 85% 초과 시 경고 |
| 메모리 사용량 | 90% 초과 시 경고 |

## Slack 알림

### 설정

`.env.production` 파일에 Slack Webhook URL을 추가합니다:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#alerts
```

### 알림 전송

```bash
# 기본 알림
./scripts/monitoring/slack-notify.sh notify "서버 재시작 완료" success "알림"

# 배포 알림
./scripts/monitoring/slack-notify.sh deploy prod v1.2.3 success "배포 완료"
./scripts/monitoring/slack-notify.sh deploy prod v1.2.3 failed "빌드 실패"

# 장애 알림
./scripts/monitoring/slack-notify.sh incident "DB 연결 오류" "PostgreSQL 연결 실패" critical

# 복구 알림
./scripts/monitoring/slack-notify.sh recovery "DB 연결 복구" "정상 복구됨" "15분"

# 백업 알림
./scripts/monitoring/slack-notify.sh backup success daily "125MB"
```

### 알림 레벨

| 레벨 | 색상 | 용도 |
|------|------|------|
| info | 파란색 | 일반 정보 |
| success | 초록색 | 성공 알림 |
| warning | 노란색 | 경고 |
| error/critical | 빨간색 | 오류/장애 |

## Crontab 설정

```bash
# crontab 편집
crontab -e

# 헬스체크 - 5분마다
*/5 * * * * /opt/projects/nest-api/scripts/monitoring/health-check.sh prod check

# 전체 체크 - 1시간마다
0 * * * * /opt/projects/nest-api/scripts/monitoring/health-check.sh prod full
```

## 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| DEV_API_URL | Dev API URL | https://dev-api-nest.shaul.link |
| STAGING_API_URL | Staging API URL | https://staging-api-nest.shaul.link |
| PROD_API_URL | Prod API URL | https://api-nest.shaul.link |
| SLACK_WEBHOOK_URL | Slack Webhook URL | (필수) |
| SLACK_CHANNEL | Slack 채널 | #alerts |

## 알림 중복 방지

헬스체크 스크립트는 상태 변경 시에만 알림을 발송합니다:
- 정상 -> 장애: 장애 알림 발송
- 장애 -> 정상: 복구 알림 발송
- 장애 -> 장애: 알림 발송 안 함 (중복 방지)

상태 파일 위치: `.monitoring/health-state-{환경}.json`

## 문제 해결

### 알림이 오지 않는 경우

1. Webhook URL 확인
```bash
echo $SLACK_WEBHOOK_URL
```

2. 테스트 알림 전송
```bash
./scripts/monitoring/slack-notify.sh test
```

3. curl로 직접 테스트
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  YOUR_WEBHOOK_URL
```

### 헬스체크 실패 시

1. 서버 상태 확인
```bash
curl -v https://api-nest.shaul.link/health/live
```

2. 로그 확인
```bash
tail -f logs/monitoring/health-check-*.log
```
