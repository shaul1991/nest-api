---
description: "[Backend/Developer] 코드/쿼리 성능 최적화"
argument-hint: [file-path]
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Backend Developer - 최적화

## Agent 정보
- **팀**: Backend
- **역할**: Developer
- **작업**: Optimize

## 대상 파일: $ARGUMENTS

## 최적화 영역

### 1. 쿼리 최적화
- N+1 쿼리 탐지
- 불필요한 조회 제거
- 인덱스 활용 확인
- Join 최적화

### 2. 코드 최적화
- 불필요한 연산 제거
- 루프 최적화
- 캐싱 적용
- 비동기 처리 개선

### 3. 메모리 최적화
- 대용량 데이터 스트리밍
- 객체 재사용
- 메모리 누수 방지

## 분석 항목

### TypeORM 쿼리
```typescript
// Before: N+1 문제
const users = await userRepo.find();
for (const user of users) {
  user.posts = await postRepo.find({ userId: user.id });
}

// After: Eager loading
const users = await userRepo.find({ relations: ['posts'] });
```

### 캐싱 적용
```typescript
@Cacheable({ ttl: 300 })
async getPopularPosts() {
  return this.postRepo.find({ order: { views: 'DESC' }, take: 10 });
}
```

## 작업 수행

지정된 파일을 분석하여:
1. 성능 병목 식별
2. 최적화 방안 제시
3. 코드 수정 제안

before/after 비교와 함께 보고합니다.
