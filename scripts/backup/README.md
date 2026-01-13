# PostgreSQL 백업 시스템

## 개요
nest-api 프로젝트의 PostgreSQL 데이터베이스 자동 백업 시스템입니다.

## 백업 정책

| 유형 | 실행 시간 | 보존 기간 |
|------|----------|----------|
| 일간 백업 | 매일 03:00 | 7일 |
| 주간 백업 | 일요일 04:00 | 4주 |

## 파일 구조

```
scripts/backup/
├── db-backup.sh       # 백업 스크립트
├── db-restore.sh      # 복원 스크립트
├── crontab.example    # Crontab 설정 예시
└── README.md          # 이 문서

/opt/backups/nest-api/
├── daily/             # 일간 백업 저장
├── weekly/            # 주간 백업 저장
└── logs/              # 백업 로그
```

## 사용법

### 수동 백업 실행

```bash
# 일간 백업
./scripts/backup/db-backup.sh daily

# 주간 백업
./scripts/backup/db-backup.sh weekly
```

### Docker 환경 백업

```bash
# 환경 변수 설정
export USE_DOCKER_BACKUP=true
export POSTGRES_CONTAINER=nest-api-postgres

# 백업 실행
./scripts/backup/db-backup.sh daily
```

### 복원

```bash
# 백업 목록 확인
./scripts/backup/db-restore.sh list

# 특정 백업으로 복원
./scripts/backup/db-restore.sh restore /opt/backups/nest-api/daily/backup_daily_20250114_030000.sql.gz

# 최신 일간 백업으로 복원
./scripts/backup/db-restore.sh latest daily

# Docker 환경에서 복원
./scripts/backup/db-restore.sh docker /opt/backups/nest-api/daily/backup_daily_20250114_030000.sql.gz
```

## Crontab 설정

```bash
# crontab 편집
crontab -e

# 아래 내용 추가
# 일간 백업 - 매일 03:00
0 3 * * * /opt/projects/nest-api/scripts/backup/db-backup.sh daily >> /opt/backups/nest-api/logs/cron-daily.log 2>&1

# 주간 백업 - 매주 일요일 04:00
0 4 * * 0 /opt/projects/nest-api/scripts/backup/db-backup.sh weekly >> /opt/backups/nest-api/logs/cron-weekly.log 2>&1
```

## 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| DATABASE_HOST | DB 호스트 | localhost |
| DATABASE_PORT | DB 포트 | 5432 |
| DATABASE_NAME | DB 이름 | nest_api |
| DATABASE_USER | DB 사용자 | nestjs |
| DATABASE_PASSWORD | DB 비밀번호 | (필수) |
| BACKUP_DIR | 백업 저장 경로 | /opt/backups/nest-api |
| SLACK_WEBHOOK_URL | Slack 알림 URL | (선택) |
| USE_DOCKER_BACKUP | Docker 백업 사용 | false |
| POSTGRES_CONTAINER | PostgreSQL 컨테이너명 | nest-api-postgres |

## 알림 설정

Slack 알림을 사용하려면 `.env.production` 파일에 webhook URL을 추가합니다:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## 문제 해결

### 백업 실패 시

1. 로그 확인
```bash
tail -f /opt/backups/nest-api/logs/backup-*.log
```

2. 데이터베이스 연결 확인
```bash
psql -h localhost -U nestjs -d nest_api -c "SELECT 1;"
```

3. 디스크 공간 확인
```bash
df -h /opt/backups
```

### 복원 실패 시

1. 백업 파일 무결성 확인
```bash
gzip -t /opt/backups/nest-api/daily/backup_daily_*.sql.gz
```

2. 체크섬 검증
```bash
sha256sum -c /opt/backups/nest-api/daily/backup_daily_*.sql.gz.sha256
```
