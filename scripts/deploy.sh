#!/bin/bash
set -e

# Configuration
PROJECT_DIR="/opt/projects/nest-api"
COMPOSE_FILE="docker-compose.blue-green.yml"
STATE_FILE="${PROJECT_DIR}/.active-slot"
CADDY_CONFIG="/etc/caddy/Caddyfile"
DOCKER_IMAGE="nest-api"
MAX_IMAGES=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Environment (prod or dev)
ENV="${1:-prod}"
ENV_FILE="${PROJECT_DIR}/.env.${ENV/prod/production}"
PROJECT_NAME="nest-api-${ENV}"

if [ "${ENV}" == "prod" ]; then
    BLUE_PORT=3100
    GREEN_PORT=3101
    DOMAIN="api-nest.shaul.link"
else
    BLUE_PORT=3102
    GREEN_PORT=3103
    DOMAIN="dev-api-nest.shaul.link"
fi

# Get current timestamp for image tag
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

echo -e "${YELLOW}=== NestJS Blue-Green Deployment ===${NC}"
echo "Environment: ${ENV}"
echo "Project Name: ${PROJECT_NAME}"
echo "Image Tag: ${IMAGE_TAG}"
echo "Project Dir: ${PROJECT_DIR}"
echo "Compose File: ${COMPOSE_FILE}"
echo "Env File: ${ENV_FILE}"
echo ""

# Function to get current active slot
get_active_slot() {
    if [ -f "${STATE_FILE}-${ENV}" ]; then
        cat "${STATE_FILE}-${ENV}"
    else
        echo "blue"
    fi
}

# Function to get target slot
get_target_slot() {
    local active=$(get_active_slot)
    if [ "${active}" == "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Function to get port for slot
get_port_for_slot() {
    local slot=$1
    if [ "${slot}" == "blue" ]; then
        echo ${BLUE_PORT}
    else
        echo ${GREEN_PORT}
    fi
}

# Function to cleanup old containers with legacy naming
cleanup_legacy_containers() {
    echo -e "${YELLOW}Cleaning up legacy containers...${NC}"
    # Remove old fixed-name containers if they exist
    docker rm -f "nest-api-blue-${ENV}" 2>/dev/null || true
    docker rm -f "nest-api-green-${ENV}" 2>/dev/null || true
    docker rm -f "nest-api-blue-prod" 2>/dev/null || true
    docker rm -f "nest-api-green-prod" 2>/dev/null || true
}

# Function to reload Caddy configuration
reload_caddy() {
    echo "Reloading Caddy..."

    # Method 1: Try systemctl with sudo (works on host directly)
    if command -v systemctl &> /dev/null && sudo systemctl reload caddy 2>/dev/null; then
        echo -e "${GREEN}Caddy reloaded via systemctl${NC}"
        return 0
    fi

    # Method 2: Execute systemctl on host via privileged container (works from Jenkins container)
    if docker run --rm --privileged --pid=host alpine:latest \
        nsenter -t 1 -m -u -n -i -- systemctl reload caddy 2>/dev/null; then
        echo -e "${GREEN}Caddy reloaded via host nsenter${NC}"
        return 0
    fi

    # Method 3: Try caddy reload command
    if command -v caddy &> /dev/null && caddy reload --config "${CADDY_CONFIG}" 2>/dev/null; then
        echo -e "${GREEN}Caddy reloaded via caddy command${NC}"
        return 0
    fi

    echo -e "${YELLOW}Warning: Could not reload Caddy automatically. Please reload manually: sudo systemctl reload caddy${NC}"
    return 0
}

# Function to update Caddy configuration (header-based routing with DEFAULT_SLOT)
update_caddy_upstream() {
    local target_slot=$1
    local port=$2
    local temp_file=$(mktemp)

    echo -e "${YELLOW}Updating Caddy default slot to ${target_slot} (port ${port})...${NC}"

    # New Caddyfile format: Update DEFAULT_SLOT comment and default handle block
    awk -v domain="${DOMAIN}" -v slot="${target_slot}" -v port="${port}" '
    BEGIN { in_domain = 0; in_default_handle = 0; handle_depth = 0 }

    # Detect domain block start
    $0 ~ domain " \\{" { in_domain = 1 }

    # Detect default handle block (handle without named matcher)
    in_domain && /^[[:space:]]*handle[[:space:]]*\{[[:space:]]*$/ {
        in_default_handle = 1
        handle_depth = 1
    }

    # Update DEFAULT_SLOT comment in default handle block
    in_default_handle && /# DEFAULT_SLOT:/ {
        sub(/# DEFAULT_SLOT:[a-z]+/, "# DEFAULT_SLOT:" slot)
    }

    # Update reverse_proxy port in default handle block
    in_default_handle && /reverse_proxy localhost:[0-9]+/ {
        sub(/localhost:[0-9]+/, "localhost:" port)
    }

    # Track nested blocks
    in_default_handle && /\{/ { handle_depth++ }
    in_default_handle && /\}/ {
        handle_depth--
        if (handle_depth == 0) in_default_handle = 0
    }

    # Detect domain block end
    /^}/ && in_domain && !in_default_handle { in_domain = 0 }

    { print }
    ' "${CADDY_CONFIG}" > "${temp_file}"

    mv "${temp_file}" "${CADDY_CONFIG}"
    chmod 644 "${CADDY_CONFIG}"

    reload_caddy
}

# Function to cleanup old images
cleanup_old_images() {
    echo -e "${YELLOW}Cleaning up old images (keeping last ${MAX_IMAGES})...${NC}"

    # Get all image tags sorted by creation date
    local images=$(docker images "${DOCKER_IMAGE}" --format "{{.Tag}} {{.CreatedAt}}" | \
        grep -v "latest" | \
        grep -v "dev" | \
        sort -k2,3 -r | \
        tail -n +$((MAX_IMAGES + 1)) | \
        awk '{print $1}')

    for tag in ${images}; do
        echo "Removing old image: ${DOCKER_IMAGE}:${tag}"
        docker rmi "${DOCKER_IMAGE}:${tag}" 2>/dev/null || true
    done

    # Also prune dangling images
    docker image prune -f
    echo -e "${GREEN}Cleanup completed${NC}"
}

# Main deployment logic
main() {
    cd "${PROJECT_DIR}"

    ACTIVE_SLOT=$(get_active_slot)
    TARGET_SLOT=$(get_target_slot)
    TARGET_PORT=$(get_port_for_slot "${TARGET_SLOT}")

    echo "Active slot: ${ACTIVE_SLOT}"
    echo "Target slot: ${TARGET_SLOT}"
    echo "Target port: ${TARGET_PORT}"
    echo ""

    # Cleanup legacy containers with fixed names (one-time migration)
    cleanup_legacy_containers

    # Step 1: Build new image with tag
    echo -e "${YELLOW}Step 1: Building new image...${NC}"
    docker build -t "${DOCKER_IMAGE}:${IMAGE_TAG}" -t "${DOCKER_IMAGE}:latest" .
    echo -e "${GREEN}Image built: ${DOCKER_IMAGE}:${IMAGE_TAG}${NC}"
    echo ""

    # Step 2: Deploy to target slot
    echo -e "${YELLOW}Step 2: Deploying to ${TARGET_SLOT} slot...${NC}"

    export IMAGE_TAG
    export DOCKER_IMAGE
    export ENV
    export BLUE_PORT
    export GREEN_PORT

    # Stop target slot with orphan cleanup
    echo "Stopping target slot and removing orphans..."
    docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --profile "${TARGET_SLOT}" down --remove-orphans 2>/dev/null || true

    # Debug: Show the command being executed
    echo "Running: docker compose -p ${PROJECT_NAME} -f ${COMPOSE_FILE} --env-file ${ENV_FILE} --profile ${TARGET_SLOT} up -d"

    # Start target slot
    docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" --profile "${TARGET_SLOT}" up -d
    echo ""

    # Step 3: Update Caddy upstream
    echo -e "${YELLOW}Step 3: Switching traffic...${NC}"
    update_caddy_upstream "${TARGET_SLOT}" "${TARGET_PORT}"
    echo ""

    # Step 4: Update active slot state
    echo "${TARGET_SLOT}" > "${STATE_FILE}-${ENV}"
    echo -e "${GREEN}Active slot updated to: ${TARGET_SLOT}${NC}"
    echo -e "${YELLOW}Previous slot (${ACTIVE_SLOT}) kept running for rollback${NC}"
    echo ""

    # Step 5: Cleanup old images
    echo -e "${YELLOW}Step 5: Cleaning up...${NC}"
    cleanup_old_images
    echo ""

    echo -e "${GREEN}=== Deployment Complete ===${NC}"
    echo "Active slot: ${TARGET_SLOT}"
    echo "Port: ${TARGET_PORT}"
    echo "Image: ${DOCKER_IMAGE}:${IMAGE_TAG}"
    echo "URL: https://${DOMAIN}"
}

# Run main function
main
