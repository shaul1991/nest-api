#!/bin/bash
# =============================================================================
# PostgreSQL 데이터베이스 복원 스크립트
# =============================================================================
# 용도: 백업 파일로부터 데이터베이스 복원
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

# 데이터베이스 설정
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-nest_api}"
DB_USER="${DATABASE_USER:-nestjs}"
DB_PASSWORD="${DATABASE_PASSWORD:-}"

# 백업 경로
BACKUP_BASE_DIR="${BACKUP_DIR:-/opt/backups/nest-api}"

# -----------------------------------------------------------------------------
# 함수 정의
# -----------------------------------------------------------------------------

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $*"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $*"
}

log_warning() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $*"
}

list_backups() {
    echo "=== 사용 가능한 백업 파일 ==="
    echo ""
    echo "[일간 백업]"
    ls -lh "$BACKUP_BASE_DIR/daily/" 2>/dev/null | grep ".sql.gz$" | tail -10 || echo "  백업 파일 없음"
    echo ""
    echo "[주간 백업]"
    ls -lh "$BACKUP_BASE_DIR/weekly/" 2>/dev/null | grep ".sql.gz$" | tail -10 || echo "  백업 파일 없음"
    echo ""
}

verify_backup_file() {
    local backup_file="$1"

    if [[ ! -f "$backup_file" ]]; then
        log_error "백업 파일을 찾을 수 없습니다: $backup_file"
        return 1
    fi

    log_info "백업 파일 검증 중..."

    # gzip 무결성 검사
    if ! gzip -t "$backup_file" 2>/dev/null; then
        log_error "백업 파일이 손상되었습니다: $backup_file"
        return 1
    fi

    # 체크섬 검증 (있는 경우)
    if [[ -f "${backup_file}.sha256" ]]; then
        if sha256sum -c "${backup_file}.sha256" 2>/dev/null; then
            log_info "체크섬 검증 통과"
        else
            log_warning "체크섬 검증 실패 - 계속 진행하시겠습니까?"
            read -p "계속 진행 (y/N): " confirm
            if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
                return 1
            fi
        fi
    fi

    log_success "백업 파일 검증 완료: $backup_file"
    return 0
}

restore_backup() {
    local backup_file="$1"

    log_info "복원 시작: $backup_file"
    log_info "대상 데이터베이스: $DB_NAME @ $DB_HOST:$DB_PORT"

    # 확인 메시지
    log_warning "이 작업은 기존 데이터를 덮어씁니다!"
    read -p "정말 복원하시겠습니까? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "복원 취소됨"
        return 0
    fi

    export PGPASSWORD="$DB_PASSWORD"

    log_info "데이터베이스 복원 중..."
    if gunzip -c "$backup_file" | psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --quiet \
        2>&1; then

        log_success "데이터베이스 복원 완료!"
        return 0
    else
        log_error "데이터베이스 복원 실패!"
        return 1
    fi
}

restore_docker() {
    local backup_file="$1"
    local container_name="${POSTGRES_CONTAINER:-nest-api-postgres}"

    log_info "Docker 복원 시작: $backup_file"
    log_info "대상 컨테이너: $container_name"

    # 확인 메시지
    log_warning "이 작업은 기존 데이터를 덮어씁니다!"
    read -p "정말 복원하시겠습니까? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "복원 취소됨"
        return 0
    fi

    log_info "데이터베이스 복원 중..."
    if gunzip -c "$backup_file" | docker exec -i "$container_name" psql \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --quiet \
        2>&1; then

        log_success "데이터베이스 복원 완료!"
        return 0
    else
        log_error "데이터베이스 복원 실패!"
        return 1
    fi
}

show_usage() {
    echo "사용법: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                    사용 가능한 백업 파일 목록"
    echo "  restore <backup_file>   지정된 백업 파일로 복원"
    echo "  latest [daily|weekly]   최신 백업으로 복원"
    echo "  docker <backup_file>    Docker 환경에서 복원"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 restore /opt/backups/nest-api/daily/backup_daily_20250114_030000.sql.gz"
    echo "  $0 latest daily"
    echo "  $0 docker /opt/backups/nest-api/weekly/backup_weekly_20250113_030000.sql.gz"
}

get_latest_backup() {
    local type="${1:-daily}"
    local backup_dir

    if [[ "$type" == "weekly" ]]; then
        backup_dir="$BACKUP_BASE_DIR/weekly"
        find "$backup_dir" -name "backup_weekly_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-
    else
        backup_dir="$BACKUP_BASE_DIR/daily"
        find "$backup_dir" -name "backup_daily_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-
    fi
}

# -----------------------------------------------------------------------------
# 메인 실행
# -----------------------------------------------------------------------------
main() {
    local command="${1:-help}"

    case "$command" in
        list)
            list_backups
            ;;
        restore)
            local backup_file="${2:-}"
            if [[ -z "$backup_file" ]]; then
                log_error "백업 파일 경로를 지정해주세요"
                show_usage
                exit 1
            fi
            verify_backup_file "$backup_file" && restore_backup "$backup_file"
            ;;
        latest)
            local type="${2:-daily}"
            local latest_backup=$(get_latest_backup "$type")
            if [[ -z "$latest_backup" ]]; then
                log_error "사용 가능한 ${type} 백업이 없습니다"
                exit 1
            fi
            log_info "최신 백업 파일: $latest_backup"
            verify_backup_file "$latest_backup" && restore_backup "$latest_backup"
            ;;
        docker)
            local backup_file="${2:-}"
            if [[ -z "$backup_file" ]]; then
                log_error "백업 파일 경로를 지정해주세요"
                show_usage
                exit 1
            fi
            verify_backup_file "$backup_file" && restore_docker "$backup_file"
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
