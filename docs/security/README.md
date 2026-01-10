# 보안 문서

보안 감사 및 테스트 관련 문서입니다.

## 문서 목록

| 문서 | 설명 | 최종 수정 |
|------|------|----------|
| [보안 감사 리포트](./audit-report.md) | OWASP Top 10 준수 검증 결과 | 2026-01-10 |
| [침투 테스트 시나리오](./pentest-scenarios.md) | 인증 시스템 보안 테스트 케이스 | 2026-01-10 |

## 보안 점수 요약

**전체 점수: 78/100 (양호)**

| 카테고리 | 상태 |
|----------|------|
| A01 - Broken Access Control | ⚠️ WARNING |
| A02 - Cryptographic Failures | ✅ PASS |
| A03 - Injection | ✅ PASS |
| A07 - Authentication Failures | ⚠️ WARNING |
| A09 - Security Logging | ❌ FAIL |

## 긴급 조치 필요 사항

1. Rate Limiting 구현 (`@nestjs/throttler`)
2. 보안 이벤트 로깅 추가
3. `helmet` 미들웨어 적용
