---
description: 컨테이너 로그 확인
argument-hint: [dev|prod] [lines]
allowed-tools: Bash(docker logs:*), Bash(cat:*)
---

# 컨테이너 로그 확인

환경: $1 (기본값: dev)
라인 수: $2 (기본값: 50)

## 현재 활성 슬롯

!`cat /opt/nest-api/.active-slot-$1 2>/dev/null || echo "blue"`

## 작업

$1 환경의 활성 컨테이너 로그를 $2 라인만큼 확인합니다.

```bash
# 활성 슬롯 확인
SLOT=$(cat /opt/nest-api/.active-slot-$1 2>/dev/null || echo "blue")
ENV="${1:-dev}"
LINES="${2:-50}"

# 로그 출력
docker logs --tail $LINES nest-api-$SLOT-$ENV
```

로그를 분석하여 에러나 경고가 있으면 보고합니다.
