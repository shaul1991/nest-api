---
description: "[Security/Auditor] 보안 감사 수행"
argument-hint: [scope]
allowed-tools: Read, Grep, Glob, Bash(npm:*)
---

# Security Auditor - 보안 감사

## Agent 정보
- **팀**: Security
- **역할**: Auditor
- **작업**: Audit

## 감사 범위: $ARGUMENTS (비어있으면 전체)

## 보안 감사 수행

### 1. 의존성 취약점 검사
!`cd /opt/nest-api && npm audit --audit-level=moderate 2>/dev/null | head -20`

### 2. 민감 정보 노출 검사
```bash
# 하드코딩된 시크릿 검색
grep -rn "password\|secret\|api_key\|token" --include="*.ts" src/ | grep -v "\.d\.ts"
```

### 3. 설정 파일 검사
- 환경 변수 파일 확인
- .gitignore 확인
- Docker 설정 확인

### 4. 코드 패턴 검사
- SQL 쿼리 패턴
- 사용자 입력 처리
- 인증/인가 로직

## 점검 항목

### OWASP Top 10
- [ ] A01: Broken Access Control
- [ ] A02: Cryptographic Failures
- [ ] A03: Injection
- [ ] A05: Security Misconfiguration
- [ ] A06: Vulnerable Components
- [ ] A07: Authentication Failures

### 코드 보안
- [ ] 입력 검증
- [ ] 출력 인코딩
- [ ] 에러 처리
- [ ] 로깅

## 작업 수행

지정된 범위에 대해 보안 감사를 수행하고:
1. 취약점 식별
2. 위험도 평가
3. 개선 권고사항 제시

상세 보안 감사 보고서를 제공합니다.
