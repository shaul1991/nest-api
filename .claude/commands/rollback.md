---
description: 이전 버전으로 롤백
argument-hint: [dev|prod]
allowed-tools: Bash(docker:*), Bash(cat:*), Bash(echo:*), Bash(systemctl reload:*)
---

# 롤백 실행

환경: $1

## 현재 상태

- 활성 슬롯: !`cat /opt/nest-api/.active-slot-$1 2>/dev/null || echo "unknown"`
- 사용 가능한 이미지:
!`docker images nest-api --format "{{.Tag}}" | head -5`

## 경고

롤백은 이전 슬롯으로 트래픽을 전환합니다.
이전 슬롯의 컨테이너가 중지된 경우 다시 시작해야 합니다.

## 작업

$1 환경을 이전 슬롯으로 롤백합니다:

1. 현재 활성 슬롯 확인
2. 이전 슬롯 컨테이너 시작 (필요시)
3. 헬스체크 수행
4. Caddy 업스트림 변경
5. 상태 파일 업데이트

사용자에게 각 단계를 설명하면서 진행합니다.
