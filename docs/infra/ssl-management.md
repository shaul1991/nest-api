# SSL 인증서 관리 가이드

## 개요

nest-api 프로젝트는 Caddy를 리버스 프록시로 사용하며, Let's Encrypt를 통한 자동 SSL 인증서 관리를 지원합니다.

## 도메인 구성

| 환경 | 도메인 | 설명 |
|------|--------|------|
| Dev | dev-api-nest.shaul.link | 개발 환경 |
| Staging | staging-api-nest.shaul.link | 스테이징 환경 |
| Production | api-nest.shaul.link | 운영 환경 |

## Caddy 자동 인증서 관리

### Caddy의 장점

- **자동 HTTPS**: 도메인 설정만으로 자동으로 Let's Encrypt 인증서 발급
- **자동 갱신**: 인증서 만료 30일 전 자동 갱신
- **OCSP Stapling**: 자동 OCSP 스테이플링 지원
- **제로 다운타임**: 인증서 갱신 시 서비스 중단 없음

### Caddyfile 설정 예시

```
# /etc/caddy/Caddyfile

# Production
api-nest.shaul.link {
    reverse_proxy localhost:3100

    tls {
        protocols tls1.2 tls1.3
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
}

# Development
dev-api-nest.shaul.link {
    reverse_proxy localhost:3102

    tls {
        protocols tls1.2 tls1.3
    }
}

# Staging
staging-api-nest.shaul.link {
    reverse_proxy localhost:3200

    tls {
        protocols tls1.2 tls1.3
    }
}
```

## 인증서 자동 갱신 검증

### 1. Caddy 상태 확인

```bash
# Caddy 서비스 상태
sudo systemctl status caddy

# Caddy 로그 확인
sudo journalctl -u caddy -f

# Caddy 버전 확인
caddy version
```

### 2. 인증서 정보 확인

```bash
# 인증서 만료일 확인 (OpenSSL)
echo | openssl s_client -servername api-nest.shaul.link -connect api-nest.shaul.link:443 2>/dev/null | openssl x509 -noout -dates

# 인증서 상세 정보
echo | openssl s_client -servername api-nest.shaul.link -connect api-nest.shaul.link:443 2>/dev/null | openssl x509 -noout -text

# 인증서 체인 확인
echo | openssl s_client -showcerts -servername api-nest.shaul.link -connect api-nest.shaul.link:443 2>/dev/null | openssl x509 -noout -issuer -subject
```

### 3. Caddy 인증서 저장 위치

```bash
# 인증서 저장 경로 (Linux)
ls -la /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/

# 인증서 저장 경로 (macOS)
ls -la ~/Library/Application\ Support/Caddy/certificates/acme-v02.api.letsencrypt.org-directory/
```

### 4. 갱신 테스트

```bash
# Caddy 설정 검증
caddy validate --config /etc/caddy/Caddyfile

# Caddy 리로드 (갱신 트리거)
sudo systemctl reload caddy
```

## 인증서 만료 알림 스크립트

### 스크립트 위치

`scripts/monitoring/ssl-check.sh`

### 스크립트 내용

```bash
#!/bin/bash
# SSL 인증서 만료 확인 스크립트

set -euo pipefail

# 설정
DOMAINS=(
    "api-nest.shaul.link"
    "dev-api-nest.shaul.link"
    "staging-api-nest.shaul.link"
)
WARNING_DAYS=14
CRITICAL_DAYS=7

SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
SLACK_CHANNEL="${SLACK_CHANNEL:-#alerts}"

# 함수
log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $*"
}

log_warning() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $*"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*"
}

send_slack_alert() {
    local level="$1"
    local message="$2"

    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        return 0
    fi

    local color
    case "$level" in
        "critical") color="danger" ;;
        "warning") color="warning" ;;
        *) color="good" ;;
    esac

    curl -s -X POST -H 'Content-type: application/json' \
        --data "{\"channel\":\"$SLACK_CHANNEL\",\"attachments\":[{\"color\":\"$color\",\"title\":\"SSL Certificate Alert\",\"text\":\"$message\"}]}" \
        "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
}

check_certificate() {
    local domain="$1"

    # 인증서 만료일 가져오기
    local expiry_date
    expiry_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | \
        openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

    if [[ -z "$expiry_date" ]]; then
        log_error "인증서 정보를 가져올 수 없음: $domain"
        send_slack_alert "critical" "SSL 인증서 정보를 가져올 수 없습니다: $domain"
        return 1
    fi

    # 남은 일수 계산
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))

    log_info "$domain: 인증서 만료까지 ${days_left}일 남음 (만료일: $expiry_date)"

    if [[ $days_left -le $CRITICAL_DAYS ]]; then
        log_error "인증서 만료 임박: $domain (${days_left}일 남음)"
        send_slack_alert "critical" "SSL 인증서가 ${days_left}일 후 만료됩니다: $domain"
        return 1
    elif [[ $days_left -le $WARNING_DAYS ]]; then
        log_warning "인증서 만료 경고: $domain (${days_left}일 남음)"
        send_slack_alert "warning" "SSL 인증서가 ${days_left}일 후 만료됩니다: $domain"
    fi

    return 0
}

# 메인 실행
main() {
    log_info "SSL 인증서 만료 확인 시작"

    local has_issues=false

    for domain in "${DOMAINS[@]}"; do
        if ! check_certificate "$domain"; then
            has_issues=true
        fi
    done

    if [[ "$has_issues" == "true" ]]; then
        log_error "일부 인증서에 문제가 있습니다"
        exit 1
    fi

    log_info "모든 인증서 정상"
}

main "$@"
```

## Crontab 설정

```bash
# 인증서 만료 확인 - 매일 09:00
0 9 * * * /opt/projects/nest-api/scripts/monitoring/ssl-check.sh >> /opt/projects/nest-api/logs/ssl-check.log 2>&1
```

## 문제 해결

### 인증서 발급 실패

1. **DNS 확인**
```bash
dig +short api-nest.shaul.link
nslookup api-nest.shaul.link
```

2. **포트 80 접근 확인**
```bash
# Let's Encrypt는 HTTP-01 챌린지에 포트 80 필요
curl -I http://api-nest.shaul.link/.well-known/acme-challenge/test
```

3. **방화벽 확인**
```bash
sudo ufw status
sudo iptables -L -n
```

4. **Caddy 로그 확인**
```bash
sudo journalctl -u caddy --since "1 hour ago" | grep -i "certificate\|tls\|acme"
```

### 인증서 강제 갱신

```bash
# Caddy 인증서 갱신 (리로드)
sudo systemctl reload caddy

# 인증서 캐시 삭제 후 재발급 (주의: 서비스 중단 가능)
sudo rm -rf /var/lib/caddy/.local/share/caddy/certificates/
sudo systemctl restart caddy
```

### Rate Limit 오류

Let's Encrypt는 rate limit이 있습니다:
- 주당 동일 도메인 50개 인증서
- 실패 시 시간당 5회 재시도

스테이징 테스트 시 Let's Encrypt 스테이징 서버 사용:

```
# Caddyfile (스테이징 테스트용)
{
    acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}

test.example.com {
    reverse_proxy localhost:3000
}
```

## 모니터링 대시보드

### SSL Labs 테스트

온라인에서 SSL 설정 품질 테스트:
```
https://www.ssllabs.com/ssltest/analyze.html?d=api-nest.shaul.link
```

### 권장 보안 헤더

```
# Caddyfile 보안 헤더 설정
api-nest.shaul.link {
    header {
        # HSTS (2년)
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"

        # 콘텐츠 타입 스니핑 방지
        X-Content-Type-Options "nosniff"

        # 클릭재킹 방지
        X-Frame-Options "DENY"

        # XSS 필터 활성화
        X-XSS-Protection "1; mode=block"

        # 리퍼러 정책
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

## 참고 자료

- [Caddy 공식 문서](https://caddyserver.com/docs/)
- [Let's Encrypt 문서](https://letsencrypt.org/docs/)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)
