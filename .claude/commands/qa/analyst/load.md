---
description: "[QA/Analyst] 부하 테스트 실행"
argument-hint: [dev|prod] [requests] [concurrency]
allowed-tools: Bash(curl:*), Bash(docker:*)
---

# QA Analyst - 부하 테스트

## Agent 정보
- **팀**: QA
- **역할**: Analyst
- **작업**: Load Test

## 파라미터
- 환경: $1 (기본: dev)
- 요청 수: $2 (기본: 100)
- 동시성: $3 (기본: 10)

## 부하 테스트 실행

### 대상 URL
!`echo "https://${1:-dev}-api-nest.shaul.link/health/live" | sed 's/prod-//'`

### 테스트 방법

#### 간단한 부하 테스트 (curl)
```bash
URL="https://${1:-dev}-api-nest.shaul.link/health/live"
URL=$(echo $URL | sed 's/prod-//')

echo "Testing $URL with ${2:-100} requests, ${3:-10} concurrent..."

for i in $(seq 1 ${2:-100}); do
  curl -sf -o /dev/null -w "%{time_total}\n" "$URL" &
  if [ $((i % ${3:-10})) -eq 0 ]; then wait; fi
done | awk '{sum+=$1; count++} END {print "Avg:", sum/count, "s", "Total:", count}'
```

### 모니터링
```bash
# 테스트 중 리소스 확인
docker stats --no-stream --filter "name=nest-api"
```

## 분석 항목

1. **평균 응답 시간**
2. **최대 응답 시간**
3. **에러율**
4. **처리량 (req/s)**

## 작업 수행

부하 테스트를 실행하고:
1. 결과 데이터 수집
2. 성능 분석
3. 병목 지점 식별
4. 개선 권고사항 제시

상세 분석 보고서를 제공합니다.
