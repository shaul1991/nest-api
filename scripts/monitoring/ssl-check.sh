#!/bin/bash
# =============================================================================
# SSL 인증서 만료 확인 스크립트
# =============================================================================
# 용도: SSL 인증서 만료일 확인 및 알림
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# 설정
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# 환경 변수 로드
ENV_FILE="${PROJECT_ROOT}/.env.production"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# 모니터링 대상 도메인
DOMAINS=(
    "api-nest.shaul.link"
    "dev-api-nest.shaul.link"
    # "staging-api-nest.shaul.link"  # 필요시 활성화
)

# 알림 임계값 (일)
WARNING_DAYS=14
CRITICAL_DAYS=7

# Slack 설정
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
SLACK_CHANNEL="${SLACK_CHANNEL:-#alerts}"

# 로깅
LOG_DIR="${PROJECT_ROOT}/logs/monitoring"
LOG_FILE="${LOG_DIR}/ssl-check-$(date +%Y%m%d).log"

# -----------------------------------------------------------------------------
# 함수 정의
# -----------------------------------------------------------------------------

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE" 2>/dev/null || echo "[$timestamp] [$level] $message"
}

log_info() {
    log "INFO" "$@"
}

log_warning() {
    log "WARNING" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_success() {
    log "SUCCESS" "$@"
}

send_slack_alert() {
    local level="$1"
    local domain="$2"
    local days_left="$3"
    local expiry_date="$4"

    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        log_warning "Slack Webhook URL이 설정되지 않음"
        return 0
    fi

    local color emoji title
    case "$level" in
        "critical")
            color="danger"
            emoji=":rotating_light:"
            title="SSL 인증서 만료 임박"
            ;;
        "warning")
            color="warning"
            emoji=":warning:"
            title="SSL 인증서 만료 경고"
            ;;
        "expired")
            color="danger"
            emoji=":x:"
            title="SSL 인증서 만료됨"
            ;;
        *)
            color="good"
            emoji=":lock:"
            title="SSL 인증서 상태"
            ;;
    esac

    local payload=$(cat <<EOF
{
    "channel": "$SLACK_CHANNEL",
    "username": "SSL Monitor",
    "icon_emoji": "$emoji",
    "attachments": [
        {
            "color": "$color",
            "title": "$title",
            "text": "인증서가 ${days_left}일 후 만료됩니다.",
            "fields": [
                {"title": "Domain", "value": "$domain", "short": true},
                {"title": "Days Left", "value": "${days_left}일", "short": true},
                {"title": "Expiry Date", "value": "$expiry_date", "short": true},
                {"title": "Check Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true}
            ],
            "footer": "nest-api SSL Monitor",
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    if curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1; then
        log_info "Slack 알림 전송 완료: $domain"
    else
        log_error "Slack 알림 전송 실패: $domain"
    fi
}

# 인증서 정보 조회
get_certificate_info() {
    local domain="$1"
    local port="${2:-443}"

    echo | timeout 10 openssl s_client -servername "$domain" -connect "$domain:$port" 2>/dev/null | \
        openssl x509 -noout -dates -subject -issuer 2>/dev/null
}

# 인증서 만료일 가져오기
get_expiry_date() {
    local domain="$1"
    local port="${2:-443}"

    local expiry
    expiry=$(echo | timeout 10 openssl s_client -servername "$domain" -connect "$domain:$port" 2>/dev/null | \
        openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

    echo "$expiry"
}

# 날짜를 epoch로 변환 (크로스 플랫폼)
date_to_epoch() {
    local date_str="$1"

    # Linux (GNU date)
    if date -d "$date_str" +%s 2>/dev/null; then
        return 0
    fi

    # macOS (BSD date)
    if date -j -f "%b %d %H:%M:%S %Y %Z" "$date_str" +%s 2>/dev/null; then
        return 0
    fi

    # macOS 대체 형식
    if date -j -f "%b %e %H:%M:%S %Y %Z" "$date_str" +%s 2>/dev/null; then
        return 0
    fi

    return 1
}

# 단일 도메인 인증서 확인
check_certificate() {
    local domain="$1"
    local port="${2:-443}"

    log_info "인증서 확인 중: $domain"

    # 인증서 만료일 가져오기
    local expiry_date
    expiry_date=$(get_expiry_date "$domain" "$port")

    if [[ -z "$expiry_date" ]]; then
        log_error "인증서 정보를 가져올 수 없음: $domain"
        send_slack_alert "critical" "$domain" "N/A" "인증서 접근 불가"
        return 1
    fi

    # 남은 일수 계산
    local expiry_epoch current_epoch days_left
    expiry_epoch=$(date_to_epoch "$expiry_date") || {
        log_error "날짜 파싱 실패: $expiry_date"
        return 1
    }
    current_epoch=$(date +%s)
    days_left=$(( (expiry_epoch - current_epoch) / 86400 ))

    # 결과 출력
    log_info "도메인: $domain"
    log_info "만료일: $expiry_date"
    log_info "남은 일수: ${days_left}일"

    # 상태 판단 및 알림
    if [[ $days_left -le 0 ]]; then
        log_error "인증서 만료됨: $domain"
        send_slack_alert "expired" "$domain" "$days_left" "$expiry_date"
        return 1
    elif [[ $days_left -le $CRITICAL_DAYS ]]; then
        log_error "인증서 만료 임박: $domain (${days_left}일 남음)"
        send_slack_alert "critical" "$domain" "$days_left" "$expiry_date"
        return 1
    elif [[ $days_left -le $WARNING_DAYS ]]; then
        log_warning "인증서 만료 경고: $domain (${days_left}일 남음)"
        send_slack_alert "warning" "$domain" "$days_left" "$expiry_date"
        return 0
    else
        log_success "인증서 정상: $domain (${days_left}일 남음)"
        return 0
    fi
}

# 인증서 상세 정보 출력
show_certificate_details() {
    local domain="$1"
    local port="${2:-443}"

    echo "========================================"
    echo "인증서 상세 정보: $domain"
    echo "========================================"

    echo | timeout 10 openssl s_client -servername "$domain" -connect "$domain:$port" 2>/dev/null | \
        openssl x509 -noout -text 2>/dev/null | \
        grep -E "Subject:|Issuer:|Not Before:|Not After:|DNS:" | \
        sed 's/^[[:space:]]*//'

    echo ""
}

# 인증서 체인 확인
check_certificate_chain() {
    local domain="$1"
    local port="${2:-443}"

    echo "========================================"
    echo "인증서 체인: $domain"
    echo "========================================"

    echo | timeout 10 openssl s_client -showcerts -servername "$domain" -connect "$domain:$port" 2>/dev/null | \
        grep -E "s:|i:" | head -10

    echo ""
}

# 전체 도메인 확인
check_all_domains() {
    log_info "=========================================="
    log_info "SSL 인증서 만료 확인 시작"
    log_info "=========================================="

    local has_issues=false
    local results=()

    for domain in "${DOMAINS[@]}"; do
        echo ""
        if ! check_certificate "$domain"; then
            has_issues=true
            results+=("$domain: FAILED")
        else
            results+=("$domain: OK")
        fi
    done

    echo ""
    log_info "=========================================="
    log_info "확인 결과 요약"
    log_info "=========================================="

    for result in "${results[@]}"; do
        log_info "$result"
    done

    if [[ "$has_issues" == "true" ]]; then
        log_error "일부 인증서에 문제가 있습니다"
        return 1
    else
        log_success "모든 인증서 정상"
        return 0
    fi
}

show_usage() {
    echo "사용법: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  check           모든 도메인 인증서 확인 (기본값)"
    echo "  details <도메인> 특정 도메인 인증서 상세 정보"
    echo "  chain <도메인>   특정 도메인 인증서 체인 확인"
    echo "  single <도메인>  특정 도메인 인증서만 확인"
    echo ""
    echo "Options:"
    echo "  WARNING_DAYS=14  경고 임계값 (기본: 14일)"
    echo "  CRITICAL_DAYS=7  위험 임계값 (기본: 7일)"
    echo ""
    echo "Examples:"
    echo "  $0                              # 모든 도메인 확인"
    echo "  $0 check                        # 모든 도메인 확인"
    echo "  $0 single api-nest.shaul.link   # 특정 도메인 확인"
    echo "  $0 details api-nest.shaul.link  # 상세 정보 출력"
    echo "  $0 chain api-nest.shaul.link    # 인증서 체인 확인"
    echo ""
    echo "임계값 변경 예시:"
    echo "  WARNING_DAYS=30 CRITICAL_DAYS=14 $0 check"
}

# -----------------------------------------------------------------------------
# 메인 실행
# -----------------------------------------------------------------------------
main() {
    local command="${1:-check}"
    shift || true

    case "$command" in
        check)
            check_all_domains
            ;;
        single)
            local domain="${1:-}"
            if [[ -z "$domain" ]]; then
                log_error "도메인을 지정해주세요"
                show_usage
                exit 1
            fi
            check_certificate "$domain"
            ;;
        details)
            local domain="${1:-}"
            if [[ -z "$domain" ]]; then
                log_error "도메인을 지정해주세요"
                exit 1
            fi
            show_certificate_details "$domain"
            ;;
        chain)
            local domain="${1:-}"
            if [[ -z "$domain" ]]; then
                log_error "도메인을 지정해주세요"
                exit 1
            fi
            check_certificate_chain "$domain"
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "알 수 없는 명령: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
