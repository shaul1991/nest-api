# 트러블슈팅 가이드

## 헬스체크 실패

### 증상
- 배포 스크립트가 헬스체크 단계에서 실패
- `curl http://localhost:{port}/health/live` 응답 없음

### 해결 방법
1. 컨테이너 로그 확인
   ```bash
   docker logs nest-api-[slot]-[env] --tail 100
   ```

2. 데이터베이스 연결 확인
   ```bash
   docker exec nest-api-postgres-[env] pg_isready -U nest_api
   ```

3. Redis 연결 확인
   ```bash
   docker exec nest-api-redis-[env] redis-cli ping
   ```

4. 환경 변수 확인
   ```bash
   cat /opt/nest-api/.env.[dev|production]
   ```

## 포트 충돌

### 증상
- 컨테이너 시작 실패
- "port is already allocated" 에러

### 해결 방법
1. 사용 중인 포트 확인
   ```bash
   ss -tlnp | grep -E "3100|3101|3102|3103"
   ```

2. 기존 컨테이너 정리
   ```bash
   docker ps -a --filter "name=nest-api" -q | xargs docker rm -f
   ```

## Caddy 리로드 실패

### 증상
- 배포 후 트래픽 전환 실패
- 502 Bad Gateway 에러

### 해결 방법
1. Caddyfile 검증
   ```bash
   caddy validate --config /etc/caddy/Caddyfile
   ```

2. 권한 확인 및 수정
   ```bash
   chmod 644 /etc/caddy/Caddyfile
   ```

3. Caddy 수동 리로드
   ```bash
   systemctl reload caddy
   ```

## 이미지 빌드 실패

### 증상
- docker build 실패
- npm ci 또는 npm run build 에러

### 해결 방법
1. 로컬에서 빌드 테스트
   ```bash
   npm ci && npm run build
   ```

2. Dockerfile 확인
   ```bash
   cat /opt/nest-api/Dockerfile
   ```

3. 디스크 공간 확인
   ```bash
   df -h
   docker system df
   ```

## 롤백 절차

### 긴급 롤백 (슬롯 전환)
```bash
# 1. 현재 상태 확인
cat /opt/nest-api/.active-slot-[env]

# 2. 이전 슬롯 결정 (blue ↔ green)
CURRENT_SLOT=$(cat /opt/nest-api/.active-slot-[env])
TARGET_SLOT=$([[ "$CURRENT_SLOT" == "blue" ]] && echo "green" || echo "blue")

# 3. 이전 슬롯 시작
docker compose -p "nest-api-[env]" -f docker-compose.blue-green.yml \
  --env-file .env.[dev|production] --profile $TARGET_SLOT up -d

# 4. 헬스체크
curl http://localhost:[port]/health/live

# 5. Caddy 업데이트 (수동)
# /etc/caddy/Caddyfile에서 포트 변경 후
systemctl reload caddy

# 6. 상태 파일 업데이트
echo "$TARGET_SLOT" > /opt/nest-api/.active-slot-[env]
```

### 특정 버전으로 롤백
```bash
# 사용 가능한 이미지 확인
docker images nest-api --format "table {{.Tag}}\t{{.CreatedAt}}"

# 특정 버전으로 배포
export IMAGE_TAG=20260110-034313
./scripts/deploy.sh [dev|prod]
```
