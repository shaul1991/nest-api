# NestJS 인증/인가 시스템 구현 가이드

## 개요

이 문서는 NestJS 11.x 프로젝트에 구현된 JWT 기반 인증/인가 및 RBAC(Role-Based Access Control) 시스템에 대한 종합 가이드입니다.

**구현 일자**: 2026-01-10
**NestJS 버전**: 11.0.1
**TypeScript 버전**: 5.7.3

---

## 아키텍처

### 시스템 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Request                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      NestJS Application                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Guard Chain                         │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │ JwtAuthGuard│→│ RolesGuard  │→│PermissionsGuard│  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │              Controller / Service Layer                │  │
│  │         AuthController    │    UsersController         │  │
│  │         AuthService       │    UsersService            │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │                   Repository Layer                     │  │
│  │   UserRepository │ RoleRepository │ PermissionRepo    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
┌──────────────────┐                    ┌──────────────────┐
│    PostgreSQL    │                    │      Redis       │
│    - users       │                    │ - Refresh Tokens │
│    - roles       │                    │ - Token Cache    │
│    - permissions │                    │                  │
└──────────────────┘                    └──────────────────┘
```

### 토큰 전략

| 토큰 유형 | 만료 시간 | 저장 위치 | 용도 |
|----------|----------|----------|------|
| Access Token | 15분 | 클라이언트 메모리 | API 인증 |
| Refresh Token | 7일 | Redis + 클라이언트 | Access Token 갱신 |

### 보안 설정

| 항목 | 설정값 | 설명 |
|------|--------|------|
| 비밀번호 해싱 | bcrypt (saltRounds: 12) | 업계 표준 해싱 알고리즘 |
| JWT 알고리즘 | HS256 | HMAC SHA-256 서명 |
| JWT Secret 최소 길이 | 32바이트 | 환경변수 검증에서 강제 |

---

## 파일 구조

```
src/
├── auth/
│   ├── auth.module.ts              # 인증 모듈 정의
│   ├── auth.controller.ts          # 인증 API 엔드포인트
│   ├── auth.service.ts             # 인증 비즈니스 로직
│   ├── auth.service.spec.ts        # 단위 테스트
│   ├── strategies/
│   │   ├── local.strategy.ts       # 이메일/비밀번호 인증
│   │   ├── jwt.strategy.ts         # Access Token 검증
│   │   └── jwt-refresh.strategy.ts # Refresh Token 검증
│   ├── guards/
│   │   ├── jwt-auth.guard.ts       # JWT 인증 Guard (전역)
│   │   ├── jwt-refresh.guard.ts    # Refresh Token Guard
│   │   ├── local-auth.guard.ts     # 로컬 인증 Guard
│   │   ├── roles.guard.ts          # 역할 기반 접근 제어 (전역)
│   │   └── permissions.guard.ts    # 권한 기반 접근 제어
│   ├── decorators/
│   │   ├── current-user.decorator.ts  # 현재 사용자 주입
│   │   ├── public.decorator.ts        # 공개 엔드포인트 지정
│   │   ├── roles.decorator.ts         # 역할 요구사항 지정
│   │   └── permissions.decorator.ts   # 권한 요구사항 지정
│   ├── dto/
│   │   ├── login.dto.ts            # 로그인 요청 DTO
│   │   └── change-password.dto.ts  # 비밀번호 변경 DTO
│   └── interfaces/
│       ├── jwt-payload.interface.ts    # JWT 페이로드 타입
│       └── token-response.interface.ts # 토큰 응답 타입
├── users/
│   ├── users.module.ts             # 사용자 모듈 정의
│   ├── users.controller.ts         # 사용자 API 엔드포인트
│   ├── users.service.ts            # 사용자 비즈니스 로직
│   ├── users.service.spec.ts       # 단위 테스트
│   ├── entities/
│   │   ├── user.entity.ts          # 사용자 엔티티
│   │   ├── role.entity.ts          # 역할 엔티티
│   │   └── permission.entity.ts    # 권한 엔티티
│   ├── dto/
│   │   ├── create-user.dto.ts      # 사용자 생성 DTO
│   │   └── update-user.dto.ts      # 사용자 수정 DTO
│   └── enums/
│       └── role.enum.ts            # 역할 타입 열거형
├── common/
│   └── constants/
│       └── auth.constants.ts       # 인증 관련 상수
└── config/
    └── auth.config.ts              # 인증 설정
```

---

## API 엔드포인트

### 인증 API

| 메서드 | 경로 | 설명 | 인증 | 요청 본문 |
|--------|------|------|------|----------|
| POST | `/auth/register` | 회원가입 | 불필요 | `CreateUserDto` |
| POST | `/auth/login` | 로그인 | 불필요 | `LoginDto` |
| POST | `/auth/refresh` | 토큰 갱신 | Refresh Token | - |
| POST | `/auth/logout` | 로그아웃 | Access Token | - |
| POST | `/auth/change-password` | 비밀번호 변경 | Access Token | `ChangePasswordDto` |

### 사용자 API

| 메서드 | 경로 | 설명 | 인증 | 요청 본문 |
|--------|------|------|------|----------|
| GET | `/users/me` | 내 프로필 조회 | Access Token | - |
| PATCH | `/users/me` | 내 프로필 수정 | Access Token | `UpdateUserDto` |

### 요청/응답 예시

#### 회원가입
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass1!",
    "firstName": "홍",
    "lastName": "길동"
  }'
```

**응답 (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "firstName": "홍",
  "lastName": "길동",
  "isActive": true,
  "isEmailVerified": false,
  "createdAt": "2026-01-10T10:00:00.000Z"
}
```

#### 로그인
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass1!"
  }'
```

**응답 (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

#### 토큰 갱신
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer <refresh_token>"
```

#### 인증된 요청
```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer <access_token>"
```

---

## 데이터베이스 스키마

### ERD

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      users      │       │   user_roles    │       │      roles      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──────<│ user_id (FK)    │>──────│ id (PK)         │
│ email           │       │ role_id (FK)    │       │ name            │
│ password        │       └─────────────────┘       │ description     │
│ first_name      │                                 │ is_active       │
│ last_name       │                                 │ created_at      │
│ is_active       │                                 │ updated_at      │
│ is_email_verified│                                └────────┬────────┘
│ last_login_at   │                                          │
│ created_at      │                                          │
│ updated_at      │       ┌─────────────────┐       ┌────────▼────────┐
└─────────────────┘       │role_permissions │       │   permissions   │
                          ├─────────────────┤       ├─────────────────┤
                          │ role_id (FK)    │>──────│ id (PK)         │
                          │ permission_id(FK)│<──────│ name            │
                          └─────────────────┘       │ resource        │
                                                    │ action          │
                                                    │ description     │
                                                    │ created_at      │
                                                    │ updated_at      │
                                                    └─────────────────┘
```

### 기본 역할

| 역할 | 설명 |
|------|------|
| `ADMIN` | 관리자 - 모든 권한 |
| `USER` | 일반 사용자 - 기본 권한 |
| `MODERATOR` | 중재자 - 제한된 관리 권한 |

---

## 사용 방법

### 1. 공개 엔드포인트 설정

`@Public()` 데코레이터를 사용하여 인증 없이 접근 가능한 엔드포인트를 지정합니다.

```typescript
import { Public } from './auth/decorators/public.decorator';

@Controller('products')
export class ProductsController {
  @Get()
  @Public()  // 인증 불필요
  findAll() {
    return this.productsService.findAll();
  }

  @Post()
  // 인증 필요 (기본값)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }
}
```

### 2. 역할 기반 접근 제어

`@Roles()` 데코레이터를 사용하여 특정 역할만 접근 가능하도록 설정합니다.

```typescript
import { Roles } from './auth/decorators/roles.decorator';
import { RoleType } from './users/enums/role.enum';

@Controller('admin')
export class AdminController {
  @Get('users')
  @Roles(RoleType.ADMIN)  // ADMIN 역할만 접근 가능
  getAllUsers() {
    return this.usersService.findAll();
  }

  @Delete('users/:id')
  @Roles(RoleType.ADMIN, RoleType.MODERATOR)  // ADMIN 또는 MODERATOR
  deleteUser(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
```

### 3. 권한 기반 접근 제어

`@Permissions()` 데코레이터를 사용하여 세분화된 권한 제어를 적용합니다.

```typescript
import { Permissions } from './auth/decorators/permissions.decorator';

@Controller('articles')
export class ArticlesController {
  @Post()
  @Permissions('articles:create')
  create(@Body() dto: CreateArticleDto) {
    return this.articlesService.create(dto);
  }

  @Delete(':id')
  @Permissions('articles:delete')
  delete(@Param('id') id: string) {
    return this.articlesService.delete(id);
  }
}
```

### 4. 현재 사용자 정보 접근

`@CurrentUser()` 데코레이터를 사용하여 현재 인증된 사용자 정보를 주입받습니다.

```typescript
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { User } from './users/entities/user.entity';

@Controller('orders')
export class OrdersController {
  @Post()
  createOrder(
    @CurrentUser() user: User,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.create(user.id, dto);
  }

  @Get('my-orders')
  getMyOrders(@CurrentUser() user: User) {
    return this.ordersService.findByUserId(user.id);
  }
}
```

---

## 환경 변수

### 필수 환경 변수

```env
# JWT 설정 (필수)
JWT_SECRET=<최소 32바이트 랜덤 문자열>
JWT_REFRESH_SECRET=<최소 32바이트 랜덤 문자열>

# 데이터베이스 (필수)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=nest_api
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# Redis (필수)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 선택 환경 변수

```env
# JWT 만료 시간 (기본값 사용 가능)
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# bcrypt 설정 (기본값: 12)
BCRYPT_SALT_ROUNDS=12
```

### 시크릿 생성

```bash
# JWT Secret 생성
openssl rand -base64 32
```

---

## 테스트

### 단위 테스트 실행

```bash
# 전체 단위 테스트
npm run test

# 특정 파일 테스트
npm run test -- --testPathPattern=auth.service.spec.ts

# 커버리지 리포트
npm run test:cov
```

### E2E 테스트 실행

```bash
# PostgreSQL, Redis 실행 필요
npm run test:e2e
```

### 테스트 커버리지 목표

| 모듈 | 목표 커버리지 |
|------|--------------|
| AuthService | 90%+ |
| UsersService | 90%+ |
| Guards | 80%+ |
| Strategies | 80%+ |

---

## 보안 고려사항

### 구현된 보안 기능

- [x] bcrypt 비밀번호 해싱 (saltRounds: 12)
- [x] JWT Access/Refresh Token 분리
- [x] Refresh Token Redis 저장 및 순환
- [x] 입력 유효성 검사 (class-validator)
- [x] 비밀번호 복잡성 검증
- [x] 전역 인증 Guard
- [x] RBAC 권한 관리

### 추가 권장 사항

- [ ] Rate Limiting (`@nestjs/throttler`)
- [ ] 보안 헤더 (`helmet`)
- [ ] 보안 이벤트 로깅
- [ ] 계정 잠금 정책
- [ ] IP 기반 차단

---

## 트러블슈팅

### 일반적인 문제

#### 1. JWT_SECRET 오류
```
Error: JWT_SECRET is not defined
```
**해결**: 환경 변수에 32바이트 이상의 JWT_SECRET 설정

#### 2. Redis 연결 실패
```
Error: Redis connection refused
```
**해결**: Redis 서버 실행 확인, REDIS_HOST/PORT 설정 확인

#### 3. 401 Unauthorized
```
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**해결**:
- Authorization 헤더 확인 (`Bearer <token>`)
- 토큰 만료 여부 확인
- `/auth/refresh`로 토큰 갱신

---

## 참고 자료

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [Passport.js Documentation](http://www.passportjs.org/docs/)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
