# Staging 환경 구성

## 개요

nest-api 프로젝트의 스테이징 환경 구성입니다. Blue-Green 배포를 지원하며, 운영 환경과 유사한 테스트 환경을 제공합니다.

## 파일 구조

```
docker/staging/
├── docker-compose.staging.yml   # Docker Compose 설정
├── .env.staging.example         # 환경 변수 예시
├── deploy-staging.sh            # 배포 스크립트
└── README.md                    # 이 문서
```

## 포트 스키마

| 서비스 | 포트 | 설명 |
|--------|------|------|
| App Blue | 3200 | Blue 슬롯 |
| App Green | 3201 | Green 슬롯 |
| PostgreSQL | 5434 | 스테이징 DB |
| Redis | 6381 | 스테이징 캐시 |
| MinIO API | 9002 | 오브젝트 스토리지 |
| MinIO Console | 9003 | MinIO 관리 콘솔 |

## 빠른 시작

### 1. 환경 변수 설정

```bash
cd docker/staging
cp .env.staging.example .env.staging
# .env.staging 파일을 편집하여 필요한 값 설정
```

### 2. 인프라 서비스 시작

```bash
./deploy-staging.sh start-infra
```

### 3. 애플리케이션 배포

```bash
# 이미지 빌드 없이 배포 (기존 이미지 사용)
./deploy-staging.sh deploy

# 이미지 빌드 후 배포
BUILD_IMAGE=true ./deploy-staging.sh deploy
```

### 4. 상태 확인

```bash
./deploy-staging.sh status
```

## Blue-Green 배포

### 배포 프로세스

1. **현재 상태 확인**: 활성 슬롯 확인 (blue 또는 green)
2. **새 슬롯 배포**: 비활성 슬롯에 새 버전 배포
3. **헬스체크**: 새 슬롯의 정상 동작 확인
4. **트래픽 전환**: 활성 슬롯 전환
5. **이전 슬롯 정리**: 이전 슬롯 중지 (선택적)

### 배포 명령어

```bash
# 기본 배포
./deploy-staging.sh deploy

# 이미지 빌드 포함
BUILD_IMAGE=true ./deploy-staging.sh deploy

# 이전 슬롯 유지 (롤백 용도)
STOP_OLD_SLOT=false ./deploy-staging.sh deploy
```

### 롤백

```bash
./deploy-staging.sh rollback
```

## Docker Compose 직접 사용

```bash
# Blue 슬롯만 시작
docker compose -p nest-api-staging \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  --profile blue \
  up -d

# Green 슬롯만 시작
docker compose -p nest-api-staging \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  --profile green \
  up -d

# 인프라만 시작
docker compose -p nest-api-staging \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  --profile infra \
  up -d

# 모든 서비스 중지
docker compose -p nest-api-staging \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  down
```

## 헬스체크

```bash
# Blue 슬롯
curl http://localhost:3200/health/live
curl http://localhost:3200/health/ready

# Green 슬롯
curl http://localhost:3201/health/live
curl http://localhost:3201/health/ready
```

## 로그 확인

```bash
# Blue 슬롯 로그
docker logs -f nest-api-staging-app-blue-1

# Green 슬롯 로그
docker logs -f nest-api-staging-app-green-1

# PostgreSQL 로그
docker logs -f nest-api-staging-postgres-staging-1

# Redis 로그
docker logs -f nest-api-staging-redis-staging-1
```

## Caddy 리버스 프록시 설정 예시

```
staging-api-nest.shaul.link {
    # Blue-Green 전환 (활성 슬롯에 따라 변경)
    reverse_proxy localhost:3200  # Blue 활성 시
    # reverse_proxy localhost:3201  # Green 활성 시

    # 자동 HTTPS
    tls {
        protocols tls1.2 tls1.3
    }
}
```

## 데이터베이스 마이그레이션

스테이징 환경에서는 별도의 데이터베이스를 사용합니다:

```bash
# 스테이징 DB 접속
docker exec -it nest-api-staging-postgres-staging-1 psql -U nestjs -d nest_api_staging

# 마이그레이션 실행 (앱 컨테이너에서)
docker exec -it nest-api-staging-app-blue-1 npm run migration:run
```

## 주의사항

1. **운영 환경과 격리**: 스테이징은 별도의 포트와 데이터베이스를 사용합니다.
2. **비밀번호**: `.env.staging` 파일은 Git에 포함하지 마세요.
3. **리소스**: 스테이징 환경은 운영 환경보다 적은 리소스를 사용할 수 있습니다.
4. **테스트 데이터**: 스테이징 DB에는 테스트 데이터만 저장하세요.
