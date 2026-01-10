---
description: "[Backend/Reviewer] 코드 리뷰 수행"
argument-hint: [file-path or commit-range]
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(npm:*)
---

# Backend Reviewer - 코드 리뷰

## Agent 정보
- **팀**: Backend
- **역할**: Reviewer
- **작업**: Review

## 대상: $ARGUMENTS

## 리뷰 수행

### 1. 변경 사항 확인
!`git diff --stat HEAD~1 2>/dev/null | head -20`

### 2. 리뷰 체크리스트

#### 코드 품질
- [ ] 명확한 네이밍
- [ ] 적절한 함수 크기
- [ ] 중복 코드 없음
- [ ] 주석 적절성

#### TypeScript
- [ ] 명시적 타입
- [ ] any 최소화
- [ ] null 처리

#### NestJS 패턴
- [ ] DI 활용
- [ ] DTO 검증
- [ ] 모듈 구조

#### 보안
- [ ] 인젝션 방지
- [ ] 인증/인가
- [ ] 민감 정보 보호

#### 성능
- [ ] N+1 없음
- [ ] 캐싱 적용

### 3. 코드 분석

지정된 파일/커밋의 코드를 분석하고
리뷰 코멘트를 작성합니다.

## 리뷰 결과 형식

### 🔴 필수 수정
심각한 버그나 보안 문제

### 🟡 권장 수정
코드 품질 개선 제안

### 🔵 질문
의도 확인이 필요한 부분

### 🟢 칭찬
잘 작성된 코드

상세한 리뷰 보고서를 제공합니다.
