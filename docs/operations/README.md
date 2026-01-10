# 운영/배포 문서

배포 및 운영 관련 문서입니다.

## 문서 목록

| 문서 | 설명 |
|------|------|
| [배포 가이드](./deployment-guide.md) | Blue-Green 무중단 배포 가이드 |
| [배포 체크리스트](./deployment-checklist.md) | 인증 모듈 배포 전 확인 사항 |

## 환경별 엔드포인트

| 환경 | URL | 포트 (Blue/Green) |
|------|-----|-------------------|
| Local | http://localhost:3000 | 3000 |
| Dev | https://dev-api-nest.shaul.link | 3101 / 3103 |
| Prod | https://api-nest.shaul.link | 3100 / 3102 |

## 배포 명령어

```bash
# 개발 환경 배포
./scripts/deploy.sh dev

# 프로덕션 환경 배포
./scripts/deploy.sh prod

# 롤백
./scripts/deploy.sh dev rollback
```

## 필수 환경 변수

```env
# JWT (필수)
JWT_SECRET=<32바이트 이상>
JWT_REFRESH_SECRET=<32바이트 이상>

# 데이터베이스
DATABASE_HOST=
DATABASE_PORT=5432
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=

# Redis
REDIS_HOST=
REDIS_PORT=6379
```
