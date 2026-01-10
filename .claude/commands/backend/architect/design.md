---
description: "[Backend/Architect] 기능/모듈 아키텍처 설계"
argument-hint: [feature-name]
allowed-tools: Read, Write, Grep, Glob
---

# Backend Architect - 설계

## Agent 정보
- **팀**: Backend
- **역할**: Architect
- **작업**: Design

## 기능명: $ARGUMENTS

## 설계 프로세스

### 1. 요구사항 분석
- 기능 목적
- 사용자 스토리
- 비기능 요구사항 (성능, 보안 등)

### 2. 현재 시스템 분석
기존 모듈 및 패턴 파악:
!`ls -la /opt/nest-api/src/modules/ 2>/dev/null`

### 3. 아키텍처 설계

#### 모듈 구조
```
src/modules/[feature]/
├── [feature].module.ts
├── [feature].controller.ts
├── [feature].service.ts
├── [feature].repository.ts (선택)
├── dto/
│   ├── create-[feature].dto.ts
│   └── update-[feature].dto.ts
├── entities/
│   └── [feature].entity.ts
└── interfaces/
    └── [feature].interface.ts
```

#### 데이터 흐름
```
Request → Controller → Service → Repository → Database
                          ↓
                       Cache (선택)
```

### 4. API 설계
- 엔드포인트 정의
- 요청/응답 스키마
- 에러 처리

### 5. 데이터베이스 설계
- 엔티티 정의
- 관계 설정
- 인덱스 계획

## 작업 수행

$ARGUMENTS 기능에 대해:
1. 상세 아키텍처 설계서 작성
2. 구현 가이드 제공
3. 예상 파일 구조 제시
