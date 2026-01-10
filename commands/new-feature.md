---
description: 새 기능 개발 워크플로우 시작
argument-hint: <feature-name>
allowed-tools: ["Read", "Write", "Grep", "Glob", "Bash", "Task"]
---

# New Feature Orchestrator

$ARGUMENTS 로 전달된 기능명으로 개발 워크플로우를 시작합니다.

## 워크플로우

1. **요구사항 분석**: 기능의 목적과 범위 정의
2. **설계 문서 작성**: API 스펙, 데이터 모델 설계
3. **코드 구현**: NestJS 모듈, 서비스, 컨트롤러 생성
4. **테스트 작성 (3분류 필수)**:
   - **유닛 테스트**: `src/<module>/*.spec.ts` - Mock 기반 개별 메서드 테스트
   - **통합 테스트**: `test/integration/*.integration-spec.ts` - 모듈 간 연동 테스트 (DB/Redis 포함)
   - **E2E 테스트**: `test/<module>.e2e-spec.ts` - 전체 시나리오 테스트
5. **리뷰 체크리스트**: 코드 품질 및 보안 점검

## 테스트 실행 명령어

```bash
npm run test:unit        # 유닛 테스트만 실행
npm run test:integration # 통합 테스트만 실행
npm run test:e2e         # E2E 테스트만 실행
npm run test:all         # 전체 테스트 실행
```

## 사용법

```
/new-feature user-profile
/new-feature payment-integration
```
