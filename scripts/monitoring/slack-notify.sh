#!/bin/bash
# =============================================================================
# Slack 알림 유틸리티 스크립트
# =============================================================================
# 용도: 다양한 이벤트에 대한 Slack 알림 발송
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

# Slack 설정
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
SLACK_CHANNEL="${SLACK_CHANNEL:-#alerts}"
SLACK_USERNAME="${SLACK_USERNAME:-nest-api Bot}"

# -----------------------------------------------------------------------------
# 함수 정의
# -----------------------------------------------------------------------------

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $*"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2
}

# 기본 알림 전송
send_notification() {
    local message="$1"
    local level="${2:-info}"
    local title="${3:-알림}"

    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        log_error "SLACK_WEBHOOK_URL이 설정되지 않았습니다"
        echo "Slack Webhook URL을 설정하세요:"
        echo "  export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
        return 1
    fi

    local color emoji
    case "$level" in
        "success"|"good")
            color="good"
            emoji=":white_check_mark:"
            ;;
        "warning"|"warn")
            color="warning"
            emoji=":warning:"
            ;;
        "error"|"danger"|"critical")
            color="danger"
            emoji=":rotating_light:"
            ;;
        *)
            color="#439FE0"
            emoji=":information_source:"
            ;;
    esac

    local payload=$(cat <<EOF
{
    "channel": "$SLACK_CHANNEL",
    "username": "$SLACK_USERNAME",
    "icon_emoji": "$emoji",
    "attachments": [
        {
            "color": "$color",
            "title": "$title",
            "text": "$message",
            "footer": "nest-api | $(hostname)",
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    if curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1; then
        log_info "Slack 알림 전송 완료: $title"
        return 0
    else
        log_error "Slack 알림 전송 실패"
        return 1
    fi
}

# 배포 알림
send_deploy_notification() {
    local environment="$1"
    local version="${2:-unknown}"
    local status="${3:-started}"
    local details="${4:-}"

    local color emoji title
    case "$status" in
        "started")
            color="#439FE0"
            emoji=":rocket:"
            title="배포 시작"
            ;;
        "success"|"completed")
            color="good"
            emoji=":white_check_mark:"
            title="배포 완료"
            ;;
        "failed"|"error")
            color="danger"
            emoji=":x:"
            title="배포 실패"
            ;;
        "rollback")
            color="warning"
            emoji=":rewind:"
            title="롤백 실행"
            ;;
        *)
            color="#808080"
            emoji=":gear:"
            title="배포 상태"
            ;;
    esac

    local payload=$(cat <<EOF
{
    "channel": "$SLACK_CHANNEL",
    "username": "$SLACK_USERNAME",
    "icon_emoji": "$emoji",
    "attachments": [
        {
            "color": "$color",
            "title": "$title",
            "text": "$details",
            "fields": [
                {"title": "Environment", "value": "$environment", "short": true},
                {"title": "Version", "value": "$version", "short": true},
                {"title": "Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true},
                {"title": "Host", "value": "$(hostname)", "short": true}
            ],
            "footer": "nest-api Deployment",
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1
}

# 장애 알림
send_incident_notification() {
    local title="$1"
    local description="$2"
    local severity="${3:-critical}"
    local affected_service="${4:-nest-api}"

    local color emoji
    case "$severity" in
        "critical"|"p1")
            color="danger"
            emoji=":rotating_light:"
            ;;
        "high"|"p2")
            color="danger"
            emoji=":exclamation:"
            ;;
        "medium"|"p3")
            color="warning"
            emoji=":warning:"
            ;;
        "low"|"p4")
            color="#439FE0"
            emoji=":information_source:"
            ;;
        *)
            color="#808080"
            emoji=":grey_question:"
            ;;
    esac

    local payload=$(cat <<EOF
{
    "channel": "$SLACK_CHANNEL",
    "username": "$SLACK_USERNAME",
    "icon_emoji": "$emoji",
    "attachments": [
        {
            "color": "$color",
            "title": ":warning: 장애 발생: $title",
            "text": "$description",
            "fields": [
                {"title": "Severity", "value": "$severity", "short": true},
                {"title": "Service", "value": "$affected_service", "short": true},
                {"title": "Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true},
                {"title": "Host", "value": "$(hostname)", "short": true}
            ],
            "footer": "nest-api Incident Management",
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1
}

# 복구 알림
send_recovery_notification() {
    local title="$1"
    local description="${2:-서비스가 정상 복구되었습니다.}"
    local duration="${3:-unknown}"

    local payload=$(cat <<EOF
{
    "channel": "$SLACK_CHANNEL",
    "username": "$SLACK_USERNAME",
    "icon_emoji": ":white_check_mark:",
    "attachments": [
        {
            "color": "good",
            "title": ":heavy_check_mark: 서비스 복구: $title",
            "text": "$description",
            "fields": [
                {"title": "Duration", "value": "$duration", "short": true},
                {"title": "Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true}
            ],
            "footer": "nest-api Incident Management",
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1
}

# 백업 알림
send_backup_notification() {
    local status="$1"
    local backup_type="${2:-daily}"
    local backup_size="${3:-unknown}"
    local details="${4:-}"

    local color emoji title
    case "$status" in
        "success")
            color="good"
            emoji=":floppy_disk:"
            title="백업 완료"
            ;;
        "failed"|"error")
            color="danger"
            emoji=":x:"
            title="백업 실패"
            ;;
        *)
            color="#808080"
            emoji=":hourglass_flowing_sand:"
            title="백업 진행 중"
            ;;
    esac

    local payload=$(cat <<EOF
{
    "channel": "$SLACK_CHANNEL",
    "username": "$SLACK_USERNAME",
    "icon_emoji": "$emoji",
    "attachments": [
        {
            "color": "$color",
            "title": "$title",
            "text": "$details",
            "fields": [
                {"title": "Type", "value": "$backup_type", "short": true},
                {"title": "Size", "value": "$backup_size", "short": true},
                {"title": "Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true}
            ],
            "footer": "nest-api Backup System",
            "ts": $(date +%s)
        }
    ]
}
EOF
)

    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1
}

show_usage() {
    echo "사용법: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  notify <message> [level] [title]"
    echo "      기본 알림 전송"
    echo "      level: info, success, warning, error (기본: info)"
    echo ""
    echo "  deploy <env> <version> <status> [details]"
    echo "      배포 알림 전송"
    echo "      status: started, success, failed, rollback"
    echo ""
    echo "  incident <title> <description> [severity] [service]"
    echo "      장애 알림 전송"
    echo "      severity: critical, high, medium, low"
    echo ""
    echo "  recovery <title> [description] [duration]"
    echo "      복구 알림 전송"
    echo ""
    echo "  backup <status> [type] [size] [details]"
    echo "      백업 알림 전송"
    echo "      status: success, failed"
    echo ""
    echo "Examples:"
    echo "  $0 notify \"서버 재시작 완료\" success \"알림\""
    echo "  $0 deploy prod v1.2.3 success \"Blue-Green 배포 완료\""
    echo "  $0 incident \"DB 연결 오류\" \"PostgreSQL 연결 실패\" critical"
    echo "  $0 recovery \"DB 연결 복구\" \"정상 복구됨\" \"15분\""
    echo "  $0 backup success daily \"125MB\""
}

# -----------------------------------------------------------------------------
# 메인 실행
# -----------------------------------------------------------------------------
main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        notify)
            send_notification "$@"
            ;;
        deploy)
            send_deploy_notification "$@"
            ;;
        incident)
            send_incident_notification "$@"
            ;;
        recovery)
            send_recovery_notification "$@"
            ;;
        backup)
            send_backup_notification "$@"
            ;;
        test)
            send_notification "테스트 알림입니다." "info" "테스트"
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
