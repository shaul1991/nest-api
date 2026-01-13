#!/bin/bash
# =============================================================================
# Staging 환경 Blue-Green 배포 스크립트
# =============================================================================
# 용도: 스테이징 환경에서 무중단 Blue-Green 배포 수행
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# 설정
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# 환경 설정
ENVIRONMENT="staging"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.staging.yml"
ENV_FILE="${SCRIPT_DIR}/.env.staging"
PROJECT_NAME="nest-api-staging"

# 포트 설정
BLUE_PORT="${BLUE_PORT:-3200}"
GREEN_PORT="${GREEN_PORT:-3201}"

# 활성 슬롯 파일
ACTIVE_SLOT_FILE="${PROJECT_ROOT}/.active-slot-staging"

# 헬스체크 설정
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=2

# 슬랙 알림
SLACK_NOTIFY="${PROJECT_ROOT}/scripts/monitoring/slack-notify.sh"

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

get_current_slot() {
    if [[ -f "$ACTIVE_SLOT_FILE" ]]; then
        cat "$ACTIVE_SLOT_FILE"
    else
        echo "none"
    fi
}

get_target_slot() {
    local current=$(get_current_slot)
    if [[ "$current" == "blue" ]]; then
        echo "green"
    else
        echo "blue"
    fi
}

get_slot_port() {
    local slot="$1"
    if [[ "$slot" == "blue" ]]; then
        echo "$BLUE_PORT"
    else
        echo "$GREEN_PORT"
    fi
}

build_image() {
    local tag="${1:-staging}"

    log_info "Docker 이미지 빌드 중: nest-api:$tag"

    docker build \
        -t "nest-api:$tag" \
        -f "${PROJECT_ROOT}/Dockerfile" \
        "$PROJECT_ROOT"

    log_success "이미지 빌드 완료: nest-api:$tag"
}

start_slot() {
    local slot="$1"

    log_info "$slot 슬롯 시작 중..."

    docker compose \
        -p "$PROJECT_NAME" \
        -f "$COMPOSE_FILE" \
        --env-file "$ENV_FILE" \
        --profile "$slot" \
        up -d

    log_success "$slot 슬롯 시작됨"
}

stop_slot() {
    local slot="$1"

    log_info "$slot 슬롯 중지 중..."

    docker compose \
        -p "$PROJECT_NAME" \
        -f "$COMPOSE_FILE" \
        --env-file "$ENV_FILE" \
        --profile "$slot" \
        down

    log_success "$slot 슬롯 중지됨"
}

health_check() {
    local slot="$1"
    local port=$(get_slot_port "$slot")
    local url="http://localhost:${port}/health/live"
    local attempt=1

    log_info "$slot 슬롯 헬스체크 중... (포트: $port)"

    while [[ $attempt -le $HEALTH_CHECK_RETRIES ]]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            log_success "헬스체크 통과: $slot (시도: $attempt)"
            return 0
        fi

        log_info "헬스체크 대기 중... ($attempt/$HEALTH_CHECK_RETRIES)"
        sleep "$HEALTH_CHECK_INTERVAL"
        ((attempt++))
    done

    log_error "헬스체크 실패: $slot"
    return 1
}

update_active_slot() {
    local slot="$1"
    echo "$slot" > "$ACTIVE_SLOT_FILE"
    log_info "활성 슬롯 업데이트: $slot"
}

send_notification() {
    local status="$1"
    local message="$2"

    if [[ -x "$SLACK_NOTIFY" ]]; then
        "$SLACK_NOTIFY" deploy staging "staging" "$status" "$message" || true
    fi
}

# -----------------------------------------------------------------------------
# 배포 함수
# -----------------------------------------------------------------------------

deploy() {
    local current_slot=$(get_current_slot)
    local target_slot=$(get_target_slot)
    local version="${1:-staging}"

    log_info "=========================================="
    log_info "Staging Blue-Green 배포 시작"
    log_info "현재 슬롯: $current_slot"
    log_info "대상 슬롯: $target_slot"
    log_info "버전: $version"
    log_info "=========================================="

    send_notification "started" "배포 시작: $target_slot 슬롯"

    # 1. 이미지 빌드 (선택적)
    if [[ "${BUILD_IMAGE:-false}" == "true" ]]; then
        build_image "$version"
    fi

    # 2. 새 슬롯 시작
    start_slot "$target_slot"

    # 3. 헬스체크
    if ! health_check "$target_slot"; then
        log_error "헬스체크 실패 - 롤백 수행"
        stop_slot "$target_slot"
        send_notification "failed" "배포 실패: 헬스체크 실패"
        return 1
    fi

    # 4. 활성 슬롯 전환
    update_active_slot "$target_slot"

    # 5. 이전 슬롯 중지 (선택적)
    if [[ "$current_slot" != "none" && "${STOP_OLD_SLOT:-true}" == "true" ]]; then
        log_info "이전 슬롯 중지: $current_slot"
        stop_slot "$current_slot"
    fi

    log_success "=========================================="
    log_success "배포 완료!"
    log_success "활성 슬롯: $target_slot"
    log_success "=========================================="

    send_notification "success" "배포 완료: $target_slot 슬롯"
    return 0
}

rollback() {
    local current_slot=$(get_current_slot)
    local target_slot=$(get_target_slot)

    log_info "=========================================="
    log_info "롤백 시작"
    log_info "현재 슬롯: $current_slot"
    log_info "롤백 대상: $target_slot"
    log_info "=========================================="

    send_notification "rollback" "롤백 시작: $target_slot 슬롯으로 전환"

    # 이전 슬롯 시작
    start_slot "$target_slot"

    # 헬스체크
    if ! health_check "$target_slot"; then
        log_error "롤백 실패 - 이전 슬롯 헬스체크 실패"
        send_notification "failed" "롤백 실패: 헬스체크 실패"
        return 1
    fi

    # 슬롯 전환
    update_active_slot "$target_slot"

    # 문제 있는 슬롯 중지
    if [[ "$current_slot" != "none" ]]; then
        stop_slot "$current_slot"
    fi

    log_success "롤백 완료: $target_slot"
    send_notification "success" "롤백 완료: $target_slot 슬롯"
}

status() {
    local current_slot=$(get_current_slot)

    echo "=========================================="
    echo "Staging 환경 상태"
    echo "=========================================="
    echo "활성 슬롯: $current_slot"
    echo ""

    echo "[컨테이너 상태]"
    docker ps --filter "name=${PROJECT_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    echo "[헬스체크]"
    if [[ "$current_slot" != "none" ]]; then
        local port=$(get_slot_port "$current_slot")
        local health_url="http://localhost:${port}/health/live"
        echo "URL: $health_url"
        curl -sf "$health_url" && echo " [OK]" || echo " [FAIL]"
    fi
}

show_usage() {
    echo "사용법: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  deploy [version]    Blue-Green 배포 실행"
    echo "  rollback            이전 버전으로 롤백"
    echo "  status              현재 상태 확인"
    echo "  start-infra         인프라 서비스 시작 (PostgreSQL, Redis)"
    echo "  stop-infra          인프라 서비스 중지"
    echo "  logs [slot]         로그 확인"
    echo ""
    echo "Options:"
    echo "  BUILD_IMAGE=true    이미지 빌드 후 배포"
    echo "  STOP_OLD_SLOT=false 이전 슬롯 유지"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  BUILD_IMAGE=true $0 deploy v1.2.3"
    echo "  $0 rollback"
    echo "  $0 status"
}

# -----------------------------------------------------------------------------
# 메인 실행
# -----------------------------------------------------------------------------
main() {
    local command="${1:-help}"
    shift || true

    # 환경 파일 확인
    if [[ ! -f "$ENV_FILE" && "$command" != "help" ]]; then
        log_error ".env.staging 파일이 없습니다."
        log_info "cp ${SCRIPT_DIR}/.env.staging.example ${ENV_FILE}"
        exit 1
    fi

    case "$command" in
        deploy)
            deploy "$@"
            ;;
        rollback)
            rollback
            ;;
        status)
            status
            ;;
        start-infra)
            log_info "인프라 서비스 시작..."
            docker compose \
                -p "$PROJECT_NAME" \
                -f "$COMPOSE_FILE" \
                --env-file "$ENV_FILE" \
                --profile infra \
                up -d
            ;;
        stop-infra)
            log_info "인프라 서비스 중지..."
            docker compose \
                -p "$PROJECT_NAME" \
                -f "$COMPOSE_FILE" \
                --env-file "$ENV_FILE" \
                --profile infra \
                down
            ;;
        logs)
            local slot="${1:-blue}"
            docker logs -f "${PROJECT_NAME}-app-${slot}-1" 2>/dev/null || \
                docker logs -f "${PROJECT_NAME}_app-${slot}_1"
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
