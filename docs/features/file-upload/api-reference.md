# 파일 업로드 API Reference

## Base URL

```
/files
```

## Authentication

모든 엔드포인트는 JWT Bearer 토큰이 필요합니다.

```
Authorization: Bearer <access_token>
```

---

## Endpoints

### 1. 단일 파일 업로드

파일을 업로드하고 메타데이터를 반환합니다. 이미지인 경우 썸네일이 자동 생성됩니다.

```http
POST /files/upload
Content-Type: multipart/form-data
```

#### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | 업로드할 파일 |

#### Response (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "originalName": "profile-image.jpg",
  "mimeType": "image/jpeg",
  "size": 1024000,
  "category": "image",
  "status": "completed",
  "hasThumbnail": true,
  "metadata": {
    "width": 1920,
    "height": 1080,
    "format": "jpeg"
  },
  "uploaderId": "550e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2026-01-10T12:00:00.000Z"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_MIME_TYPE | 허용되지 않은 파일 형식 |
| 400 | FILE_TOO_LARGE | 파일 크기 초과 |
| 401 | UNAUTHORIZED | 인증 토큰 없음 |
| 413 | PAYLOAD_TOO_LARGE | 요청 크기 초과 |

---

### 2. 다중 파일 업로드

여러 파일을 한 번에 업로드합니다. (최대 10개)

```http
POST /files/upload/multiple
Content-Type: multipart/form-data
```

#### Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| files | File[] | Yes | 업로드할 파일 배열 |

#### Response (201 Created)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "image1.jpg",
    "mimeType": "image/jpeg",
    "size": 512000,
    "category": "image",
    "hasThumbnail": true,
    "createdAt": "2026-01-10T12:00:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 2048000,
    "category": "document",
    "hasThumbnail": false,
    "createdAt": "2026-01-10T12:00:01.000Z"
  }
]
```

---

### 3. 파일 정보 조회

파일의 메타데이터를 조회합니다.

```http
GET /files/:id
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | 파일 ID |

#### Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "originalName": "profile-image.jpg",
  "mimeType": "image/jpeg",
  "size": 1024000,
  "category": "image",
  "status": "completed",
  "hasThumbnail": true,
  "metadata": {
    "width": 1920,
    "height": 1080,
    "format": "jpeg"
  },
  "uploaderId": "550e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2026-01-10T12:00:00.000Z"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 404 | NOT_FOUND | 파일을 찾을 수 없음 |
| 403 | FORBIDDEN | 접근 권한 없음 |

---

### 4. 파일 다운로드 URL 조회

Pre-signed 다운로드 URL을 생성합니다.

```http
GET /files/:id/download
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | 파일 ID |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| expiresIn | number | 3600 | URL 만료 시간 (초) |

#### Response (200 OK)

```json
{
  "url": "https://minio.example.com/uploads/path/to/file.jpg?X-Amz-...",
  "expiresIn": 3600,
  "expiresAt": "2026-01-10T13:00:00.000Z"
}
```

---

### 5. 썸네일 URL 조회

이미지 썸네일의 Pre-signed URL을 생성합니다.

```http
GET /files/:id/thumbnail
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | 파일 ID |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| size | string | medium | 썸네일 크기 (small, medium) |

#### Response (200 OK)

```json
{
  "url": "https://minio.example.com/thumbnails/path/to/file_medium.webp?X-Amz-...",
  "expiresIn": 3600,
  "expiresAt": "2026-01-10T13:00:00.000Z",
  "size": "medium",
  "dimensions": {
    "width": 400,
    "height": 400
  }
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 404 | NOT_FOUND | 파일을 찾을 수 없음 |
| 400 | NO_THUMBNAIL | 썸네일이 없는 파일 |

---

### 6. 파일 삭제

파일을 삭제합니다. 소유자 또는 관리자만 가능합니다.

```http
DELETE /files/:id
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | 파일 ID |

#### Response (204 No Content)

빈 응답

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 404 | NOT_FOUND | 파일을 찾을 수 없음 |
| 403 | FORBIDDEN | 삭제 권한 없음 |

---

## Data Types

### FileCategory

```typescript
enum FileCategory {
  IMAGE = 'image',
  DOCUMENT = 'document',
  VIDEO = 'video',
  AUDIO = 'audio',
  OTHER = 'other',
}
```

### FileStatus

```typescript
enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
```

---

## Allowed MIME Types

### Images
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

### Documents
- `application/pdf`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### Text
- `text/plain`
- `text/csv`

---

## Size Limits

| Type | Limit |
|------|-------|
| 이미지 | 10 MB |
| 문서 | 50 MB |
| 기본 | 50 MB |
| 다중 업로드 개수 | 10개 |

---

## Rate Limits

| Operation | Limit |
|-----------|-------|
| 업로드 | 10회/분 |
| 다운로드 | 100회/분 |
| 일일 업로드 | 100회/일 |

---

## Example Usage (cURL)

### 파일 업로드

```bash
curl -X POST https://api.example.com/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/image.jpg"
```

### 다중 파일 업로드

```bash
curl -X POST https://api.example.com/files/upload/multiple \
  -H "Authorization: Bearer <token>" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.png"
```

### 파일 정보 조회

```bash
curl -X GET https://api.example.com/files/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

### 다운로드 URL 조회

```bash
curl -X GET "https://api.example.com/files/550e8400-e29b-41d4-a716-446655440000/download?expiresIn=300" \
  -H "Authorization: Bearer <token>"
```

### 파일 삭제

```bash
curl -X DELETE https://api.example.com/files/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```
