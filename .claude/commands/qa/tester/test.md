---
description: "[QA/Tester] 테스트 실행"
argument-hint: [test-pattern]
allowed-tools: Bash(npm:*), Bash(docker:*), Read
---

# QA Tester - 테스트 실행

## Agent 정보
- **팀**: QA
- **역할**: Tester
- **작업**: Test

## 테스트 패턴: $ARGUMENTS (비어있으면 전체)

## 테스트 실행

### 현재 상태
!`cd /opt/nest-api && npm run test -- --listTests 2>/dev/null | head -10`

### 실행 명령

```bash
cd /opt/nest-api

# 전체 테스트
npm run test

# 특정 패턴
npm run test -- $ARGUMENTS

# 커버리지 포함
npm run test:cov
```

## 작업 수행

1. 테스트 실행
2. 결과 분석
3. 실패 시 원인 파악
4. 보고서 작성

### 결과 형식

```
✅ 통과: XX개
❌ 실패: XX개
⏭️ 스킵: XX개

커버리지: XX%
```

실패한 테스트가 있으면 상세 분석을 제공합니다.
