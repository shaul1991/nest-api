---
description: "[Security/Pentester] 취약점 스캔"
argument-hint: [dev|prod]
allowed-tools: Bash(curl:*), Bash(npm:*), Read
---

# Security Pentester - 취약점 스캔

## Agent 정보
- **팀**: Security
- **역할**: Pentester
- **작업**: Scan

## 대상 환경: $1 (기본: dev)

## 취약점 스캔

### 대상 URL
!`echo "https://${1:-dev}-api-nest.shaul.link" | sed 's/prod-//'`

### 1. 기본 응답 확인
```bash
URL="https://${1:-dev}-api-nest.shaul.link"
URL=$(echo $URL | sed 's/prod-//')

# 헤더 확인
curl -sI "$URL/health/live" | grep -E "^(X-|Content-Security|Strict-Transport)"
```

### 2. 보안 헤더 검사
- X-Content-Type-Options
- X-Frame-Options
- Content-Security-Policy
- Strict-Transport-Security

### 3. 에러 처리 검사
```bash
# 404 에러 응답
curl -s "$URL/nonexistent" | head -5

# 잘못된 메서드
curl -sX DELETE "$URL/health/live" | head -5
```

### 4. 입력 검증 검사
```bash
# 특수 문자 입력
curl -s "$URL/api/test?param=<script>alert(1)</script>"

# SQL 인젝션 패턴
curl -s "$URL/api/test?id=1' OR '1'='1"
```

## 스캔 결과 분석

### 취약점 분류
| 심각도 | 설명 |
|--------|------|
| Critical | 즉시 익스플로잇 가능 |
| High | 심각한 보안 위험 |
| Medium | 중간 수준 위험 |
| Low | 경미한 위험 |
| Info | 정보성 발견 |

## 작업 수행

$1 환경에 대해 취약점 스캔을 수행하고:
1. 발견된 취약점 목록화
2. 심각도 평가
3. 재현 방법 문서화
4. 개선 방안 제시

상세 스캔 보고서를 제공합니다.
