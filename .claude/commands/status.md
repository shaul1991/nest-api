---
description: NestJS API 전체 상태 확인
allowed-tools: Bash(docker:*), Bash(curl:*), Bash(cat:*)
---

# NestJS API 상태 확인

## 현재 상태

### 활성 슬롯
- Dev: !`cat /opt/nest-api/.active-slot-dev 2>/dev/null || echo "unknown"`
- Prod: !`cat /opt/nest-api/.active-slot-prod 2>/dev/null || echo "unknown"`

### 컨테이너 상태
!`docker ps --filter "name=nest-api" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null`

### 이미지 목록
!`docker images nest-api --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" 2>/dev/null | head -10`

## 작업

위 정보를 분석하고, 추가로 필요한 경우:
1. 헬스체크 엔드포인트 호출
2. 컨테이너 로그 확인
3. 문제 진단 및 해결책 제시
