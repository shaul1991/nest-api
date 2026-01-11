# 파일 업로드 기능 구현 계획

## 개요

이 문서는 파일 업로드 기능 구현을 위한 팀별 상세 계획을 정리합니다.

---

## 1. Backend 계획

### 1.1 필요 패키지 설치

```bash
npm install minio sharp file-type uuid
npm install -D @types/multer
```

### 1.2 모듈 구조

```
src/files/
├── files.module.ts
├── files.controller.ts
├── files.service.ts
├── services/
│   ├── storage.service.ts
│   └── image.service.ts
├── entities/
│   └── file.entity.ts
├── dto/
│   ├── upload-file.dto.ts
│   ├── file-response.dto.ts
│   └── download-url-response.dto.ts
├── interfaces/
│   └── file-metadata.interface.ts
├── constants/
│   └── file.constants.ts
├── pipes/
│   └── file-validation.pipe.ts
└── guards/
    └── file-access.guard.ts
```

### 1.3 데이터베이스 스키마

```sql
CREATE TYPE file_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE file_category AS ENUM ('image', 'document', 'video', 'audio', 'other');

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  thumbnail_path VARCHAR(500),
  thumbnail_path_small VARCHAR(500),
  bucket VARCHAR(100) NOT NULL DEFAULT 'files',
  status file_status NOT NULL DEFAULT 'completed',
  category file_category NOT NULL DEFAULT 'other',
  is_public BOOLEAN DEFAULT false,
  metadata JSONB,
  checksum VARCHAR(64),
  uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_files_uploader_id ON files(uploader_id);
CREATE INDEX idx_files_category ON files(category);
CREATE INDEX idx_files_created_at ON files(created_at);
```

### 1.4 구현 순서

1. File 엔티티 생성
2. storage.config.ts 추가
3. StorageService (MinIO 연동)
4. ImageService (Sharp 썸네일)
5. FilesService (비즈니스 로직)
6. FilesController (API 엔드포인트)
7. FileValidationPipe (보안 검증)
8. FilesModule 구성

---

## 2. DevOps 계획

### 2.1 MinIO Docker 설정

`docker-compose.infra.yml`에 추가:

```yaml
minio:
  image: minio/minio:RELEASE.2024-12-18T13-15-44Z
  container_name: nest-api-minio-${ENV:-prod}
  restart: unless-stopped
  command: server /data --console-address ":9001"
  ports:
    - "${MINIO_API_PORT:-9000}:9000"
    - "${MINIO_CONSOLE_PORT:-9001}:9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
  volumes:
    - minio_data_${ENV:-prod}:/data
  networks:
    - nest-api-network
  healthcheck:
    test: ["CMD", "mc", "ready", "local"]
    interval: 30s
    timeout: 10s
    retries: 5

minio-init:
  image: minio/mc:latest
  depends_on:
    minio:
      condition: service_healthy
  entrypoint: >
    /bin/sh -c "
    mc alias set myminio http://minio:9000 $${MINIO_ROOT_USER} $${MINIO_ROOT_PASSWORD};
    mc mb --ignore-existing myminio/$${MINIO_BUCKET_NAME:-uploads};
    mc anonymous set download myminio/$${MINIO_BUCKET_NAME:-uploads}/public;
    "
  networks:
    - nest-api-network
  restart: "no"
```

### 2.2 환경 변수

#### .env.dev
```bash
# MinIO (Dev)
MINIO_ENDPOINT=host.docker.internal
MINIO_API_PORT=9010
MINIO_CONSOLE_PORT=9011
MINIO_ROOT_USER=dev-minio-admin
MINIO_ROOT_PASSWORD=dev_secure_password_32chars!
MINIO_BUCKET_NAME=uploads-dev
MINIO_USE_SSL=false
```

#### .env.production
```bash
# MinIO (Production)
MINIO_ENDPOINT=host.docker.internal
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER=prod-minio-admin
MINIO_ROOT_PASSWORD=prod_very_secure_password_64chars!
MINIO_BUCKET_NAME=uploads
MINIO_USE_SSL=true
```

### 2.3 버킷 구조

```
uploads/
├── public/           # 공개 접근 허용
│   ├── avatars/
│   └── posts/
├── private/          # 인증 필요
│   ├── documents/
│   └── exports/
└── temp/             # 임시 (30일 자동 삭제)
```

### 2.4 Caddy 설정 추가

```caddyfile
# MinIO Console
minio.shaul.link {
    reverse_proxy localhost:9001
}

# MinIO API (CDN)
cdn.shaul.link {
    reverse_proxy localhost:9000
    header Cache-Control "public, max-age=31536000"
}
```

### 2.5 배포 순서

```bash
# 1. 디렉토리 생성
sudo mkdir -p /opt/data/minio/{prod,dev}
sudo chown -R 1000:1000 /opt/data/minio

# 2. 인프라 재배포
docker compose -p nest-api-infra-dev \
  -f docker-compose.infra.yml \
  --env-file .env.dev up -d

# 3. App 배포
./scripts/deploy.sh dev
```

---

## 3. QA 계획

### 3.1 테스트 파일 구조

```
src/files/
├── files.service.spec.ts
├── services/
│   ├── storage.service.spec.ts
│   └── image.service.spec.ts
test/
├── integration/
│   └── files.controller.integration-spec.ts
└── files.e2e-spec.ts
```

### 3.2 테스트 케이스

#### 정상 케이스
| 케이스 | 예상 결과 |
|--------|----------|
| JPEG 이미지 업로드 | 성공, 썸네일 생성 |
| PNG 이미지 업로드 | 성공, 썸네일 생성 |
| PDF 문서 업로드 | 성공, 썸네일 없음 |
| 다중 파일 업로드 (5개) | 모두 성공 |
| 파일 정보 조회 | 메타데이터 반환 |
| 다운로드 URL 조회 | Pre-signed URL 반환 |
| 파일 삭제 (소유자) | 성공 |

#### 경계 케이스
| 케이스 | 예상 결과 |
|--------|----------|
| 10MB 이미지 | 성공 |
| 10MB 초과 이미지 | 400 에러 |
| 빈 파일 (0 bytes) | 400 에러 |
| 10개 동시 업로드 | 성공 |
| 11개 동시 업로드 | 400 에러 |
| 특수문자 파일명 | 안전하게 변환 |

#### 에러 케이스
| 케이스 | 예상 결과 |
|--------|----------|
| .exe 파일 업로드 | 400 에러 |
| 위장된 MIME 타입 | 400 에러 (Magic Number 검증) |
| 인증 없이 업로드 | 401 에러 |
| 다른 사용자 파일 삭제 | 403 에러 |
| 존재하지 않는 파일 조회 | 404 에러 |

### 3.3 테스트 실행 명령

```bash
# 단위 테스트
npm run test:unit -- --testPathPattern=files

# 통합 테스트
npm run test:integration -- --testPathPattern=files

# E2E 테스트
npm run test:e2e -- --testPathPattern=files

# 전체 + 커버리지
npm run test:cov
```

---

## 4. Security 계획

### 4.1 필수 보안 체크리스트

| 항목 | 우선순위 | 구현 방법 |
|------|----------|----------|
| Magic Number 검증 | Critical | file-type 라이브러리 |
| 확장자 화이트리스트 | Critical | FileValidationPipe |
| 파일 크기 제한 | High | Multer 옵션 |
| Rate Limiting | High | ThrottlerGuard |
| Path Traversal 방지 | Critical | 경로 정규화 |
| EXIF 데이터 제거 | High | Sharp rotate() |
| Pre-signed URL | High | MinIO SDK |
| 접근 권한 검증 | Critical | FileAccessGuard |

### 4.2 Magic Number 검증

```typescript
const FILE_SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};
```

### 4.3 파일명 Sanitization

```typescript
function sanitizeFilename(filename: string): string {
  return path.basename(filename)
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .substring(0, 255);
}
```

### 4.4 SVG 정책

**SVG 파일 업로드 차단** (XSS 위험)

허용 시 필수 검증:
- `<script>` 태그 차단
- `javascript:` URL 차단
- `on*` 이벤트 핸들러 차단
- 외부 리소스 참조 차단

---

## 5. 구현 일정 (예상)

### Phase 1: 기반 구축
- [ ] File 엔티티 및 마이그레이션
- [ ] MinIO Docker 설정
- [ ] StorageService 구현
- [ ] ImageService 구현

### Phase 2: API 구현
- [ ] FilesService 구현
- [ ] FilesController 구현
- [ ] FileValidationPipe 구현
- [ ] FileAccessGuard 구현

### Phase 3: 테스트 및 문서화
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 작성
- [ ] E2E 테스트 작성
- [ ] Swagger 문서 보강

### Phase 4: 배포
- [ ] Dev 환경 배포 및 테스트
- [ ] Prod 환경 배포
- [ ] 모니터링 설정

---

## 6. 참고 자료

- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)
- [MinIO JavaScript SDK](https://min.io/docs/minio/linux/developers/javascript/minio-javascript.html)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
