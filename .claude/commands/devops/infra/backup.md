---
description: "[DevOps/Infra] 데이터베이스 백업"
argument-hint: [dev|prod]
allowed-tools: Bash(docker:*), Bash(cat:*), Bash(ls:*)
---

# DevOps Infrastructure - 백업

## Agent 정보
- **팀**: DevOps
- **역할**: Infrastructure
- **작업**: Backup

## 환경: $1

### 데이터베이스 상태
!`docker ps --filter "name=nest-api-postgres-$1" --format "{{.Names}}: {{.Status}}" 2>/dev/null`

## 백업 절차

### 1. PostgreSQL 백업
```bash
# SQL 덤프 생성
docker exec nest-api-postgres-$1 \
  pg_dump -U nest_api nest_api_${1/prod/} > \
  /opt/nest-api/backups/db_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 볼륨 백업
```bash
# 볼륨 아카이브
docker run --rm \
  -v nest-api-$1_postgres_data:/data:ro \
  -v /opt/nest-api/backups:/backup \
  alpine tar czf /backup/volume_$(date +%Y%m%d).tar.gz /data
```

### 3. Redis 백업 (선택)
```bash
# RDB 스냅샷
docker exec nest-api-redis-$1 redis-cli BGSAVE
```

## 작업 수행

$1 환경의 데이터베이스를 백업합니다.

### 사전 확인
1. 디스크 공간 확인
2. 컨테이너 상태 확인
3. 백업 디렉토리 생성

백업 완료 후 파일 정보를 보고합니다.
