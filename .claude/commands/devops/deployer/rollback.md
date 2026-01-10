---
description: "[DevOps/Deployer] 이전 버전으로 롤백"
argument-hint: [dev|prod] [image-tag]
allowed-tools: Bash(docker:*), Bash(cat:*), Bash(echo:*), Bash(systemctl:*), Bash(curl:*), Read, Edit
---

# DevOps Deployer - 롤백

## Agent 정보
- **팀**: DevOps
- **역할**: Deployer
- **작업**: Rollback

## 환경: $1
## 이미지 태그: $2 (옵션)

### 현재 상태
- 활성 슬롯: !`cat /opt/nest-api/.active-slot-$1 2>/dev/null || echo "unknown"`
- 사용 가능 이미지:
!`docker images nest-api --format "table {{.Tag}}\t{{.CreatedAt}}" | head -6`

## 롤백 방법

### 방법 1: 슬롯 전환 (빠른 롤백)
이전 슬롯이 아직 존재하면 트래픽만 전환

### 방법 2: 특정 버전 배포
$2 태그의 이미지로 새로 배포

## 작업 수행

사용자의 선택에 따라:

1. **슬롯 전환 롤백**
   - 이전 슬롯 컨테이너 시작
   - 헬스체크 확인
   - Caddy 업스트림 변경
   - 상태 파일 업데이트

2. **특정 버전 롤백**
   - IMAGE_TAG 환경변수 설정
   - deploy.sh 실행

각 단계를 설명하며 진행합니다.
