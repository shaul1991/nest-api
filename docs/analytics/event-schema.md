# 데이터 수집 이벤트 스키마 정의

## 개요

이 문서는 사용자 활동 로그 수집을 위한 이벤트 스키마를 정의합니다.
DATA-MVP-003 요구사항에 따라 작성되었습니다.

## 공통 필드

모든 이벤트에 포함되는 공통 필드입니다.

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| id | UUID | 자동 | 로그 고유 식별자 |
| userId | UUID | 선택 | 사용자 ID (비로그인 시 null) |
| eventType | string (enum) | 필수 | 이벤트 타입 |
| eventData | JSONB | 선택 | 이벤트별 상세 데이터 |
| ipAddress | string | 선택 | 클라이언트 IP 주소 (IPv4/IPv6) |
| userAgent | string | 선택 | 클라이언트 User-Agent |
| createdAt | timestamp | 자동 | 이벤트 발생 시각 |

## 이벤트 타입

### 1. page_view (페이지 조회)

사용자가 특정 페이지를 조회할 때 발생합니다.

**eventData 구조:**

```json
{
  "path": "/posts/123",
  "referrer": "https://google.com/search?q=...",
  "title": "게시글 제목",
  "queryParams": {
    "utm_source": "google",
    "utm_medium": "cpc"
  }
}
```

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| path | string | 필수 | 페이지 경로 |
| referrer | string | 선택 | 유입 경로 URL |
| title | string | 선택 | 페이지 제목 |
| queryParams | object | 선택 | URL 쿼리 파라미터 |

### 2. post_create (게시글 작성)

사용자가 새 게시글을 작성할 때 발생합니다.

**eventData 구조:**

```json
{
  "postId": "uuid-post-id",
  "title": "게시글 제목",
  "category": "general",
  "tags": ["태그1", "태그2"],
  "contentLength": 1500,
  "hasImages": true,
  "imageCount": 3
}
```

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| postId | UUID | 필수 | 생성된 게시글 ID |
| title | string | 필수 | 게시글 제목 |
| category | string | 선택 | 카테고리 |
| tags | string[] | 선택 | 태그 목록 |
| contentLength | number | 선택 | 본문 길이 (문자 수) |
| hasImages | boolean | 선택 | 이미지 포함 여부 |
| imageCount | number | 선택 | 포함된 이미지 수 |

### 3. post_view (게시글 조회)

사용자가 특정 게시글을 조회할 때 발생합니다.

**eventData 구조:**

```json
{
  "postId": "uuid-post-id",
  "authorId": "uuid-author-id",
  "title": "게시글 제목",
  "source": "list",
  "readTime": 45
}
```

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| postId | UUID | 필수 | 조회한 게시글 ID |
| authorId | UUID | 선택 | 게시글 작성자 ID |
| title | string | 선택 | 게시글 제목 |
| source | string | 선택 | 유입 경로 (list, search, direct, external) |
| readTime | number | 선택 | 읽기 시간 (초) |

### 4. comment_create (댓글 작성)

사용자가 댓글을 작성할 때 발생합니다.

**eventData 구조:**

```json
{
  "commentId": "uuid-comment-id",
  "postId": "uuid-post-id",
  "parentCommentId": null,
  "contentLength": 200,
  "isReply": false
}
```

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| commentId | UUID | 필수 | 생성된 댓글 ID |
| postId | UUID | 필수 | 대상 게시글 ID |
| parentCommentId | UUID | 선택 | 부모 댓글 ID (대댓글인 경우) |
| contentLength | number | 선택 | 댓글 내용 길이 |
| isReply | boolean | 선택 | 대댓글 여부 |

### 5. like (좋아요)

사용자가 좋아요를 누를 때 발생합니다.

**eventData 구조:**

```json
{
  "targetType": "post",
  "targetId": "uuid-target-id",
  "action": "add"
}
```

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| targetType | string | 필수 | 대상 타입 (post, comment) |
| targetId | UUID | 필수 | 대상 ID |
| action | string | 필수 | 액션 타입 (add, remove) |

### 6. bookmark (북마크)

사용자가 북마크를 할 때 발생합니다.

**eventData 구조:**

```json
{
  "targetType": "post",
  "targetId": "uuid-target-id",
  "action": "add",
  "folder": "나중에 읽기"
}
```

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| targetType | string | 필수 | 대상 타입 (post) |
| targetId | UUID | 필수 | 대상 ID |
| action | string | 필수 | 액션 타입 (add, remove) |
| folder | string | 선택 | 북마크 폴더 이름 |

### 7. login (로그인)

사용자가 로그인할 때 발생합니다.

**eventData 구조:**

```json
{
  "method": "email",
  "provider": null,
  "success": true,
  "failureReason": null,
  "mfaUsed": false
}
```

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| method | string | 필수 | 로그인 방식 (email, oauth) |
| provider | string | 선택 | OAuth 제공자 (google, github 등) |
| success | boolean | 필수 | 로그인 성공 여부 |
| failureReason | string | 선택 | 실패 사유 (invalid_password, user_not_found 등) |
| mfaUsed | boolean | 선택 | MFA 사용 여부 |

### 8. logout (로그아웃)

사용자가 로그아웃할 때 발생합니다.

**eventData 구조:**

```json
{
  "reason": "manual",
  "sessionDuration": 3600
}
```

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| reason | string | 선택 | 로그아웃 사유 (manual, timeout, forced) |
| sessionDuration | number | 선택 | 세션 유지 시간 (초) |

## API 사용 예시

### 활동 로그 생성

```http
POST /analytics/logs
Content-Type: application/json

{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "post_view",
  "eventData": {
    "postId": "123e4567-e89b-12d3-a456-426614174000",
    "title": "NestJS 시작하기",
    "source": "search"
  },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

### DAU 조회

```http
GET /analytics/dau?date=2025-01-14
```

응답:
```json
{
  "success": true,
  "data": {
    "date": "2025-01-14",
    "activeUsers": 1523
  }
}
```

### MAU 조회

```http
GET /analytics/mau?month=2025-01
```

응답:
```json
{
  "success": true,
  "data": {
    "month": "2025-01",
    "activeUsers": 15230
  }
}
```

## 데이터 수집 가이드라인

### 개인정보 보호

1. 민감한 개인정보(비밀번호, 신용카드 번호 등)는 eventData에 포함하지 않습니다.
2. IP 주소는 분석 목적으로만 사용하며, 지정된 보관 기간 후 익명화합니다.
3. 사용자 동의 없이 추적 데이터를 수집하지 않습니다.

### 데이터 품질

1. eventType은 정의된 enum 값만 사용합니다.
2. eventData는 해당 이벤트 타입의 스키마를 준수해야 합니다.
3. 타임스탬프는 UTC 기준으로 저장됩니다.

### 성능 고려사항

1. 대량의 로그 생성 시 벌크 인서트를 사용합니다.
2. 오래된 로그는 주기적으로 아카이빙하거나 삭제합니다.
3. 인덱스는 자주 조회되는 필드에만 적용합니다.

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2025-01-14 | 초기 버전 작성 |
