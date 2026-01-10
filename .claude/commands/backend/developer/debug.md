---
description: "[Backend/Developer] 에러 디버깅 및 분석"
argument-hint: [error-message]
allowed-tools: Read, Grep, Glob, Bash(docker:*), Bash(npm:*)
---

# Backend Developer - 디버깅

## Agent 정보
- **팀**: Backend
- **역할**: Developer
- **작업**: Debug

## 에러 정보: $ARGUMENTS

## 디버깅 프로세스

### 1. 에러 로그 수집
!`docker logs nest-api-blue-dev 2>&1 | grep -i error | tail -10`

### 2. 스택 트레이스 분석
에러 메시지와 스택 트레이스를 분석하여:
- 에러 발생 위치 파악
- 관련 코드 파일 식별
- 근본 원인 추론

### 3. 코드 검토
관련 파일을 읽고 문제점 파악

### 4. 환경 확인
```bash
# DB 연결
docker exec nest-api-postgres-dev pg_isready -U nest_api

# Redis 연결
docker exec nest-api-redis-dev redis-cli ping
```

## 작업 수행

제공된 에러 정보를 바탕으로:
1. 원인 분석
2. 해결 방안 제시
3. 코드 수정 제안

상세한 디버깅 보고서를 제공합니다.
