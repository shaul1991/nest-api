---
name: nestjs-deploy
description: NestJS Blue-Green 배포 관리. 배포, 롤백, 상태 확인, 트러블슈팅을 지원합니다. 배포 관련 질문이나 작업 요청 시 사용합니다.
allowed-tools: Bash(docker:*), Bash(curl:*), Bash(./scripts/deploy.sh:*), Bash(systemctl:*), Bash(cat:*), Read, Grep
---

# NestJS Blue-Green 배포 관리

## 개요

이 Skill은 NestJS API 서버의 Blue-Green 무중단 배포를 관리합니다.

## 환경 정보

| 환경 | 도메인 | Blue 포트 | Green 포트 |
|------|--------|-----------|------------|
| Dev | dev-api-nest.shaul.link | 3101 | 3103 |
| Prod | api-nest.shaul.link | 3100 | 3102 |

## 주요 작업

### 배포
```bash
cd /opt/nest-api && ./scripts/deploy.sh [dev|prod]
```

### 상태 확인
```bash
# 컨테이너 상태
docker ps --filter "name=nest-api"

# 활성 슬롯
cat /opt/nest-api/.active-slot-[dev|prod]

# 헬스체크
curl https://[dev-]api-nest.shaul.link/health/live
```

### 로그 확인
```bash
docker logs nest-api-[blue|green]-[dev|prod] --tail 100
```

### 롤백
1. 이전 슬롯 컨테이너 시작
2. 헬스체크 확인
3. Caddy 업스트림 변경
4. 상태 파일 업데이트

## 트러블슈팅

자세한 내용은 [TROUBLESHOOTING.md](TROUBLESHOOTING.md) 참조
