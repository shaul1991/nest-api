# Blue-Green 무중단 배포 가이드

## 개요

이 프로젝트는 Blue-Green 배포 전략을 사용하여 무중단 배포를 구현합니다. 배포 시 새로운 버전을 비활성 슬롯에 배포하고, 헬스체크 통과 후 트래픽을 전환합니다.

## 아키텍처

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │    (DNS/CDN)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Caddy       │
                    │ (Reverse Proxy) │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼──────┐ ┌───────▼──────┐ ┌───────▼──────┐
    │  Blue Slot   │ │ Green Slot   │ │   Database   │
    │  (Active)    │ │  (Standby)   │ │  PostgreSQL  │
    │  Port 3100   │ │  Port 3101   │ │    Redis     │
    └──────────────┘ └──────────────┘ └──────────────┘
```

## 환경별 포트 구성

| 환경 | Blue 포트 | Green 포트 | 도메인 |
|------|-----------|------------|--------|
| Prod | 3100 | 3101 | api-nest.shaul.link |
| Dev | 3102 | 3103 | dev-api-nest.shaul.link |

## 배포 프로세스

### 1. 이미지 빌드
```bash
docker build -t nest-api:20260110-034402 -t nest-api:latest .
```
- 타임스탬프 기반 태그 생성 (YYYYMMDD-HHMMSS)
- `latest` 태그도 동시에 업데이트

### 2. 슬롯 결정
```bash
# 현재 활성 슬롯 확인
cat /opt/nest-api/.active-slot-{env}

# 비활성 슬롯에 배포
# blue → green, green → blue
```

### 3. 컨테이너 배포
```bash
docker compose -p "nest-api-{env}" \
  -f docker-compose.blue-green.yml \
  --env-file .env.{env} \
  --profile {target_slot} up -d
```

### 4. 헬스체크
```bash
# 최대 30회 시도 (60초 대기)
curl -sf http://localhost:{port}/health/live
```

### 5. 트래픽 전환
```bash
# Caddy 설정 업데이트
sed -i "s/localhost:[0-9]*/localhost:{new_port}/" /etc/caddy/Caddyfile
systemctl reload caddy
```

### 6. 이전 슬롯 정리
```bash
docker compose -p "nest-api-{env}" \
  --profile {old_slot} down
```

### 7. 이미지 정리
- 최근 5개 이미지만 유지
- dangling 이미지 자동 정리

## 수동 배포

### Dev 환경
```bash
cd /opt/nest-api
./scripts/deploy.sh dev
```

### Production 환경
```bash
cd /opt/nest-api
./scripts/deploy.sh prod
```

## 롤백

### 빠른 롤백 (슬롯 전환)
```bash
# 1. 이전 슬롯 시작
docker compose -p "nest-api-{env}" \
  -f docker-compose.blue-green.yml \
  --env-file .env.{env} \
  --profile {previous_slot} up -d

# 2. Caddy 업스트림 변경
# 이전 슬롯의 포트로 변경 후 reload

# 3. 상태 파일 업데이트
echo "{previous_slot}" > .active-slot-{env}
```

### 특정 버전으로 롤백
```bash
# 사용 가능한 이미지 확인
docker images nest-api --format "table {{.Tag}}\t{{.CreatedAt}}"

# 특정 버전으로 배포
export IMAGE_TAG=20260110-034313
./scripts/deploy.sh {env}
```

## 모니터링

### 컨테이너 상태 확인
```bash
docker ps --filter "name=nest-api" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### 로그 확인
```bash
# Dev 환경
docker logs nest-api-blue-dev -f
docker logs nest-api-green-dev -f

# Prod 환경
docker logs nest-api-blue-prod -f
docker logs nest-api-green-prod -f
```

### 헬스체크
```bash
# Dev
curl https://dev-api-nest.shaul.link/health/live

# Prod
curl https://api-nest.shaul.link/health/live
```

## 트러블슈팅

### 헬스체크 실패
1. 컨테이너 로그 확인
2. 데이터베이스 연결 확인
3. 환경 변수 확인

### 포트 충돌
```bash
# 사용 중인 포트 확인
ss -tlnp | grep -E "3100|3101|3102|3103"

# 기존 컨테이너 정리
docker ps -a --filter "name=nest-api" -q | xargs docker rm -f
```

### Caddy 리로드 실패
```bash
# 설정 검증
caddy validate --config /etc/caddy/Caddyfile

# 권한 확인
ls -la /etc/caddy/Caddyfile
chmod 644 /etc/caddy/Caddyfile
```

## 관련 파일

| 파일 | 설명 |
|------|------|
| `docker-compose.blue-green.yml` | Blue-Green 슬롯 정의 |
| `scripts/deploy.sh` | 자동 배포 스크립트 |
| `Jenkinsfile.dev` | Dev 환경 CI/CD 파이프라인 |
| `Jenkinsfile.prod` | Prod 환경 CI/CD 파이프라인 |
| `.active-slot-dev` | Dev 활성 슬롯 상태 |
| `.active-slot-prod` | Prod 활성 슬롯 상태 |
