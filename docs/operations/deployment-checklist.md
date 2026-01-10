# 인증 모듈 배포 체크리스트

이 문서는 NestJS API 인증 시스템의 배포 시 확인해야 할 사항들을 정리합니다.

## 목차

1. [사전 배포 체크리스트](#사전-배포-체크리스트)
2. [환경 변수 체크리스트](#환경-변수-체크리스트)
3. [프로덕션 보안 고려사항](#프로덕션-보안-고려사항)
4. [인증 엔드포인트 모니터링 권장사항](#인증-엔드포인트-모니터링-권장사항)
5. [롤백 절차](#롤백-절차)

---

## 사전 배포 체크리스트

### 코드 및 빌드 확인

- [ ] 모든 테스트가 통과했는지 확인 (`npm run test`)
- [ ] E2E 테스트 통과 확인 (`npm run test:e2e`)
- [ ] 린트 오류 없음 확인 (`npm run lint`)
- [ ] TypeScript 컴파일 오류 없음 (`npm run build`)
- [ ] 보안 취약점 스캔 완료 (`npm audit`)

### 데이터베이스

- [ ] 데이터베이스 마이그레이션 준비 완료
- [ ] users 테이블 스키마 확인 (email, password, role 컬럼 등)
- [ ] refresh_tokens 테이블 존재 여부 확인
- [ ] 데이터베이스 백업 완료

### 인프라

- [ ] Docker 이미지 빌드 성공
- [ ] Redis 연결 상태 확인
- [ ] 헬스체크 엔드포인트 동작 확인 (`/health/live`, `/health/ready`)
- [ ] 로드밸런서 설정 확인

---

## 환경 변수 체크리스트

### 필수 환경 변수

| 변수명 | 설명 | 예시 | 필수 |
|--------|------|------|------|
| `JWT_SECRET` | Access Token 서명 키 | openssl rand -base64 32 | O |
| `JWT_REFRESH_SECRET` | Refresh Token 서명 키 | openssl rand -base64 32 | O |
| `JWT_ACCESS_TOKEN_EXPIRES_IN` | Access Token 만료 시간 | 15m | O |
| `JWT_REFRESH_TOKEN_EXPIRES_IN` | Refresh Token 만료 시간 | 7d | O |
| `BCRYPT_SALT_ROUNDS` | 비밀번호 해싱 라운드 | 12 | O |
| `AUTH_RATE_LIMIT_TTL` | Rate Limit 시간 창 (초) | 60 | O |
| `AUTH_RATE_LIMIT_MAX` | Rate Limit 최대 요청 수 | 10 | O |

### 환경 변수 생성 명령어

```bash
# JWT_SECRET 생성 (최소 32바이트 권장)
openssl rand -base64 32

# JWT_REFRESH_SECRET 생성 (최소 32바이트 권장)
openssl rand -base64 32
```

### 환경별 권장 설정

| 환경 | BCRYPT_SALT_ROUNDS | RATE_LIMIT_MAX | ACCESS_TOKEN_EXPIRES |
|------|-------------------|----------------|---------------------|
| Local | 10 | 100 | 15m |
| Development | 12 | 20 | 15m |
| Production | 12 | 10 | 15m |

---

## 프로덕션 보안 고려사항

### JWT 보안

- [ ] **시크릿 키 강도**: 최소 256비트(32바이트) 이상의 무작위 키 사용
- [ ] **시크릿 분리**: Access Token과 Refresh Token에 다른 시크릿 사용
- [ ] **환경 분리**: 각 환경(dev/staging/prod)마다 다른 시크릿 사용
- [ ] **시크릿 저장**: 환경 변수 또는 시크릿 매니저 사용 (코드에 하드코딩 금지)
- [ ] **토큰 만료**: 적절한 만료 시간 설정 (Access: 15분, Refresh: 7일 권장)

### 비밀번호 보안

- [ ] **bcrypt 사용**: 비밀번호 해싱에 bcrypt 알고리즘 사용
- [ ] **Salt Rounds**: 프로덕션에서 최소 12 라운드 사용
- [ ] **비밀번호 정책**: 최소 길이, 복잡성 요구사항 적용

### Rate Limiting

- [ ] **로그인 엔드포인트**: 분당 최대 10회 제한
- [ ] **회원가입 엔드포인트**: 분당 최대 5회 제한
- [ ] **비밀번호 재설정**: 분당 최대 3회 제한
- [ ] **IP 기반 제한**: Redis를 통한 분산 환경 지원

### 네트워크 보안

- [ ] **HTTPS 강제**: 모든 인증 엔드포인트는 HTTPS만 허용
- [ ] **CORS 설정**: 허용된 도메인만 접근 가능하도록 설정
- [ ] **보안 헤더**: Helmet.js 적용 확인
- [ ] **쿠키 설정**: HttpOnly, Secure, SameSite 플래그 설정

### 로깅 및 감사

- [ ] **민감 정보 마스킹**: 비밀번호, 토큰 등은 로그에서 제외
- [ ] **인증 이벤트 로깅**: 로그인 성공/실패, 토큰 갱신 등 기록
- [ ] **IP 주소 기록**: 인증 시도에 대한 IP 주소 기록

---

## 인증 엔드포인트 모니터링 권장사항

### 주요 메트릭

| 메트릭 | 설명 | 임계값 |
|--------|------|--------|
| `auth_login_success_total` | 로그인 성공 횟수 | - |
| `auth_login_failure_total` | 로그인 실패 횟수 | 분당 100회 이상 시 경고 |
| `auth_login_latency_ms` | 로그인 응답 시간 | p99 > 500ms 시 경고 |
| `auth_token_refresh_total` | 토큰 갱신 횟수 | - |
| `auth_rate_limit_exceeded` | Rate Limit 초과 횟수 | 분당 50회 이상 시 경고 |

### 알림 설정 권장사항

```yaml
# Prometheus AlertManager 규칙 예시
groups:
  - name: auth-alerts
    rules:
      - alert: HighLoginFailureRate
        expr: rate(auth_login_failure_total[5m]) > 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "높은 로그인 실패율 감지"

      - alert: AuthenticationLatencyHigh
        expr: histogram_quantile(0.99, auth_login_latency_ms) > 500
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "인증 응답 지연 발생"

      - alert: BruteForceAttempt
        expr: rate(auth_rate_limit_exceeded[1m]) > 50
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "무차별 대입 공격 의심"
```

### 대시보드 구성 요소

1. **실시간 모니터링**
   - 초당 인증 요청 수
   - 성공/실패 비율
   - 평균 응답 시간

2. **보안 모니터링**
   - Rate Limit 초과 이벤트
   - 비정상 로그인 패턴
   - 지역별 로그인 분포

3. **시스템 상태**
   - Redis 연결 상태
   - 데이터베이스 연결 상태
   - JWT 검증 오류

---

## 롤백 절차

### 즉시 롤백 조건

다음 상황에서는 즉시 롤백을 수행합니다:

- [ ] 인증 엔드포인트 완전 장애
- [ ] 50% 이상의 로그인 실패율
- [ ] 보안 취약점 발견
- [ ] 데이터 무결성 문제

### 롤백 단계

#### 1. Blue-Green 배포 환경

```bash
# 현재 활성 슬롯 확인
cat /opt/nest-api/.active-slot-prod

# 트래픽 전환 (예: green -> blue)
# nginx 또는 로드밸런서 설정 변경
sudo nginx -s reload

# 이전 슬롯 활성화
echo "blue" > /opt/nest-api/.active-slot-prod
```

#### 2. Docker Compose 롤백

```bash
# 이전 버전 이미지로 롤백
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d \
  --pull=never \
  -e IMAGE_TAG=previous-version
```

#### 3. 데이터베이스 롤백

```bash
# 마이그레이션 롤백 (필요시)
npm run migration:revert

# 데이터베이스 복원 (필요시)
pg_restore -d nest_api /backup/nest_api_backup.dump
```

### 롤백 후 확인사항

- [ ] 헬스체크 엔드포인트 정상 응답 확인
- [ ] 기존 사용자 로그인 테스트
- [ ] 토큰 갱신 기능 테스트
- [ ] 에러 로그 확인

### JWT 시크릿 변경 시 주의사항

JWT 시크릿이 변경된 경우:

1. **모든 기존 토큰 무효화**: 기존 Access Token과 Refresh Token이 더 이상 유효하지 않음
2. **사용자 재로그인 필요**: 모든 사용자가 다시 로그인해야 함
3. **점진적 롤아웃 고려**: 가능하다면 이전 시크릿도 일시적으로 유지

```bash
# Redis에서 모든 Refresh Token 삭제 (필요시)
redis-cli -a ${REDIS_PASSWORD} KEYS "refresh_token:*" | xargs redis-cli -a ${REDIS_PASSWORD} DEL
```

---

## 배포 후 검증

### 기능 테스트

```bash
# 회원가입 테스트
curl -X POST https://api-nest.shaul.link/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123!"}'

# 로그인 테스트
curl -X POST https://api-nest.shaul.link/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123!"}'

# 토큰 갱신 테스트
curl -X POST https://api-nest.shaul.link/auth/refresh \
  -H "Authorization: Bearer ${REFRESH_TOKEN}"

# 로그아웃 테스트
curl -X POST https://api-nest.shaul.link/auth/logout \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

### 부하 테스트

```bash
# k6를 사용한 간단한 부하 테스트
k6 run --vus 10 --duration 30s scripts/auth-load-test.js
```

---

## 연락처

문제 발생 시 연락:

- **DevOps 팀**: devops@example.com
- **보안 팀**: security@example.com
- **온콜 담당자**: oncall@example.com

---

*마지막 업데이트: 2026-01-10*
