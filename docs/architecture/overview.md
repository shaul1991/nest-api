# 시스템 아키텍처

## 전체 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Internet                                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                           Cloudflare (DNS/CDN)                               │
│  dev-api-nest.shaul.link    │    api-nest.shaul.link                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                        Caddy (Reverse Proxy + SSL)                           │
│                            Port 80/443                                       │
└────────────┬────────────────────────────────────────────────┬───────────────┘
             │                                                │
     ┌───────▼───────┐                                ┌───────▼───────┐
     │  Dev Network  │                                │ Prod Network  │
     │ nest-api-dev  │                                │ nest-api-prod │
     └───────┬───────┘                                └───────┬───────┘
             │                                                │
    ┌────────┴────────┐                              ┌────────┴────────┐
    │                 │                              │                 │
┌───▼───┐        ┌───▼───┐                      ┌───▼───┐        ┌───▼───┐
│ Blue  │        │ Green │                      │ Blue  │        │ Green │
│ :3102 │        │ :3103 │                      │ :3100 │        │ :3101 │
└───┬───┘        └───┬───┘                      └───┬───┘        └───┬───┘
    │                │                              │                │
    └────────┬───────┘                              └────────┬───────┘
             │                                                │
    ┌────────▼────────┐                              ┌────────▼────────┐
    │   PostgreSQL    │                              │   PostgreSQL    │
    │     :5435       │                              │     :5434       │
    ├─────────────────┤                              ├─────────────────┤
    │     Redis       │                              │     Redis       │
    │     :6382       │                              │     :6381       │
    └─────────────────┘                              └─────────────────┘
```

## 기술 스택

### 애플리케이션
| 구성 요소 | 기술 | 버전 |
|-----------|------|------|
| Framework | NestJS | 10.x |
| Runtime | Node.js | 22 |
| Language | TypeScript | 5.x |
| ORM | TypeORM | 0.3.x |
| Cache | Redis | 8 (Alpine) |
| Database | PostgreSQL | 18 (Alpine) |

### 인프라
| 구성 요소 | 기술 | 용도 |
|-----------|------|------|
| Container | Docker | 컨테이너화 |
| Orchestration | Docker Compose | 멀티 컨테이너 관리 |
| Reverse Proxy | Caddy | SSL 자동화, 프록시 |
| DNS/CDN | Cloudflare | DNS 관리, DDoS 방어 |
| CI | GitHub Actions | 코드 검증 |
| CD | Jenkins | 자동 배포 |

## 배포 파이프라인

### CI (GitHub Actions)

```yaml
develop branch → lint → test → build → (성공)
     ↓
   push
     ↓
Jenkins webhook trigger
```

### CD (Jenkins)

```
┌─────────────────────────────────────────────────────────────┐
│                      Jenkins Pipeline                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐   ┌─────────┐   ┌─────────────────────────┐   │
│  │Checkout │ → │  Sync   │ → │   Blue-Green Deploy     │   │
│  │  Code   │   │  Files  │   │                         │   │
│  └─────────┘   └─────────┘   │ 1. Build Image          │   │
│                              │ 2. Deploy to Target     │   │
│                              │ 3. Health Check         │   │
│                              │ 4. Switch Traffic       │   │
│                              │ 5. Cleanup Old Slot     │   │
│                              │ 6. Prune Old Images     │   │
│                              └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 브랜치 전략

```
main ─────────────────────────────────────────────────────────
                                   (보관용, 배포 안함)

release ────●────●────●────●────●────●────●──────────────────
            │    │    │    │    │    │    │
            │    └────┴────┴────┴────┴────┘
            │              ↑
            │         merge from develop
            │              │
develop ────●────●────●────●────●────●────●────●─────────────
            │    │    │    │    │    │    │    │
          feat feat fix  feat feat fix  feat feat

[develop] → Dev 환경 자동 배포 (dev-api-nest.shaul.link)
[release] → Prod 환경 자동 배포 (api-nest.shaul.link)
```

## 환경 구성

### 환경 변수

| 변수 | 설명 | Dev | Prod |
|------|------|-----|------|
| NODE_ENV | 실행 환경 | development | production |
| DATABASE_HOST | DB 호스트 | postgres | postgres |
| DATABASE_PORT | DB 포트 | 5432 | 5432 |
| DATABASE_NAME | DB 이름 | nest_api_dev | nest_api |
| REDIS_HOST | Redis 호스트 | redis | redis |
| REDIS_PORT | Redis 포트 | 6379 | 6379 |

### 볼륨 구성

```
Docker Volumes:
├── nest-api-dev_postgres_data    # Dev PostgreSQL 데이터
├── nest-api-dev_redis_data       # Dev Redis 데이터
├── nest-api-prod_postgres_data   # Prod PostgreSQL 데이터
└── nest-api-prod_redis_data      # Prod Redis 데이터
```

## 보안

### 네트워크 격리
- Dev/Prod 환경 별도 Docker 네트워크
- 데이터베이스는 내부 네트워크에서만 접근 가능
- 외부 접근은 Caddy를 통해서만 허용

### SSL/TLS
- Cloudflare: Edge 인증서 (Full Strict 모드)
- Caddy: Let's Encrypt 자동 발급

### 민감 정보 관리
- 환경 변수 파일 (.env.*) Git 제외
- 비밀번호는 환경별 별도 관리
