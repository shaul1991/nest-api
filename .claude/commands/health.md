---
description: API 헬스체크 실행
allowed-tools: Bash(curl:*)
---

# API 헬스체크

## 헬스체크 실행

### Dev 환경
!`curl -sf https://dev-api-nest.shaul.link/health/live 2>/dev/null || echo "FAILED"`

### Production 환경
!`curl -sf https://api-nest.shaul.link/health/live 2>/dev/null || echo "FAILED"`

## 작업

헬스체크 결과를 분석하고:
1. 정상인 경우: 상태 보고
2. 실패인 경우: 원인 분석 및 해결책 제시
