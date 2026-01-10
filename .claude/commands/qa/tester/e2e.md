---
description: "[QA/Tester] E2E 테스트 실행"
allowed-tools: Bash(npm:*), Bash(docker:*), Read
---

# QA Tester - E2E 테스트

## Agent 정보
- **팀**: QA
- **역할**: Tester
- **작업**: E2E

## E2E 테스트 실행

### 사전 조건 확인
- 데이터베이스: !`docker ps --filter "name=postgres" --format "{{.Status}}" | head -1`
- Redis: !`docker ps --filter "name=redis" --format "{{.Status}}" | head -1`

### 실행 명령
```bash
cd /opt/nest-api
npm run test:e2e
```

## 테스트 대상

### 헬스체크 API
- GET /health/live
- GET /health/ready

### 인증 API (구현 시)
- POST /auth/login
- POST /auth/register
- POST /auth/refresh

### 리소스 API (구현 시)
- CRUD 엔드포인트

## 작업 수행

1. 테스트 환경 확인
2. E2E 테스트 실행
3. 결과 분석
4. 실패 시 디버깅 정보 제공

### 예상 결과
```
Test Suites: X passed, X total
Tests:       X passed, X total
```
