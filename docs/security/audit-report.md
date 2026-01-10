# OWASP Top 10 보안 감사 리포트

**프로젝트:** NestJS REST API
**감사일:** 2026-01-10
**감사 버전:** 1.0
**감사 범위:** 인증(Authentication) 구현체

---

## 전체 보안 점수: 78/100 (양호)

| 등급 | 설명 |
|------|------|
| 90-100 | 우수 - 즉각적인 조치 불필요 |
| 70-89 | 양호 - 일부 개선 필요 |
| 50-69 | 보통 - 주요 개선 필요 |
| 0-49 | 취약 - 즉각적인 조치 필요 |

---

## 요약

| OWASP 카테고리 | 상태 | 심각도 |
|----------------|------|--------|
| A01:2021 - Broken Access Control | WARNING | 중간 |
| A02:2021 - Cryptographic Failures | PASS | 낮음 |
| A03:2021 - Injection | PASS | 낮음 |
| A04:2021 - Insecure Design | WARNING | 중간 |
| A05:2021 - Security Misconfiguration | WARNING | 중간 |
| A06:2021 - Vulnerable Components | PASS | 낮음 |
| A07:2021 - Identification and Authentication Failures | WARNING | 중간 |
| A08:2021 - Software and Data Integrity Failures | PASS | 낮음 |
| A09:2021 - Security Logging and Monitoring Failures | FAIL | 높음 |
| A10:2021 - SSRF | PASS | 낮음 |

---

## 상세 분석

### A01:2021 - Broken Access Control (접근 제어 실패)

**상태:** WARNING

#### 긍정적인 측면
1. **전역 JWT 가드 적용**
   - 파일: `/opt/nest-api/src/app.module.ts` (라인 66-68)
   ```typescript
   {
     provide: APP_GUARD,
     useClass: JwtAuthGuard,
   },
   ```
   - 모든 엔드포인트에 기본적으로 JWT 인증이 적용됨

2. **역할 기반 접근 제어(RBAC) 구현**
   - 파일: `/opt/nest-api/src/auth/guards/roles.guard.ts`
   - 역할 검증이 적절히 구현됨

3. **권한 기반 접근 제어 구현**
   - 파일: `/opt/nest-api/src/auth/guards/permissions.guard.ts`
   - 세분화된 권한 검증 지원

4. **Public 데코레이터를 통한 명시적 접근 제어**
   - 파일: `/opt/nest-api/src/auth/auth.controller.ts` (라인 27, 34, 44)
   - 공개 엔드포인트가 명시적으로 표시됨

#### 발견된 문제점
1. **PermissionsGuard가 전역으로 등록되지 않음**
   - 파일: `/opt/nest-api/src/app.module.ts`
   - RolesGuard만 전역으로 등록되어 있음
   - **권장사항:** PermissionsGuard도 전역으로 등록하거나, 명확한 사용 가이드라인 문서화 필요

2. **비활성 사용자에 대한 세션 무효화 지연 가능성**
   - 액세스 토큰 만료 전까지 비활성 사용자가 여전히 API에 접근 가능
   - **권장사항:** 블랙리스트 기반 토큰 무효화 고려

---

### A02:2021 - Cryptographic Failures (암호화 실패)

**상태:** PASS

#### 긍정적인 측면
1. **bcrypt 사용으로 안전한 비밀번호 해싱**
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 111-114)
   ```typescript
   async hashPassword(password: string): Promise<string> {
     const saltRounds =
       this.configService.get<number>('auth.bcrypt.saltRounds') ?? 12;
     return bcrypt.hash(password, saltRounds);
   }
   ```
   - 기본 salt rounds: 12 (OWASP 권장 최소 10)

2. **JWT 시크릿 최소 길이 검증**
   - 파일: `/opt/nest-api/src/config/env.validation.ts` (라인 58-63)
   ```typescript
   @IsString()
   @MinLength(32)
   JWT_SECRET: string;

   @IsString()
   @MinLength(32)
   JWT_REFRESH_SECRET: string;
   ```
   - 32자 이상의 시크릿 키 강제

3. **별도의 Access/Refresh 토큰 시크릿 사용**
   - 파일: `/opt/nest-api/src/config/auth.config.ts`
   - 토큰 타입별 다른 시크릿 사용으로 보안 강화

4. **비밀번호 필드 직렬화 제외**
   - 파일: `/opt/nest-api/src/users/entities/user.entity.ts` (라인 22-23)
   ```typescript
   @Column()
   @Exclude()
   password: string;
   ```
   - API 응답에서 비밀번호 해시 노출 방지

#### 권장사항
- salt rounds를 환경별로 조정 가능하도록 설정 유지 (현재 10-14 범위로 제한됨)

---

### A03:2021 - Injection (인젝션)

**상태:** PASS

#### 긍정적인 측면
1. **class-validator를 통한 입력 검증**
   - 파일: `/opt/nest-api/src/auth/dto/login.dto.ts`
   ```typescript
   @IsEmail()
   email: string;

   @IsString()
   @MinLength(8)
   password: string;
   ```

2. **ValidationPipe 전역 적용**
   - 파일: `/opt/nest-api/src/main.ts` (라인 8-14)
   ```typescript
   app.useGlobalPipes(
     new ValidationPipe({
       whitelist: true,
       forbidNonWhitelisted: true,
       transform: true,
     }),
   );
   ```
   - `whitelist: true` - DTO에 정의되지 않은 속성 자동 제거
   - `forbidNonWhitelisted: true` - 허용되지 않은 속성 전송 시 에러 발생

3. **TypeORM 파라미터화된 쿼리 사용**
   - 파일: `/opt/nest-api/src/users/users.service.ts`
   - Repository 패턴 사용으로 SQL 인젝션 방지

4. **비밀번호 복잡성 검증**
   - 파일: `/opt/nest-api/src/users/dto/create-user.dto.ts` (라인 17-20)
   ```typescript
   @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
     message: 'Password must contain at least one uppercase, one lowercase, one number and one special character',
   })
   ```

---

### A04:2021 - Insecure Design (불안전한 설계)

**상태:** WARNING

#### 긍정적인 측면
1. **토큰 타입 분리**
   - 파일: `/opt/nest-api/src/common/constants/auth.constants.ts` (라인 16-19)
   ```typescript
   export const TOKEN_TYPE = {
     ACCESS: 'access',
     REFRESH: 'refresh',
   } as const;
   ```
   - Access/Refresh 토큰이 명확히 구분됨

2. **토큰 타입 검증**
   - 파일: `/opt/nest-api/src/auth/strategies/jwt.strategy.ts` (라인 28-30)
   ```typescript
   if (payload.type !== TOKEN_TYPE.ACCESS) {
     throw new UnauthorizedException(AUTH_ERRORS.TOKEN_INVALID);
   }
   ```
   - Refresh 토큰으로 API 접근 시도 시 차단

3. **Refresh 토큰 저장 및 검증**
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 64-66)
   - Redis에 저장된 토큰과 비교하여 토큰 재사용 공격 방지

4. **비밀번호 변경 시 세션 무효화**
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 108)
   ```typescript
   await this.invalidateRefreshToken(userId);
   ```

#### 발견된 문제점
1. **로그인 시도 횟수 제한 없음 (Rate Limiting)**
   - 무차별 대입 공격(Brute Force)에 취약
   - **심각도:** 중간
   - **권장사항:** `@nestjs/throttler` 사용하여 Rate Limiting 구현

2. **이메일 인증 기능 미구현**
   - `isEmailVerified` 필드는 있으나 검증 로직 없음
   - 파일: `/opt/nest-api/src/users/entities/user.entity.ts` (라인 34-35)
   - **권장사항:** 이메일 인증 워크플로우 구현

3. **비밀번호 재설정 기능 없음**
   - **권장사항:** 안전한 비밀번호 재설정 플로우 구현

---

### A05:2021 - Security Misconfiguration (보안 설정 오류)

**상태:** WARNING

#### 긍정적인 측면
1. **환경 변수 검증**
   - 파일: `/opt/nest-api/src/config/env.validation.ts`
   - 필수 환경 변수 누락 시 애플리케이션 시작 실패

2. **JWT 시크릿 누락 시 명시적 에러**
   - 파일: `/opt/nest-api/src/auth/strategies/jwt.strategy.ts` (라인 17-19)
   ```typescript
   if (!secret) {
     throw new Error('JWT_SECRET is not defined');
   }
   ```

3. **프로덕션 환경에서 DB 동기화 비활성화**
   - 파일: `/opt/nest-api/src/app.module.ts` (라인 36)
   ```typescript
   synchronize: configService.get<string>('NODE_ENV') !== 'production',
   ```

#### 발견된 문제점
1. **CORS 와일드카드 허용**
   - 파일: `/opt/nest-api/src/main.ts` (라인 16-19)
   ```typescript
   app.enableCors({
     origin: process.env.CORS_ORIGIN?.split(',') || '*',
     credentials: true,
   });
   ```
   - `CORS_ORIGIN` 미설정 시 모든 출처 허용
   - **심각도:** 중간
   - **권장사항:** 프로덕션에서 명시적 출처 설정 강제

2. **보안 헤더 미설정**
   - Helmet 미들웨어 미사용
   - X-Frame-Options, X-Content-Type-Options 등 미설정
   - **권장사항:** `helmet` 패키지 사용

3. **.env 파일 Git 제외 여부 확인 필요**
   - `.env.local`, `.env.dev`, `.env.production` 파일 존재
   - **권장사항:** `.gitignore`에서 `.env*` 패턴 확인

---

### A06:2021 - Vulnerable and Outdated Components (취약하고 오래된 구성요소)

**상태:** PASS

#### 분석
- 파일: `/opt/nest-api/package.json`

| 패키지 | 버전 | 상태 |
|--------|------|------|
| @nestjs/common | ^11.0.1 | 최신 |
| @nestjs/jwt | ^11.0.2 | 최신 |
| bcrypt | ^6.0.0 | 최신 |
| passport-jwt | ^4.0.1 | 안정 |
| typeorm | ^0.3.28 | 안정 |

#### 권장사항
- 정기적인 `npm audit` 실행
- 의존성 업데이트 자동화 (Dependabot 등)

---

### A07:2021 - Identification and Authentication Failures (식별 및 인증 실패)

**상태:** WARNING

#### 긍정적인 측면
1. **안전한 비밀번호 정책**
   - 최소 8자, 최대 32자
   - 대문자, 소문자, 숫자, 특수문자 필수
   - 파일: `/opt/nest-api/src/users/dto/create-user.dto.ts`

2. **적절한 토큰 만료 시간**
   - Access Token: 15분
   - Refresh Token: 7일
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 133, 140)

3. **비활성 사용자 로그인 차단**
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 36-38)
   ```typescript
   if (!user.isActive) {
     return null;
   }
   ```

4. **로그아웃 시 Refresh 토큰 무효화**
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 83-86)

#### 발견된 문제점
1. **계정 잠금 기능 없음**
   - 반복 로그인 실패 시 계정 잠금 미구현
   - **심각도:** 중간
   - **권장사항:** 실패 횟수 추적 및 일시적 계정 잠금 구현

2. **MFA(다중 인증) 미지원**
   - **권장사항:** TOTP 기반 2단계 인증 고려

3. **세션 동시성 제한 없음**
   - 동일 계정으로 무제한 동시 로그인 가능
   - **권장사항:** 디바이스별 세션 관리 고려

---

### A08:2021 - Software and Data Integrity Failures (소프트웨어 및 데이터 무결성 실패)

**상태:** PASS

#### 긍정적인 측면
1. **JWT 서명 검증**
   - 파일: `/opt/nest-api/src/auth/strategies/jwt.strategy.ts` (라인 22)
   ```typescript
   ignoreExpiration: false,
   ```
   - 토큰 만료 검증 활성화

2. **Refresh 토큰 무결성 검증**
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 66)
   ```typescript
   if (!storedToken || storedToken !== refreshToken) {
     throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_INVALID);
   }
   ```
   - 서버 저장 토큰과 정확히 일치해야 함

3. **토큰 갱신 시 기존 토큰 무효화**
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 75)
   - 토큰 재사용 공격 방지

---

### A09:2021 - Security Logging and Monitoring Failures (보안 로깅 및 모니터링 실패)

**상태:** FAIL

#### 발견된 문제점
1. **불충분한 보안 이벤트 로깅**
   - 로그아웃만 로깅됨
   - 파일: `/opt/nest-api/src/auth/auth.service.ts` (라인 85)
   ```typescript
   this.logger.log(`User ${userId} logged out`);
   ```
   - **심각도:** 높음

2. **로그인 실패 로깅 없음**
   - 무차별 대입 공격 탐지 불가
   - **권장사항:** 실패한 로그인 시도 로깅

3. **비밀번호 변경 로깅 없음**
   - 보안 감사 추적 불가
   - **권장사항:** 모든 보안 관련 이벤트 로깅

4. **토큰 갱신 로깅 없음**
   - **권장사항:** 토큰 갱신 시도 로깅

5. **구조화된 로깅 미사용**
   - **권장사항:** JSON 형식 로깅, 로그 레벨 분리

#### 필수 로깅 이벤트 체크리스트
- [ ] 로그인 성공
- [ ] 로그인 실패
- [x] 로그아웃
- [ ] 토큰 갱신
- [ ] 비밀번호 변경
- [ ] 계정 생성
- [ ] 권한 변경
- [ ] 비정상 접근 시도

---

### A10:2021 - Server-Side Request Forgery (SSRF)

**상태:** PASS

#### 분석
- 현재 인증 모듈에서 외부 URL 요청 기능 없음
- SSRF 취약점 해당 없음

---

## 즉각적인 조치가 필요한 사항

### 높음 (CRITICAL)

1. **보안 로깅 강화**
   ```typescript
   // auth.service.ts에 추가 권장
   async validateUser(email: string, password: string): Promise<User | null> {
     const user = await this.usersService.findByEmail(email);
     if (!user) {
       this.logger.warn(`Login attempt failed: User not found - ${email}`);
       return null;
     }
     // ...
     if (!isPasswordValid) {
       this.logger.warn(`Login attempt failed: Invalid password - ${email}`);
       return null;
     }
     this.logger.log(`Login successful: ${email}`);
     return user;
   }
   ```

### 중간 (MEDIUM)

2. **Rate Limiting 구현**
   ```bash
   npm install @nestjs/throttler
   ```
   ```typescript
   // app.module.ts
   import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

   @Module({
     imports: [
       ThrottlerModule.forRoot([{
         ttl: 60000,
         limit: 10,
       }]),
     ],
     providers: [
       {
         provide: APP_GUARD,
         useClass: ThrottlerGuard,
       },
     ],
   })
   ```

3. **보안 헤더 추가**
   ```bash
   npm install helmet
   ```
   ```typescript
   // main.ts
   import helmet from 'helmet';
   app.use(helmet());
   ```

4. **CORS 설정 강화**
   ```typescript
   // main.ts
   if (!process.env.CORS_ORIGIN && process.env.NODE_ENV === 'production') {
     throw new Error('CORS_ORIGIN must be set in production');
   }
   ```

### 낮음 (LOW)

5. **이메일 인증 구현**
6. **비밀번호 재설정 기능 구현**
7. **MFA 지원 추가**
8. **세션 동시성 제한 구현**

---

## 보안 점수 산출 근거

| 항목 | 배점 | 득점 | 비고 |
|------|------|------|------|
| 비밀번호 해싱 | 10 | 10 | bcrypt 사용, 적절한 salt rounds |
| JWT 구현 | 15 | 14 | 토큰 분리, 갱신 로직 우수, 블랙리스트 미구현 -1 |
| 입력 검증 | 10 | 10 | ValidationPipe, DTO 검증 완벽 |
| 접근 제어 | 15 | 13 | RBAC 구현, PermissionsGuard 전역 미등록 -2 |
| 환경 설정 | 10 | 8 | CORS 와일드카드, 보안 헤더 미설정 -2 |
| 로깅/모니터링 | 15 | 5 | 심각한 부족 -10 |
| Rate Limiting | 10 | 0 | 미구현 -10 |
| 토큰 관리 | 10 | 10 | Refresh 토큰 저장, 무효화 우수 |
| 비밀번호 정책 | 5 | 5 | 복잡성 요구사항 적절 |

**총점: 78/100**

---

## 결론

NestJS REST API의 인증 구현체는 전반적으로 양호한 보안 수준을 보여주고 있습니다. bcrypt를 통한 비밀번호 해싱, JWT 토큰 분리, TypeORM을 통한 SQL 인젝션 방지 등 핵심적인 보안 요소들이 잘 구현되어 있습니다.

그러나 **보안 로깅 부족**과 **Rate Limiting 미구현**은 프로덕션 환경에서 반드시 해결해야 할 중요한 문제입니다. 이 두 가지 사항은 공격 탐지와 방어에 필수적입니다.

권장되는 우선순위:
1. 보안 로깅 강화 (즉시)
2. Rate Limiting 구현 (1주 이내)
3. 보안 헤더 추가 (1주 이내)
4. CORS 설정 강화 (프로덕션 배포 전)

---

*이 리포트는 OWASP Top 10 2021 기준으로 작성되었습니다.*
