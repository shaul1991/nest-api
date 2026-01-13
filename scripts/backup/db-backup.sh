#!/bin/bash
# =============================================================================
# PostgreSQL 데이터베이스 백업 스크립트
# =============================================================================
# 용도: 일간/주간 자동 백업
# 보존 정책: 일간 7일, 주간 4주
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# 설정
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# 환경 변수 로드 (기본값: .env.production)
ENV_FILE="${PROJECT_ROOT}/.env.production"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# 백업 설정
BACKUP_TYPE="${1:-daily}"  # daily 또는 weekly
BACKUP_BASE_DIR="${BACKUP_DIR:-/opt/backups/nest-api}"
BACKUP_DAILY_DIR="${BACKUP_BASE_DIR}/daily"
BACKUP_WEEKLY_DIR="${BACKUP_BASE_DIR}/weekly"

# 데이터베이스 설정
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-nest_api}"
DB_USER="${DATABASE_USER:-nestjs}"
DB_PASSWORD="${DATABASE_PASSWORD:-}"

# 보존 정책
DAILY_RETENTION_DAYS=7
WEEKLY_RETENTION_WEEKS=4

# 로깅
LOG_DIR="${BACKUP_BASE_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup-$(date +%Y%m%d).log"

# Slack 알림 (선택적)
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# -----------------------------------------------------------------------------
# 함수 정의
# -----------------------------------------------------------------------------

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
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

send_slack_notification() {
    local status="$1"
    local message="$2"

    if [[ -z "$SLACK_WEBHOOK_URL" ]]; then
        return 0
    fi

    local color
    case "$status" in
        "success") color="good" ;;
        "warning") color="warning" ;;
        "error") color="danger" ;;
        *) color="#808080" ;;
    esac

    local payload=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "DB Backup - ${BACKUP_TYPE}",
            "text": "$message",
            "fields": [
                {"title": "Database", "value": "$DB_NAME", "short": true},
                {"title": "Type", "value": "$BACKUP_TYPE", "short": true},
                {"title": "Time", "value": "$(date '+%Y-%m-%d %H:%M:%S')", "short": true},
                {"title": "Host", "value": "$(hostname)", "short": true}
            ],
            "footer": "nest-api Backup System"
        }
    ]
}
EOF
)

    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null 2>&1 || true
}

create_directories() {
    log_info "백업 디렉토리 생성 중..."
    mkdir -p "$BACKUP_DAILY_DIR"
    mkdir -p "$BACKUP_WEEKLY_DIR"
    mkdir -p "$LOG_DIR"
}

perform_backup() {
    local backup_dir
    local filename
    local timestamp=$(date +%Y%m%d_%H%M%S)

    if [[ "$BACKUP_TYPE" == "weekly" ]]; then
        backup_dir="$BACKUP_WEEKLY_DIR"
        filename="backup_weekly_${timestamp}.sql.gz"
    else
        backup_dir="$BACKUP_DAILY_DIR"
        filename="backup_daily_${timestamp}.sql.gz"
    fi

    local backup_path="${backup_dir}/${filename}"

    log_info "백업 시작: $backup_path"
    log_info "데이터베이스: $DB_NAME @ $DB_HOST:$DB_PORT"

    # pg_dump 실행
    export PGPASSWORD="$DB_PASSWORD"

    if pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        2>> "$LOG_FILE" | gzip > "$backup_path"; then

        local backup_size=$(du -h "$backup_path" | cut -f1)
        log_success "백업 완료: $backup_path (크기: $backup_size)"

        # 체크섬 생성
        sha256sum "$backup_path" > "${backup_path}.sha256"
        log_info "체크섬 생성 완료: ${backup_path}.sha256"

        send_slack_notification "success" "백업 성공: $filename (크기: $backup_size)"
        return 0
    else
        log_error "백업 실패!"
        send_slack_notification "error" "백업 실패: $filename"
        return 1
    fi
}

cleanup_old_backups() {
    log_info "오래된 백업 정리 중..."

    # 일간 백업 정리 (7일 이상)
    local daily_deleted=$(find "$BACKUP_DAILY_DIR" -name "backup_daily_*.sql.gz" -type f -mtime +$DAILY_RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
    find "$BACKUP_DAILY_DIR" -name "backup_daily_*.sql.gz.sha256" -type f -mtime +$DAILY_RETENTION_DAYS -delete 2>/dev/null || true
    log_info "일간 백업 정리: ${daily_deleted}개 파일 삭제 (${DAILY_RETENTION_DAYS}일 이상)"

    # 주간 백업 정리 (4주 이상 = 28일)
    local weekly_retention_days=$((WEEKLY_RETENTION_WEEKS * 7))
    local weekly_deleted=$(find "$BACKUP_WEEKLY_DIR" -name "backup_weekly_*.sql.gz" -type f -mtime +$weekly_retention_days -delete -print 2>/dev/null | wc -l)
    find "$BACKUP_WEEKLY_DIR" -name "backup_weekly_*.sql.gz.sha256" -type f -mtime +$weekly_retention_days -delete 2>/dev/null || true
    log_info "주간 백업 정리: ${weekly_deleted}개 파일 삭제 (${WEEKLY_RETENTION_WEEKS}주 이상)"
}

show_backup_status() {
    log_info "=== 백업 상태 ==="

    local daily_count=$(find "$BACKUP_DAILY_DIR" -name "backup_daily_*.sql.gz" -type f 2>/dev/null | wc -l)
    local weekly_count=$(find "$BACKUP_WEEKLY_DIR" -name "backup_weekly_*.sql.gz" -type f 2>/dev/null | wc -l)
    local daily_size=$(du -sh "$BACKUP_DAILY_DIR" 2>/dev/null | cut -f1 || echo "0")
    local weekly_size=$(du -sh "$BACKUP_WEEKLY_DIR" 2>/dev/null | cut -f1 || echo "0")

    log_info "일간 백업: ${daily_count}개 파일 (${daily_size})"
    log_info "주간 백업: ${weekly_count}개 파일 (${weekly_size})"
    log_info "===================="
}

verify_backup() {
    local latest_backup

    if [[ "$BACKUP_TYPE" == "weekly" ]]; then
        latest_backup=$(find "$BACKUP_WEEKLY_DIR" -name "backup_weekly_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    else
        latest_backup=$(find "$BACKUP_DAILY_DIR" -name "backup_daily_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    fi

    if [[ -n "$latest_backup" && -f "$latest_backup" ]]; then
        # gzip 무결성 검사
        if gzip -t "$latest_backup" 2>/dev/null; then
            log_success "백업 파일 무결성 검증 통과: $latest_backup"
            return 0
        else
            log_error "백업 파일 손상됨: $latest_backup"
            return 1
        fi
    fi

    return 0
}

# -----------------------------------------------------------------------------
# Docker 환경 지원
# -----------------------------------------------------------------------------
perform_docker_backup() {
    local backup_dir
    local filename
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local container_name="${POSTGRES_CONTAINER:-nest-api-postgres}"

    if [[ "$BACKUP_TYPE" == "weekly" ]]; then
        backup_dir="$BACKUP_WEEKLY_DIR"
        filename="backup_weekly_${timestamp}.sql.gz"
    else
        backup_dir="$BACKUP_DAILY_DIR"
        filename="backup_daily_${timestamp}.sql.gz"
    fi

    local backup_path="${backup_dir}/${filename}"

    log_info "Docker 백업 시작: $backup_path"
    log_info "컨테이너: $container_name"

    if docker exec "$container_name" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=plain \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        2>> "$LOG_FILE" | gzip > "$backup_path"; then

        local backup_size=$(du -h "$backup_path" | cut -f1)
        log_success "Docker 백업 완료: $backup_path (크기: $backup_size)"

        sha256sum "$backup_path" > "${backup_path}.sha256"
        log_info "체크섬 생성 완료"

        send_slack_notification "success" "백업 성공: $filename (크기: $backup_size)"
        return 0
    else
        log_error "Docker 백업 실패!"
        send_slack_notification "error" "백업 실패: $filename"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# 메인 실행
# -----------------------------------------------------------------------------
main() {
    log_info "=========================================="
    log_info "PostgreSQL 백업 시작"
    log_info "백업 타입: $BACKUP_TYPE"
    log_info "=========================================="

    create_directories

    # Docker 환경 확인
    local use_docker="${USE_DOCKER_BACKUP:-false}"

    if [[ "$use_docker" == "true" ]]; then
        perform_docker_backup
    else
        perform_backup
    fi

    local backup_result=$?

    cleanup_old_backups
    show_backup_status
    verify_backup

    log_info "=========================================="
    log_info "백업 프로세스 완료"
    log_info "=========================================="

    return $backup_result
}

# 스크립트 실행
main "$@"
