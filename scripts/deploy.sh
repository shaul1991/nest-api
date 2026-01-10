#!/bin/bash
set -e

# Configuration
PROJECT_DIR="/opt/projects/nest-api"
COMPOSE_FILE="docker-compose.blue-green.yml"
STATE_FILE="$PROJECT_DIR/.active-slot"
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
ENV_FILE="$PROJECT_DIR/.env.${ENV/prod/production}"

if [ "$ENV" == "prod" ]; then
    BLUE_PORT=3100
    GREEN_PORT=3102
    DOMAIN="api-nest.shaul.link"
else
    BLUE_PORT=3101
    GREEN_PORT=3103
    DOMAIN="dev-api-nest.shaul.link"
fi

# Get current timestamp for image tag
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

echo -e "${YELLOW}=== NestJS Blue-Green Deployment ===${NC}"
echo "Environment: $ENV"
echo "Image Tag: $IMAGE_TAG"
echo ""

# Function to get current active slot
get_active_slot() {
    if [ -f "$STATE_FILE-$ENV" ]; then
        cat "$STATE_FILE-$ENV"
    else
        echo "blue"
    fi
}

# Function to get target slot
get_target_slot() {
    local active=$(get_active_slot)
    if [ "$active" == "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Function to get port for slot
get_port_for_slot() {
    local slot=$1
    if [ "$slot" == "blue" ]; then
        echo $BLUE_PORT
    else
        echo $GREEN_PORT
    fi
}

# Function to wait for health check
wait_for_health() {
    local port=$1
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}Waiting for health check on port $port...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if curl -sf "http://localhost:$port/health/live" > /dev/null 2>&1; then
            echo -e "${GREEN}Health check passed!${NC}"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts failed, retrying..."
        sleep 2
        ((attempt++))
    done

    echo -e "${RED}Health check failed after $max_attempts attempts${NC}"
    return 1
}

# Function to update Caddy configuration
update_caddy_upstream() {
    local port=$1
    local temp_file=$(mktemp)

    echo -e "${YELLOW}Updating Caddy upstream to port $port...${NC}"

    # More specific replacement for our domain (exact match)
    if grep -q "^$DOMAIN {" "$CADDY_CONFIG"; then
        # Use awk for precise replacement - exact domain match
        awk -v domain="$DOMAIN" -v port="$port" '
        BEGIN { in_block = 0 }
        $0 == domain " {" { in_block = 1 }
        in_block && /reverse_proxy localhost:[0-9]+/ {
            sub(/localhost:[0-9]+/, "localhost:" port)
        }
        /^}/ && in_block { in_block = 0 }
        { print }
        ' "$CADDY_CONFIG" > "$temp_file"
        mv "$temp_file" "$CADDY_CONFIG"
        # Preserve file permissions
        chmod 644 "$CADDY_CONFIG"
    fi

    # Reload Caddy
    systemctl reload caddy
    echo -e "${GREEN}Caddy reloaded${NC}"
}

# Function to cleanup old images
cleanup_old_images() {
    echo -e "${YELLOW}Cleaning up old images (keeping last $MAX_IMAGES)...${NC}"

    # Get all image tags sorted by creation date
    local images=$(docker images "$DOCKER_IMAGE" --format "{{.Tag}} {{.CreatedAt}}" | \
        grep -v "latest" | \
        grep -v "dev" | \
        sort -k2,3 -r | \
        tail -n +$((MAX_IMAGES + 1)) | \
        awk '{print $1}')

    for tag in $images; do
        echo "Removing old image: $DOCKER_IMAGE:$tag"
        docker rmi "$DOCKER_IMAGE:$tag" 2>/dev/null || true
    done

    # Also prune dangling images
    docker image prune -f
    echo -e "${GREEN}Cleanup completed${NC}"
}

# Main deployment logic
main() {
    cd "$PROJECT_DIR"

    ACTIVE_SLOT=$(get_active_slot)
    TARGET_SLOT=$(get_target_slot)
    TARGET_PORT=$(get_port_for_slot $TARGET_SLOT)

    echo "Active slot: $ACTIVE_SLOT"
    echo "Target slot: $TARGET_SLOT"
    echo "Target port: $TARGET_PORT"
    echo ""

    # Step 1: Build new image with tag
    echo -e "${YELLOW}Step 1: Building new image...${NC}"
    docker build -t "$DOCKER_IMAGE:$IMAGE_TAG" -t "$DOCKER_IMAGE:latest" .
    echo -e "${GREEN}Image built: $DOCKER_IMAGE:$IMAGE_TAG${NC}"
    echo ""

    # Step 2: Deploy to target slot
    echo -e "${YELLOW}Step 2: Deploying to $TARGET_SLOT slot...${NC}"

    export IMAGE_TAG
    export DOCKER_IMAGE
    export ENV
    export BLUE_PORT
    export GREEN_PORT

    # Stop target slot if running
    docker compose -p "nest-api-$ENV" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile $TARGET_SLOT down 2>/dev/null || true

    # Start target slot
    docker compose -p "nest-api-$ENV" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile $TARGET_SLOT up -d
    echo ""

    # Step 3: Wait for health check
    echo -e "${YELLOW}Step 3: Health check...${NC}"
    if ! wait_for_health $TARGET_PORT; then
        echo -e "${RED}Deployment failed! Rolling back...${NC}"
        docker compose -p "nest-api-$ENV" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile $TARGET_SLOT down
        exit 1
    fi
    echo ""

    # Step 4: Update Caddy upstream
    echo -e "${YELLOW}Step 4: Switching traffic...${NC}"
    update_caddy_upstream $TARGET_PORT
    echo ""

    # Step 5: Update active slot state
    echo "$TARGET_SLOT" > "$STATE_FILE-$ENV"
    echo -e "${GREEN}Active slot updated to: $TARGET_SLOT${NC}"
    echo ""

    # Step 6: Stop old slot (optional - keep for quick rollback)
    echo -e "${YELLOW}Step 5: Stopping old slot ($ACTIVE_SLOT)...${NC}"
    docker compose -p "nest-api-$ENV" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile $ACTIVE_SLOT down 2>/dev/null || true
    echo ""

    # Step 7: Cleanup old images
    echo -e "${YELLOW}Step 6: Cleaning up...${NC}"
    cleanup_old_images
    echo ""

    echo -e "${GREEN}=== Deployment Complete ===${NC}"
    echo "Active slot: $TARGET_SLOT"
    echo "Port: $TARGET_PORT"
    echo "Image: $DOCKER_IMAGE:$IMAGE_TAG"
    echo "URL: https://$DOMAIN"
}

# Run main function
main
