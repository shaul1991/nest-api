---
description: Production 환경에 Blue-Green 배포 실행
allowed-tools: Bash(./scripts/deploy.sh:*)
---

# Production 환경 Blue-Green 배포

현재 상태:
- 활성 슬롯: !`cat /opt/nest-api/.active-slot-prod 2>/dev/null || echo "blue"`
- 컨테이너: !`docker ps --filter "name=nest-api" --filter "name=prod" --format "{{.Names}}: {{.Status}}" 2>/dev/null`

## 경고

Production 환경 배포입니다. 신중하게 진행하세요.

## 작업

Production 환경에 Blue-Green 배포를 실행합니다.

```bash
cd /opt/nest-api && ./scripts/deploy.sh prod
```

배포 완료 후 헬스체크를 수행하고 결과를 보고합니다.
