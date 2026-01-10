---
description: "[Backend/Developer] 기능 구현"
argument-hint: [feature-description]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(npm:*), Bash(nest:*)
---

# Backend Developer - 구현

## Agent 정보
- **팀**: Backend
- **역할**: Developer
- **작업**: Implement

## 기능 설명: $ARGUMENTS

## 구현 프로세스

### 1. 요구사항 분석
제공된 기능 설명을 분석하여:
- 필요한 엔드포인트 파악
- 데이터 모델 정의
- 비즈니스 로직 설계

### 2. 프로젝트 구조 확인
!`ls -la /opt/nest-api/src/modules/ 2>/dev/null`

### 3. 구현 단계

#### 모듈 생성 (필요시)
```bash
cd /opt/nest-api
nest g module modules/[name]
nest g controller modules/[name]
nest g service modules/[name]
```

#### 파일 구조
```
src/modules/[feature]/
├── [feature].module.ts
├── [feature].controller.ts
├── [feature].service.ts
├── dto/
│   ├── create-[feature].dto.ts
│   └── update-[feature].dto.ts
├── entities/
│   └── [feature].entity.ts
└── [feature].repository.ts (선택)
```

### 4. 구현 항목

#### Entity (데이터 모델)
```typescript
@Entity()
export class Feature {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

#### DTO (데이터 검증)
```typescript
export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
```

#### Service (비즈니스 로직)
```typescript
@Injectable()
export class FeatureService {
  constructor(
    @InjectRepository(Feature)
    private readonly repo: Repository<Feature>,
  ) {}

  async create(dto: CreateFeatureDto): Promise<Feature> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }
}
```

#### Controller (API 엔드포인트)
```typescript
@Controller('features')
export class FeatureController {
  constructor(private readonly service: FeatureService) {}

  @Post()
  create(@Body() dto: CreateFeatureDto) {
    return this.service.create(dto);
  }
}
```

### 5. 검증
- 타입 체크: `npm run build`
- 린트: `npm run lint`
- 테스트: `npm run test`

## 작업 수행

$ARGUMENTS 기능을 구현합니다:

1. 요구사항 분석
2. 필요한 파일 생성/수정
3. 코드 작성
4. 검증

구현 완료 후 생성된 파일 목록과 사용 방법을 안내합니다.
