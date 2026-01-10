# API Reference

## 인증 API (Authentication)

### POST /auth/register

새 사용자를 등록합니다.

**Request Body:**
```json
{
  "email": "string (required, email format)",
  "password": "string (required, 8-32자, 대소문자+숫자+특수문자)",
  "firstName": "string (optional, max 100자)",
  "lastName": "string (optional, max 100자)"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "isActive": true,
  "isEmailVerified": false,
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "roles": [
    {
      "id": "uuid",
      "name": "USER",
      "description": "string"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request` - 유효성 검사 실패
- `409 Conflict` - 이메일 중복

---

### POST /auth/login

사용자 로그인 후 JWT 토큰을 발급합니다.

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)",
  "expiresIn": 900
}
```

**Error Responses:**
- `401 Unauthorized` - 잘못된 자격 증명

---

### POST /auth/refresh

Refresh Token을 사용하여 새 토큰을 발급합니다.

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Response (200 OK):**
```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)",
  "expiresIn": 900
}
```

**Error Responses:**
- `401 Unauthorized` - 유효하지 않은 Refresh Token

---

### POST /auth/logout

현재 사용자를 로그아웃하고 Refresh Token을 무효화합니다.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - 인증 필요

---

### POST /auth/change-password

현재 사용자의 비밀번호를 변경합니다.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (required, 8-32자, 대소문자+숫자+특수문자)"
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `401 Unauthorized` - 현재 비밀번호 불일치

---

## 사용자 API (Users)

### GET /users/me

현재 인증된 사용자의 프로필을 조회합니다.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "isActive": true,
  "isEmailVerified": false,
  "lastLoginAt": "datetime",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "roles": [
    {
      "id": "uuid",
      "name": "USER",
      "description": "string",
      "permissions": [
        {
          "id": "uuid",
          "name": "string",
          "resource": "string",
          "action": "string"
        }
      ]
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - 인증 필요

---

### PATCH /users/me

현재 인증된 사용자의 프로필을 수정합니다.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "firstName": "string (optional, max 100자)",
  "lastName": "string (optional, max 100자)"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "isActive": true,
  "isEmailVerified": false,
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

**Error Responses:**
- `401 Unauthorized` - 인증 필요
- `400 Bad Request` - 유효성 검사 실패

---

## 공통 에러 응답

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["error message 1", "error message 2"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Access denied",
  "error": "Forbidden"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

---

## 인증 헤더

모든 보호된 엔드포인트는 다음 형식의 Authorization 헤더가 필요합니다:

```
Authorization: Bearer <token>
```

### Access Token
- 유효 기간: 15분 (900초)
- 용도: API 요청 인증
- 저장 위치: 클라이언트 메모리 (권장)

### Refresh Token
- 유효 기간: 7일
- 용도: Access Token 갱신
- 저장 위치: HttpOnly Cookie 또는 Secure Storage

---

## JWT 페이로드 구조

### Access Token Payload
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["USER", "ADMIN"],
  "permissions": ["articles:read", "articles:write"],
  "type": "access",
  "iat": 1704873600,
  "exp": 1704874500
}
```

### Refresh Token Payload
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["USER"],
  "permissions": [],
  "type": "refresh",
  "iat": 1704873600,
  "exp": 1705478400
}
```

---

## 비밀번호 정책

비밀번호는 다음 조건을 충족해야 합니다:

- 최소 8자, 최대 32자
- 최소 1개의 대문자 포함
- 최소 1개의 소문자 포함
- 최소 1개의 숫자 포함
- 최소 1개의 특수문자 포함 (`@$!%*?&`)

**정규식:**
```regex
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,32}$
```
