# 파일 업로드 기능

## 개요

MinIO 오브젝트 스토리지를 활용한 파일 업로드 및 관리 기능입니다.
이미지 업로드 시 썸네일이 자동 생성됩니다.

## 기능 요약

| 항목 | 내용 |
|------|------|
| **우선순위** | 높음 (High) |
| **스토리지** | MinIO (S3 호환) |
| **썸네일** | Sharp 라이브러리 (WebP 포맷) |
| **인증** | JWT 토큰 필수 |

## 주요 기능

### 1. 파일 업로드
- 단일/다중 파일 업로드 (최대 10개)
- 지원 형식: JPEG, PNG, GIF, WebP, PDF
- 최대 파일 크기: 이미지 10MB, 문서 50MB

### 2. 이미지 썸네일
- 자동 생성: Small (200x200), Medium (400x400)
- 포맷: WebP (고압축, 고품질)
- EXIF 데이터 자동 제거 (개인정보 보호)

### 3. 파일 관리
- 메타데이터 조회
- Pre-signed URL 다운로드
- 소유자/관리자 삭제

## 기술 스택

```
┌─────────────────────────────────────────────────────────┐
│                      FilesModule                         │
├─────────────────────────────────────────────────────────┤
│  Controller ──► Service ──┬──► StorageService (MinIO)   │
│                           └──► ImageService (Sharp)      │
└─────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        ┌──────────┐                   ┌──────────────┐
        │  MinIO   │                   │  PostgreSQL  │
        │ (Storage)│                   │  (Metadata)  │
        └──────────┘                   └──────────────┘
```

## 관련 문서

- [API Reference](./api-reference.md)
- [Implementation Plan](./implementation-plan.md)

## 디렉토리 구조

```
src/files/
├── files.module.ts
├── files.controller.ts
├── files.service.ts
├── services/
│   ├── storage.service.ts      # MinIO 연동
│   └── image.service.ts        # Sharp 이미지 처리
├── entities/
│   └── file.entity.ts
├── dto/
│   ├── upload-file.dto.ts
│   ├── file-response.dto.ts
│   └── download-url-response.dto.ts
├── interfaces/
│   ├── storage.interface.ts
│   └── file-metadata.interface.ts
├── constants/
│   └── file.constants.ts
├── pipes/
│   └── file-validation.pipe.ts
└── guards/
    └── file-access.guard.ts
```

## 환경 변수

```bash
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=your_secure_password
MINIO_BUCKET_NAME=uploads
MINIO_USE_SSL=false
```

## 보안 고려사항

1. **Magic Number 검증**: 파일 시그니처 기반 MIME 타입 검증
2. **확장자 화이트리스트**: 허용된 확장자만 업로드 가능
3. **Path Traversal 방지**: 파일 경로 정규화 및 검증
4. **Pre-signed URL**: 시간 제한 다운로드 링크
5. **EXIF 제거**: 이미지 메타데이터 자동 제거

## 작성일

- **계획 수립**: 2026-01-10
- **작성자**: New Feature Orchestrator
