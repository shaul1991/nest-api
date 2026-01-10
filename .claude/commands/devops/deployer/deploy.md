---
description: "[DevOps/Deployer] Blue-Green 배포 실행"
argument-hint: [dev|prod]
allowed-tools: Bash(./scripts/deploy.sh:*), Bash(docker:*), Bash(curl:*), Bash(cat:*)
---

# DevOps Deployer - 배포

## Agent 정보
- **팀**: DevOps
- **역할**: Deployer
- **작업**: Deploy

## 환경: $1

### 현재 상태
- 활성 슬롯: !`cat /opt/nest-api/.active-slot-$1 2>/dev/null || echo "blue"`
- 컨테이너: !`docker ps --filter "name=nest-api-" --filter "name=$1" --format "{{.Names}}: {{.Status}}" 2>/dev/null | head -3`

## 작업 수행

$1 환경에 Blue-Green 배포를 실행합니다.

### 배포 프로세스
1. 새 이미지 빌드 (타임스탬프 태그)
2. 비활성 슬롯에 배포
3. 헬스체크 수행 (최대 60초)
4. Caddy 트래픽 전환
5. 이전 슬롯 정리

### 실행 명령
```bash
cd /opt/nest-api && ./scripts/deploy.sh $1
```

배포 완료 후 결과를 상세히 보고합니다.
