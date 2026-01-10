---
description: "[DevOps/Monitor] 전체 시스템 상태 확인"
allowed-tools: Bash(docker:*), Bash(curl:*), Bash(cat:*), Bash(systemctl:*), Bash(ss:*)
---

# DevOps Monitor - 상태 확인

## Agent 정보
- **팀**: DevOps
- **역할**: Monitor
- **작업**: Status

## 시스템 상태 대시보드

### 활성 슬롯
| 환경 | 슬롯 |
|------|------|
| Dev | !`cat /opt/nest-api/.active-slot-dev 2>/dev/null || echo "unknown"` |
| Prod | !`cat /opt/nest-api/.active-slot-prod 2>/dev/null || echo "unknown"` |

### 컨테이너 상태
!`docker ps --filter "name=nest-api" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null`

### 서비스 상태
!`systemctl is-active caddy docker 2>/dev/null | paste - - | awk '{print "Caddy: "$1", Docker: "$2}'`

### 포트 사용
!`ss -tlnp 2>/dev/null | grep -E "3100|3101|3102|3103" | awk '{print $4}' | sort -u`

## 작업

위 정보를 분석하고:
1. 이상 상태 식별
2. 추가 진단 필요 시 실행
3. 개선 권고사항 제시
