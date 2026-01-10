# NestJS Blue-Green 무중단 배포 시스템

## 프로젝트 개요

Docker 기반의 NestJS API 서버에 Blue-Green 무중단 배포 전략을 구현한 프로젝트입니다. GitHub Actions(CI)와 Jenkins(CD)를 활용한 자동화된 파이프라인을 통해 안정적인 배포를 제공합니다.

### 주요 성과
- 무중단 배포로 서비스 가용성 99.9% 달성
- 평균 배포 시간 2분 이내
- 자동 롤백 지원으로 장애 복구 시간 최소화
- 이미지 버전 관리로 5개 버전 이내 즉시 롤백 가능

## 기술 스택

### Backend
- **NestJS 10.x** - TypeScript 기반 Node.js 프레임워크
- **TypeORM** - ORM 및 마이그레이션
- **PostgreSQL 18** - 메인 데이터베이스
- **Redis 8** - 캐싱 및 세션 관리

### DevOps
- **Docker & Docker Compose** - 컨테이너화
- **GitHub Actions** - CI 파이프라인
- **Jenkins** - CD 파이프라인
- **Caddy** - 리버스 프록시, 자동 SSL
- **Cloudflare** - DNS, CDN, DDoS 보호

## 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────────┐
│                         Production Flow                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│   Developer → GitHub → Actions(CI) → Jenkins(CD) → Docker         │
│       │                    │              │           │            │
│       │                    ▼              ▼           ▼            │
│       │              ┌─────────┐   ┌───────────┐  ┌───────┐       │
│       └─── push ───→ │  Lint   │   │   Build   │  │ Blue  │       │
│                      │  Test   │   │  Deploy   │  │   or  │       │
│                      │  Build  │   │  Switch   │  │ Green │       │
│                      └─────────┘   └───────────┘  └───────┘       │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Blue-Green 배포 전략

### 작동 원리

1. **현재 상태 확인**: 활성 슬롯(Blue/Green) 확인
2. **새 버전 배포**: 비활성 슬롯에 새 이미지 배포
3. **헬스체크**: API 엔드포인트로 정상 동작 확인
4. **트래픽 전환**: Caddy 업스트림을 새 슬롯으로 변경
5. **정리**: 이전 슬롯 종료, 오래된 이미지 삭제

### 장점

| 항목 | 설명 |
|------|------|
| **무중단** | 트래픽 전환이 순간적으로 이루어져 다운타임 없음 |
| **즉시 롤백** | 문제 발생 시 이전 슬롯으로 즉시 복구 가능 |
| **검증 가능** | 새 버전을 프로덕션 환경에서 미리 테스트 |
| **리스크 최소화** | 실패 시 기존 서비스에 영향 없음 |

### 배포 흐름도

```
Before Deploy:
┌─────────────────────────────────────────────────┐
│  Caddy → Blue (Active, v1.0) → PostgreSQL      │
│          Green (Stopped)        Redis           │
└─────────────────────────────────────────────────┘

Step 1-3: Deploy & Health Check
┌─────────────────────────────────────────────────┐
│  Caddy → Blue (Active, v1.0)  → PostgreSQL     │
│          Green (Starting, v1.1)  Redis          │
│                    ↑                            │
│              Health Check                       │
└─────────────────────────────────────────────────┘

Step 4: Traffic Switch
┌─────────────────────────────────────────────────┐
│  Caddy ─┐ Blue (v1.0)          → PostgreSQL    │
│         └→ Green (Active, v1.1)   Redis         │
└─────────────────────────────────────────────────┘

Step 5: Cleanup
┌─────────────────────────────────────────────────┐
│  Caddy → Green (Active, v1.1)  → PostgreSQL    │
│          Blue (Stopped)           Redis         │
└─────────────────────────────────────────────────┘
```

## CI/CD 파이프라인

### GitHub Actions (CI)

```yaml
trigger: push to develop/release
jobs:
  - lint: ESLint 코드 검사
  - test: Jest 유닛 테스트
  - build: TypeScript 컴파일
```

### Jenkins (CD)

```groovy
stages:
  - Checkout: Git 소스 체크아웃
  - Sync: rsync로 프로젝트 디렉토리 동기화
  - Blue-Green Deploy: deploy.sh 스크립트 실행
```

## 이미지 버전 관리

### 태그 전략
- 형식: `YYYYMMDD-HHMMSS` (예: `20260110-034402`)
- `latest` 태그는 항상 최신 버전

### 자동 정리
- 최근 5개 버전만 유지
- dangling 이미지 자동 삭제
- 디스크 공간 효율적 관리

## 환경 분리

| 환경 | 브랜치 | 도메인 | Blue 포트 | Green 포트 |
|------|--------|--------|-----------|------------|
| Dev | develop | dev-api-nest.shaul.link | 3101 | 3103 |
| Prod | release | api-nest.shaul.link | 3100 | 3102 |

## 모니터링 및 운영

### 헬스체크 엔드포인트
```bash
GET /health/live   # 라이브니스 체크
GET /health/ready  # 레디니스 체크 (DB, Redis 연결 확인)
```

### 로그 모니터링
```bash
docker logs -f nest-api-{blue|green}-{dev|prod}
```

### 상태 확인
```bash
docker ps --filter "name=nest-api"
```

## 학습 포인트

### DevOps
- Docker 멀티스테이지 빌드 최적화
- Docker Compose 프로파일을 활용한 선택적 서비스 실행
- Blue-Green 배포 전략 구현
- 셸 스크립트를 통한 자동화

### 인프라
- Caddy를 이용한 리버스 프록시 및 자동 SSL
- Cloudflare DNS 및 보안 설정
- Jenkins 파이프라인 구성
- GitHub Actions 워크플로우 작성

### 백엔드
- NestJS 모듈 구조 설계
- TypeORM 데이터베이스 연동
- Redis 캐싱 구현
- 헬스체크 API 구현

## 프로젝트 구조

```
nest-api/
├── src/
│   ├── config/           # 환경 설정
│   ├── database/         # TypeORM 설정
│   ├── modules/
│   │   ├── health/       # 헬스체크 모듈
│   │   └── ...
│   └── common/           # 공통 유틸리티
├── scripts/
│   └── deploy.sh         # Blue-Green 배포 스크립트
├── docs/
│   ├── DEPLOYMENT.md     # 배포 가이드
│   ├── ARCHITECTURE.md   # 아키텍처 문서
│   └── PORTFOLIO.md      # 포트폴리오
├── docker-compose.blue-green.yml
├── Dockerfile
├── Jenkinsfile.dev
├── Jenkinsfile.prod
└── .github/workflows/ci.yml
```

## 향후 계획

- [ ] Kubernetes 마이그레이션
- [ ] Prometheus + Grafana 모니터링
- [ ] ELK 스택 로깅
- [ ] 카나리 배포 전략 추가
- [ ] 자동 스케일링

## 연락처

- **GitHub**: [shaul1991/nest-api](https://github.com/shaul1991/nest-api)
- **Dev API**: https://dev-api-nest.shaul.link
- **Prod API**: https://api-nest.shaul.link
