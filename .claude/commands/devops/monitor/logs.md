---
description: "[DevOps/Monitor] 컨테이너 로그 분석"
argument-hint: [dev|prod] [lines]
allowed-tools: Bash(docker:*), Bash(cat:*)
---

# DevOps Monitor - 로그 분석

## Agent 정보
- **팀**: DevOps
- **역할**: Monitor
- **작업**: Logs

## 파라미터
- 환경: $1 (기본: dev)
- 라인 수: $2 (기본: 50)

### 활성 슬롯
!`cat /opt/nest-api/.active-slot-$1 2>/dev/null || echo "blue"`

## 작업 수행

$1 환경의 로그를 $2 라인만큼 분석합니다.

### 분석 항목
1. **에러 로그**: ERROR, Exception 패턴
2. **경고 로그**: WARN, Warning 패턴
3. **요청 로그**: HTTP 요청/응답
4. **성능 지표**: 응답 시간, 처리량

### 명령어
```bash
SLOT=$(cat /opt/nest-api/.active-slot-$1 2>/dev/null || echo "blue")
docker logs --tail ${2:-50} nest-api-$SLOT-${1:-dev} 2>&1
```

분석 결과와 권고사항을 제공합니다.
