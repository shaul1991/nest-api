---
description: "[DevOps/Infra] 리소스 스케일링 안내"
allowed-tools: Bash(docker:*), Read
---

# DevOps Infrastructure - 스케일링

## Agent 정보
- **팀**: DevOps
- **역할**: Infrastructure
- **작업**: Scale

## 현재 구성

현재 단일 인스턴스 Blue-Green 구성입니다.

### 리소스 현황
!`docker stats --no-stream --filter "name=nest-api" --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null`

## 스케일링 옵션

### 1. 수직 스케일링 (Scale Up)
컨테이너 리소스 제한 조정
```yaml
# docker-compose.blue-green.yml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

### 2. 수평 스케일링 (Scale Out)
복수 인스턴스 운영 시 필요한 구성:
- 로드밸런서 (Caddy upstream 그룹)
- 세션 스토어 (Redis)
- 데이터베이스 복제

### 3. 데이터베이스 스케일링
- Read Replica 추가
- Connection Pooling (PgBouncer)

## 권고사항

현재 트래픽과 리소스 사용량을 분석하여
적절한 스케일링 전략을 제안합니다.
