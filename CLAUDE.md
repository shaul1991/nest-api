# NestJS API 프로젝트 지침

## 프로젝트 개요
NestJS 기반 API 서버로, Blue-Green 무중단 배포를 지원합니다.

## 환경
- **개발 서버**: https://dev-api-nest.shaul.link (develop 브랜치)
- **운영 서버**: https://api-nest.shaul.link (release 브랜치)
- **GitHub**: https://github.com/shaul1991/nest-api

## 기술 스택
- Node.js 22, NestJS 10.x, TypeScript
- PostgreSQL 18, Redis 8
- Docker, Docker Compose
- Jenkins (CD), GitHub Actions (CI)
- Caddy (Reverse Proxy)

## 디렉토리 구조
```
/opt/projects/nest-api/
├── src/                    # 소스 코드
├── scripts/deploy.sh       # Blue-Green 배포 스크립트
├── docker-compose.blue-green.yml
├── Jenkinsfile.dev         # Dev CI/CD
├── Jenkinsfile.prod        # Prod CI/CD
├── .env.dev                # Dev 환경변수
└── .env.production         # Prod 환경변수
```

## 배포 명령어

### Dev 환경 배포
```bash
cd /opt/projects/nest-api && ./scripts/deploy.sh dev
```

### Prod 환경 배포
```bash
cd /opt/projects/nest-api && ./scripts/deploy.sh prod
```

## 컨테이너 관리

### 상태 확인
```bash
docker ps --filter "name=nest-api"
```

### 로그 확인
```bash
# Dev (컨테이너 이름은 자동 생성됨)
docker logs -f nest-api-dev-app-blue-1
docker logs -f nest-api-dev-app-green-1

# Prod
docker logs -f nest-api-prod-app-blue-1
docker logs -f nest-api-prod-app-green-1
```

### 활성 슬롯 확인
```bash
cat /opt/projects/nest-api/.active-slot-dev   # Dev
cat /opt/projects/nest-api/.active-slot-prod  # Prod
```

## 헬스체크
```bash
# Dev
curl https://dev-api-nest.shaul.link/health/live

# Prod
curl https://api-nest.shaul.link/health/live
```

## 이미지 관리
```bash
# 이미지 목록
docker images nest-api

# 수동 정리 (최근 5개 유지)
docker images nest-api --format "{{.Tag}}" | grep -v latest | sort -r | tail -n +6 | xargs -I {} docker rmi nest-api:{}
```

## Git 브랜치 전략
- `develop`: 개발 환경 자동 배포
- `release`: 운영 환경 자동 배포
- `main`: 보관용 (배포 안함)

## 주의사항
- 환경변수 파일(.env.*)은 Git에 포함되지 않음
- 배포 전 반드시 헬스체크 통과 확인
- 롤백 시 이전 슬롯의 이미지가 필요함

## 관련 문서
- [배포 가이드](docs/DEPLOYMENT.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [포트폴리오](docs/PORTFOLIO.md)
