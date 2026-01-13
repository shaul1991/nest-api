#!/bin/bash
# =============================================================================
# 헬스체크 및 모니터링 스크립트
# =============================================================================
# 용도: API 서버 헬스체크 및 알림 발송
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

# 모니터링 대상 설정
ENVIRONMENT="${1:-prod}"

# 환경별 URL 설정
case "$ENVIRONMENT" in
    dev)
        API_BASE_URL="${DEV_API_URL:-https://dev-api-nest.shaul.link}"
        ;;
    staging)
        API_BASE_URL="${STAGING_API_URL:-https://staging-api-nest.shaul.link}"
        ;;
    prod|production)
        API_BASE_URL="${PROD_API_URL:-https://api-nest.shaul.link}"
        ;;
    *)
        API_BASE_URL="$ENVIRONMENT"  # 직접 URL 지정 가능
        ;;
esac

# 헬스체크 엔드포인트
HEALTH_ENDPOINTS=(
    "/health/live"
    "/health/ready"
)

# 타임아웃 설정 (초)
TIMEOUT=10
RETRY_COUNT=3
RETRY_DELAY=5

# Slack 설정
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
SLACK_CHANNEL="${SLACK_CHANNEL:-#alerts}"

# 로깅
LOG_DIR="${PROJECT_ROOT}/logs/monitoring"
LOG_FILE="${LOG_DIR}/health-check-$(date +%Y%m%d).log"

# 상태 파일 (알림 중복 방지)
STATE_DIR="${PROJECT_ROOT}/.monitoring"
STATE_FILE="${STATE_DIR}/health-state-${ENVIRONMENT}.json"

# -----------------------------------------------------------------------------
# 함수 정의
# -----------------------------------------------------------------------------

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] [$ENVIRONMENT] $message" | tee -a "$LOG_FILE" 2>/dev/null || echo "[$timestamp] [$level] [$ENVIRONMENT] $message"
}

log_info() {
    log "INFO" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_success() {
    log "SUCCESS" "$@"
}

log_warning() {
    log "WARNING" "$@"
}

init_directories() {
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    mkdir -p "$STATE_DIR" 2>/dev/null || true
}

# Slack 메시지 전송
send_slack_alert() {
    local status="$1"
    local title="$2"
    local message="$3"
    local details="${4:-}"

    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        log_warning "Slack Webhook URL이 설정되지 않음"
        return 0
    fi

    local color
    local emoji
    case "$status" in
        "critical")
            color="danger"
            emoji=":rotating_light:"
            ;;
        "warning")
            color="warning"
            emoji=":warning:"
            ;;
        "success"|"resolved")
            color="good"
            emoji=":white_check_mark:"
            ;;
        *)
            color="#808080"
            emoji=":information_source:"
            ;;
    esac

    local fields=""
    if [[ -n "$details" ]]; then
        fields=",\"fields\": $details"
    fi

    local payload=$(cat <<EOF
{
    "channel": "$SLACK_CHANNEL",
    "username": "Health Monitor",
    "icon_emoji": "$emoji",
    "attachments": [
        {
            "color": "$color",
            "title": "$title",
            "text": "$message",
            "fields": [
                {"title": "Environment", "value": "$ENVIRONMENT", "short": true},
                {"title": "Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true},
                {"title": "Host", "value": "$(hostname)", "short": true},
                {"title": "URL", "value": "$API_BASE_URL", "short": true}
            ],
            "footer": "nest-api Health Monitor",
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    if curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1; then
        log_info "Slack 알림 전송 완료"
    else
        log_error "Slack 알림 전송 실패"
    fi
}

# 상태 저장/로드
load_state() {
    if [[ -f "$STATE_FILE" ]]; then
        cat "$STATE_FILE"
    else
        echo '{}'
    fi
}

save_state() {
    local state="$1"
    echo "$state" > "$STATE_FILE"
}

get_state_value() {
    local key="$1"
    local state=$(load_state)
    echo "$state" | grep -o "\"$key\":[^,}]*" | cut -d':' -f2 | tr -d '"' || echo ""
}

set_state_value() {
    local key="$1"
    local value="$2"
    local state=$(load_state)

    if echo "$state" | grep -q "\"$key\""; then
        state=$(echo "$state" | sed "s/\"$key\":[^,}]*/\"$key\":\"$value\"/")
    else
        if [[ "$state" == "{}" ]]; then
            state="{\"$key\":\"$value\"}"
        else
            state=$(echo "$state" | sed "s/}$/,\"$key\":\"$value\"}/")
        fi
    fi

    save_state "$state"
}

# 단일 엔드포인트 헬스체크
check_endpoint() {
    local endpoint="$1"
    local url="${API_BASE_URL}${endpoint}"
    local attempt=1

    while [[ $attempt -le $RETRY_COUNT ]]; do
        log_info "헬스체크 시도 $attempt/$RETRY_COUNT: $url"

        local start_time=$(date +%s%3N)
        local response
        local http_code

        response=$(curl -s -w "\n%{http_code}" --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$url" 2>&1) || true
        http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')

        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))

        if [[ "$http_code" == "200" ]]; then
            log_success "헬스체크 성공: $endpoint (응답시간: ${response_time}ms)"
            echo "success|$response_time|$http_code|$body"
            return 0
        fi

        log_warning "헬스체크 실패 (시도 $attempt): HTTP $http_code"
        ((attempt++))

        if [[ $attempt -le $RETRY_COUNT ]]; then
            log_info "${RETRY_DELAY}초 후 재시도..."
            sleep "$RETRY_DELAY"
        fi
    done

    log_error "헬스체크 최종 실패: $endpoint (HTTP: $http_code)"
    echo "failure|0|$http_code|$body"
    return 1
}

# 전체 헬스체크 실행
run_health_checks() {
    log_info "=========================================="
    log_info "헬스체크 시작: $API_BASE_URL"
    log_info "=========================================="

    local all_healthy=true
    local failed_endpoints=()
    local results=()

    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        local result=$(check_endpoint "$endpoint")
        local status=$(echo "$result" | cut -d'|' -f1)

        results+=("$endpoint:$result")

        if [[ "$status" != "success" ]]; then
            all_healthy=false
            failed_endpoints+=("$endpoint")
        fi
    done

    # 이전 상태 확인
    local previous_status=$(get_state_value "status")
    local current_status

    if [[ "$all_healthy" == "true" ]]; then
        current_status="healthy"
        log_success "모든 헬스체크 통과"

        # 이전에 장애였다면 복구 알림
        if [[ "$previous_status" == "unhealthy" ]]; then
            send_slack_alert "resolved" \
                "서비스 복구" \
                "모든 헬스체크가 정상으로 복구되었습니다."
        fi
    else
        current_status="unhealthy"
        log_error "헬스체크 실패: ${failed_endpoints[*]}"

        # 이전에 정상이었다면 장애 알림
        if [[ "$previous_status" != "unhealthy" ]]; then
            local failed_list=$(printf '%s, ' "${failed_endpoints[@]}")
            send_slack_alert "critical" \
                "헬스체크 실패" \
                "다음 엔드포인트에서 오류가 발생했습니다: ${failed_list%, }"
        fi
    fi

    # 상태 저장
    set_state_value "status" "$current_status"
    set_state_value "last_check" "$(date +%s)"
    set_state_value "failed_endpoints" "$(printf '%s,' "${failed_endpoints[@]}")"

    log_info "=========================================="
    log_info "헬스체크 완료: $current_status"
    log_info "=========================================="

    if [[ "$all_healthy" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# 추가 서비스 체크 (DB, Redis 등)
check_dependencies() {
    log_info "의존성 서비스 체크..."

    local issues=()

    # PostgreSQL 체크 (Docker 환경)
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "postgres"; then
        if docker exec nest-api-postgres pg_isready -U postgres > /dev/null 2>&1; then
            log_success "PostgreSQL: 정상"
        else
            log_error "PostgreSQL: 응답 없음"
            issues+=("PostgreSQL")
        fi
    fi

    # Redis 체크 (Docker 환경)
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "redis"; then
        if docker exec nest-api-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
            log_success "Redis: 정상"
        else
            log_error "Redis: 응답 없음"
            issues+=("Redis")
        fi
    fi

    if [[ ${#issues[@]} -gt 0 ]]; then
        local issue_list=$(printf '%s, ' "${issues[@]}")
        send_slack_alert "warning" \
            "의존성 서비스 경고" \
            "다음 서비스에서 문제가 감지되었습니다: ${issue_list%, }"
        return 1
    fi

    return 0
}

# 디스크 사용량 체크
check_disk_usage() {
    log_info "디스크 사용량 체크..."

    local threshold=85
    local warnings=()

    while read -r line; do
        local usage=$(echo "$line" | awk '{print $5}' | tr -d '%')
        local mount=$(echo "$line" | awk '{print $6}')

        if [[ $usage -ge $threshold ]]; then
            log_warning "디스크 경고: $mount (${usage}%)"
            warnings+=("$mount: ${usage}%")
        fi
    done < <(df -h | grep -E '^/' | grep -v 'tmpfs')

    if [[ ${#warnings[@]} -gt 0 ]]; then
        local warning_list=$(printf '%s, ' "${warnings[@]}")
        send_slack_alert "warning" \
            "디스크 사용량 경고" \
            "다음 마운트 포인트의 사용량이 ${threshold}%를 초과했습니다: ${warning_list%, }"
    fi
}

# 메모리 사용량 체크
check_memory_usage() {
    log_info "메모리 사용량 체크..."

    local threshold=90

    if command -v free > /dev/null 2>&1; then
        local memory_info=$(free | grep Mem)
        local total=$(echo "$memory_info" | awk '{print $2}')
        local used=$(echo "$memory_info" | awk '{print $3}')
        local usage=$((used * 100 / total))

        if [[ $usage -ge $threshold ]]; then
            log_warning "메모리 경고: ${usage}% 사용 중"
            send_slack_alert "warning" \
                "메모리 사용량 경고" \
                "메모리 사용량이 ${usage}%입니다. (임계치: ${threshold}%)"
        else
            log_info "메모리 사용량: ${usage}%"
        fi
    fi
}

show_usage() {
    echo "사용법: $0 [environment] [command]"
    echo ""
    echo "Environments:"
    echo "  dev        개발 환경"
    echo "  staging    스테이징 환경"
    echo "  prod       운영 환경 (기본값)"
    echo ""
    echo "Commands:"
    echo "  check      헬스체크만 실행 (기본값)"
    echo "  full       전체 체크 (헬스체크 + 의존성 + 시스템)"
    echo "  deps       의존성 서비스만 체크"
    echo "  system     시스템 리소스만 체크"
    echo ""
    echo "Examples:"
    echo "  $0                  # prod 환경 헬스체크"
    echo "  $0 dev              # dev 환경 헬스체크"
    echo "  $0 prod full        # prod 환경 전체 체크"
    echo "  $0 staging check    # staging 환경 헬스체크"
}

# -----------------------------------------------------------------------------
# 메인 실행
# -----------------------------------------------------------------------------
main() {
    local command="${2:-check}"

    init_directories

    case "$command" in
        check)
            run_health_checks
            ;;
        full)
            run_health_checks
            check_dependencies
            check_disk_usage
            check_memory_usage
            ;;
        deps)
            check_dependencies
            ;;
        system)
            check_disk_usage
            check_memory_usage
            ;;
        help|--help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "알 수 없는 명령: $command"
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
