# Agent 구조 가이드

## 개요

이 프로젝트는 직군별/역할별/작업별로 구조화된 Agent 시스템을 사용합니다.

## 주요 명령어

### /new-feature

새로운 기능 개발 시 모든 팀이 협력하여 계획을 수립하는 오케스트레이터입니다.

```bash
/new-feature                    # 대화형으로 기능 정보 입력
/new-feature 파일 업로드 기능    # 기능명 직접 지정
```

**워크플로우:**
1. 기능 요구사항 수집
2. 코드베이스 탐색
3. 팀별 병렬 논의 (Backend, DevOps, QA, Security)
4. 종합 계획 수립
5. 문서 생성 (`docs/features/<기능명>/`)

---

## Agent 계층 구조

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Agent System                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   DevOps     │  │   Backend    │  │     QA       │  │   Security   │ │
│  │     팀       │  │     팀       │  │     팀       │  │     팀       │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐ │
│  │ • Deployer   │  │ • Developer  │  │ • Tester     │  │ • Auditor    │ │
│  │ • Monitor    │  │ • Architect  │  │ • Analyst    │  │ • Pentester  │ │
│  │ • Infra      │  │ • Reviewer   │  │              │  │              │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐ │
│  │ deploy       │  │ review       │  │ test         │  │ audit        │ │
│  │ rollback     │  │ refactor     │  │ e2e          │  │ scan         │ │
│  │ scale        │  │ optimize     │  │ load         │  │ report       │ │
│  │ backup       │  │ debug        │  │ coverage     │  │              │ │
│  │ monitor      │  │ document     │  │              │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 사용 방법

### 명령어 형식
```
/{팀}-{역할}-{작업}
```

### 예시
```bash
# DevOps 팀
/devops-deployer-deploy dev     # Dev 환경 배포
/devops-deployer-rollback prod  # Prod 환경 롤백
/devops-monitor-status          # 시스템 상태 확인
/devops-monitor-logs dev        # 로그 확인
/devops-infra-scale             # 스케일링

# Backend 팀
/backend-developer-debug        # 디버깅
/backend-architect-design       # 아키텍처 설계
/backend-reviewer-review        # 코드 리뷰

# QA 팀
/qa-tester-test                 # 테스트 실행
/qa-tester-e2e                  # E2E 테스트
/qa-analyst-load                # 부하 테스트

# Security 팀
/security-auditor-audit         # 보안 감사
/security-pentester-scan        # 취약점 스캔
```

## 팀별 Skills

각 팀의 Skill은 자동으로 감지되어 관련 작업 요청 시 활성화됩니다.

| 팀 | Skill | 트리거 키워드 |
|----|-------|---------------|
| DevOps | devops-deployer | 배포, deploy, rollback |
| DevOps | devops-monitor | 모니터링, 상태, 로그 |
| DevOps | devops-infra | 인프라, 스케일링, 백업 |
| Backend | backend-developer | 개발, 디버그, 버그 |
| Backend | backend-architect | 설계, 아키텍처, 구조 |
| Backend | backend-reviewer | 리뷰, 검토, PR |
| QA | qa-tester | 테스트, 검증 |
| QA | qa-analyst | 성능, 부하, 분석 |
| Security | security-auditor | 보안, 감사, 취약점 |

## 파일 구조

```
.claude/
├── AGENTS.md                    # 이 문서
├── commands/
│   ├── new-feature.md           # 새 기능 오케스트레이터
│   ├── devops/
│   │   ├── deployer/
│   │   │   ├── deploy.md
│   │   │   └── rollback.md
│   │   ├── monitor/
│   │   │   ├── status.md
│   │   │   └── logs.md
│   │   └── infra/
│   │       ├── scale.md
│   │       └── backup.md
│   ├── backend/
│   │   ├── developer/
│   │   │   ├── debug.md
│   │   │   └── optimize.md
│   │   ├── architect/
│   │   │   └── design.md
│   │   └── reviewer/
│   │       └── review.md
│   ├── qa/
│   │   ├── tester/
│   │   │   ├── test.md
│   │   │   └── e2e.md
│   │   └── analyst/
│   │       └── load.md
│   └── security/
│       ├── auditor/
│       │   └── audit.md
│       └── pentester/
│           └── scan.md
└── skills/
    ├── new-feature/             # 새 기능 오케스트레이터
    ├── devops-deployer/
    ├── devops-monitor/
    ├── devops-infra/
    ├── backend-developer/
    ├── backend-architect/
    ├── backend-reviewer/
    ├── qa-tester/
    ├── qa-analyst/
    ├── security-auditor/
    └── security-pentester/
```

## 오케스트레이터 명령어

| 명령어 | 설명 | 참여 팀 |
|--------|------|---------|
| `/new-feature` | 새 기능 개발 계획 | 전체 (Backend, DevOps, QA, Security) |
