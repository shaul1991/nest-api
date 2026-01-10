# NestJS API 문서

프로젝트 문서 인덱스입니다.

---

## 아키텍처

시스템 설계 및 구조에 관한 문서입니다.

| 문서 | 설명 |
|------|------|
| [시스템 개요](./architecture/overview.md) | 전체 시스템 아키텍처 |
| [포트폴리오](./architecture/portfolio.md) | 프로젝트 포트폴리오 |

---

## 기능별 문서

각 기능 모듈에 대한 상세 문서입니다.

### 인증/인가 (Auth)

| 문서 | 설명 |
|------|------|
| [개요 및 가이드](./features/auth/README.md) | 인증 시스템 종합 가이드 |
| [API 레퍼런스](./features/auth/api-reference.md) | 인증 API 엔드포인트 상세 |
| [구현 상세](./features/auth/implementation.md) | 구현 요약 및 파일 목록 |

---

## 보안

보안 감사 및 테스트 관련 문서입니다.

| 문서 | 설명 |
|------|------|
| [보안 감사 리포트](./security/audit-report.md) | OWASP Top 10 준수 검증 |
| [침투 테스트 시나리오](./security/pentest-scenarios.md) | 보안 테스트 케이스 |

---

## 운영/배포

배포 및 운영 관련 문서입니다.

| 문서 | 설명 |
|------|------|
| [배포 가이드](./operations/deployment-guide.md) | Blue-Green 배포 가이드 |
| [배포 체크리스트](./operations/deployment-checklist.md) | 배포 전 확인 사항 |

---

## 문서 구조

```
docs/
├── README.md                           # 문서 인덱스 (현재 파일)
├── architecture/                       # 아키텍처
│   ├── overview.md                     # 시스템 개요
│   └── portfolio.md                    # 포트폴리오
├── features/                           # 기능별 문서
│   └── auth/                           # 인증/인가
│       ├── README.md                   # 기능 가이드
│       ├── api-reference.md            # API 문서
│       └── implementation.md           # 구현 상세
├── security/                           # 보안
│   ├── audit-report.md                 # 감사 리포트
│   └── pentest-scenarios.md            # 침투 테스트
└── operations/                         # 운영/배포
    ├── deployment-guide.md             # 배포 가이드
    └── deployment-checklist.md         # 배포 체크리스트
```

---

## 문서 작성 규칙

### 새 기능 추가 시

1. `features/<기능명>/` 디렉토리 생성
2. 최소 다음 파일 작성:
   - `README.md` - 기능 개요 및 사용법
   - `api-reference.md` - API 엔드포인트 (해당 시)
   - `implementation.md` - 구현 상세

### 파일 명명 규칙

- 소문자 및 하이픈 사용: `api-reference.md`
- 디렉토리 대표 문서: `README.md`
- 명확한 의미 전달: `deployment-checklist.md`

### 마크다운 스타일

- 제목: `#` ~ `###` 사용
- 코드 블록: 언어 명시 (```typescript)
- 표: GFM 테이블 형식
- 인코딩: UTF-8
