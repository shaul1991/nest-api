# 데이터베이스 마이그레이션 가이드

이 문서는 NestJS API 프로젝트의 TypeORM 마이그레이션 사용 방법을 설명합니다.

## 목차

1. [개요](#개요)
2. [설정](#설정)
3. [명령어](#명령어)
4. [마이그레이션 작성 규칙](#마이그레이션-작성-규칙)
5. [롤백 전략](#롤백-전략)
6. [환경별 배포 가이드](#환경별-배포-가이드)
7. [트러블슈팅](#트러블슈팅)

---

## 개요

마이그레이션은 데이터베이스 스키마 변경을 버전 관리하고, 안전하게 배포/롤백할 수 있게 해주는 도구입니다.

### 왜 마이그레이션을 사용하나요?

- **버전 관리**: 스키마 변경 이력 추적
- **안전한 배포**: 롤백 가능한 변경 적용
- **협업**: 팀원 간 스키마 동기화
- **운영 안정성**: synchronize: true 대신 명시적 스키마 관리

---

## 설정

### 데이터소스 설정

마이그레이션은 `src/config/typeorm.datasource.ts`를 사용합니다:

```typescript
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  // ... 기타 설정
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false, // 마이그레이션 사용 시 반드시 false
});
```

### 환경 변수

`.env` 파일에 데이터베이스 연결 정보 설정:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=nest_api
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
```

---

## 명령어

### 마이그레이션 생성

엔티티 변경사항 기반 자동 생성:

```bash
npm run migration:generate -- src/migrations/MigrationName
```

### 마이그레이션 실행

대기 중인 마이그레이션 적용:

```bash
npm run migration:run
```

### 마이그레이션 롤백

가장 최근 마이그레이션 롤백:

```bash
npm run migration:revert
```

### 마이그레이션 상태 확인

실행된/대기 중인 마이그레이션 목록:

```bash
npm run migration:show
```

---

## 마이그레이션 작성 규칙

### 파일 명명 규칙

```
{timestamp}-{설명적인이름}.ts
예: 1705200000000-CreateLikesTable.ts
```

### 코드 구조

```typescript
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateLikesTable1705200000000 implements MigrationInterface {
  // 마이그레이션 적용
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ /* ... */ }));
  }

  // 롤백 (반드시 구현!)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('likes');
  }
}
```

### 주요 규칙

1. **롤백 메서드 필수 구현**: `down()` 메서드는 `up()`의 변경사항을 완전히 되돌려야 함
2. **원자적 변경**: 하나의 마이그레이션은 하나의 논리적 변경만 포함
3. **멱등성 고려**: 인덱스 생성 시 존재 여부 확인 권장
4. **데이터 보존**: 데이터 마이그레이션 시 백업 필수

---

## 롤백 전략

### 단계별 롤백

여러 마이그레이션을 롤백해야 할 경우:

```bash
# 한 번에 하나씩 롤백
npm run migration:revert
npm run migration:revert
npm run migration:revert
```

### 롤백 전 확인사항

1. 현재 마이그레이션 상태 확인: `npm run migration:show`
2. 데이터베이스 백업 생성
3. 관련 애플리케이션 중지 (선택사항)

### 롤백이 안전한 경우

- 테이블/컬럼 추가 롤백
- 인덱스 추가 롤백

### 롤백에 주의가 필요한 경우

- 컬럼 제거 롤백 (데이터 손실 가능)
- 데이터 타입 변경 롤백
- 데이터 마이그레이션 롤백

---

## 환경별 배포 가이드

### 개발 환경 (Dev)

```bash
# 1. 마이그레이션 상태 확인
npm run migration:show

# 2. 마이그레이션 실행
npm run migration:run

# 3. 애플리케이션 재시작
npm run start:dev
```

### 운영 환경 (Production)

```bash
# 1. 데이터베이스 백업 (필수!)
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. 마이그레이션 상태 확인
npm run migration:show

# 3. 마이그레이션 실행
npm run migration:run

# 4. 애플리케이션 배포 (Blue-Green 배포 스크립트 사용)
./scripts/deploy.sh prod
```

### CI/CD 파이프라인 연동

Jenkins/GitHub Actions에서 마이그레이션 자동 실행:

```yaml
# 배포 전 마이그레이션 실행
- name: Run Migrations
  run: npm run migration:run
  env:
    DATABASE_HOST: ${{ secrets.DB_HOST }}
    DATABASE_PORT: ${{ secrets.DB_PORT }}
    DATABASE_NAME: ${{ secrets.DB_NAME }}
    DATABASE_USER: ${{ secrets.DB_USER }}
    DATABASE_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

---

## 트러블슈팅

### 마이그레이션 실행 오류

**문제**: `relation "xxx" already exists`

**해결**: 이미 테이블이 존재함. 마이그레이션 테이블(`migrations`)에서 해당 마이그레이션을 수동으로 삽입하거나, `synchronize: true`로 생성된 테이블을 삭제 후 재실행.

---

**문제**: `relation "xxx" does not exist`

**해결**: 선행 마이그레이션이 실행되지 않음. `npm run migration:show`로 확인 후 순서대로 실행.

---

**문제**: `Cannot find module '../**/*.entity'`

**해결**: 빌드가 필요함. `npm run build` 후 재시도.

---

### 마이그레이션 충돌

**문제**: 여러 개발자가 같은 타임스탬프로 마이그레이션 생성

**해결**:
1. 타임스탬프가 겹치지 않도록 조정
2. 충돌된 마이그레이션 중 하나 삭제 후 재생성
3. PR 머지 전 마이그레이션 충돌 검토

---

### 롤백 실패

**문제**: `down()` 메서드 실행 실패

**해결**:
1. 수동으로 SQL 실행하여 롤백
2. `down()` 메서드 수정 후 재시도
3. 마이그레이션 테이블에서 해당 레코드 삭제

---

## 현재 마이그레이션 목록

| 파일명 | 설명 | Task |
|--------|------|------|
| `1705200000000-CreateLikesTable.ts` | 좋아요 테이블 생성 | DBA-MVP-002 |
| `1705200000001-CreateBookmarksTable.ts` | 북마크 테이블 생성 | DBA-MVP-002 |
| `1705200000002-AddPostsCommentsIndexes.ts` | Posts/Comments 인덱스 추가 | DBA-MVP-003 |

---

## 참고 자료

- [TypeORM Migrations 공식 문서](https://typeorm.io/migrations)
- [NestJS Database 문서](https://docs.nestjs.com/techniques/database)
