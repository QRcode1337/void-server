#!/bin/bash
# Test environment management script for void-server
# Usage: ./scripts/test-env.sh [start|stop|status|reset] [native|docker]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

MODE="${2:-native}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-testpassword}"

print_step() { echo -e "${GREEN}[TEST]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

setup_test_data() {
  print_step "Setting up test data directory..."
  mkdir -p "$PROJECT_DIR/test-data"
  cp -r "$PROJECT_DIR/data_template/"* "$PROJECT_DIR/test-data/" 2>/dev/null || true

  cat > "$PROJECT_DIR/test-data/neo4j.json" << EOF
{
  "uri": "bolt://localhost:7687",
  "user": "neo4j",
  "password": "$NEO4J_PASSWORD",
  "database": "neo4j"
}
EOF

  cat > "$PROJECT_DIR/test-data/ipfs.json" << EOF
{
  "enabled": true,
  "gateway": "http://localhost:8080/ipfs",
  "apiUrl": "http://localhost:5001",
  "publicGateway": "https://gateway.pinata.cloud/ipfs"
}
EOF

  cat > "$PROJECT_DIR/test-data/ai-providers.json" << EOF
{
  "activeProvider": "lmstudio",
  "providers": {
    "lmstudio": {
      "name": "LM Studio (Mock)",
      "type": "api",
      "enabled": true,
      "endpoint": "http://localhost:1234/v1",
      "apiKey": "test-key"
    }
  }
}
EOF
}

wait_for_service() {
  local name="$1"
  local url="$2"
  local timeout="${3:-60}"
  local elapsed=0

  while [ $elapsed -lt $timeout ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      print_step "$name is ready"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    printf "."
  done

  print_error "$name failed to start within ${timeout}s"
  return 1
}

start_native() {
  print_step "Starting native test environment..."

  setup_test_data

  if ! docker ps | grep -q "void-neo4j-test"; then
    print_step "Starting Neo4j container..."
    docker run -d \
      --name void-neo4j-test \
      -p 7474:7474 -p 7687:7687 \
      -e NEO4J_AUTH=neo4j/$NEO4J_PASSWORD \
      -e 'NEO4J_PLUGINS=["apoc"]' \
      --health-cmd "wget --no-verbose --tries=1 --spider http://localhost:7474 || exit 1" \
      --health-interval=10s \
      --health-timeout=5s \
      --health-retries=10 \
      neo4j:5-community
  fi

  if ! docker ps | grep -q "void-ipfs-test"; then
    print_step "Starting IPFS container..."
    docker run -d \
      --name void-ipfs-test \
      -p 5001:5001 -p 8080:8080 \
      -e IPFS_PROFILE=test \
      --health-cmd "ipfs id || exit 1" \
      --health-interval=10s \
      --health-timeout=5s \
      --health-retries=5 \
      ipfs/kubo:latest
  fi

  if ! docker ps | grep -q "void-lmstudio-mock"; then
    print_step "Starting LM Studio mock..."
    if [ -d "$PROJECT_DIR/tests/e2e/mocks/lmstudio" ]; then
      docker build -t void-lmstudio-mock "$PROJECT_DIR/tests/e2e/mocks/lmstudio"
      docker run -d \
        --name void-lmstudio-mock \
        -p 1234:1234 \
        void-lmstudio-mock
    else
      print_warning "LM Studio mock not found, skipping..."
    fi
  fi

  print_step "Waiting for services to be healthy..."
  wait_for_service "Neo4j" "http://localhost:7474" 60
  wait_for_service "IPFS" "http://localhost:5001/api/v0/id" 30

  print_step "Native test environment ready!"
  echo ""
  echo "  Neo4j Browser: http://localhost:7474"
  echo "  IPFS API: http://localhost:5001"
  echo "  LM Studio Mock: http://localhost:1234"
  echo ""
  echo "To start void-server:"
  echo "  NODE_ENV=test node server/index.js"
}

start_docker() {
  print_step "Starting Docker test environment..."

  setup_test_data

  cd "$PROJECT_DIR"
  docker compose -f docker-compose.test.yml up -d --build

  print_step "Waiting for void-server to be healthy..."
  wait_for_service "void-server" "http://localhost:4420/health" 120

  print_step "Docker test environment ready!"
  echo ""
  echo "  App: http://localhost:4420"
  echo ""
}

stop_native() {
  print_step "Stopping native test environment..."
  docker stop void-neo4j-test void-ipfs-test void-lmstudio-mock 2>/dev/null || true
  docker rm void-neo4j-test void-ipfs-test void-lmstudio-mock 2>/dev/null || true
}

stop_docker() {
  print_step "Stopping Docker test environment..."
  cd "$PROJECT_DIR"
  docker compose -f docker-compose.test.yml down -v 2>/dev/null || true
}

status() {
  echo ""
  echo "=== Test Environment Status ==="
  echo ""

  echo "Native mode containers:"
  for container in void-neo4j-test void-ipfs-test void-lmstudio-mock; do
    if docker ps | grep -q "$container"; then
      echo -e "  $container: ${GREEN}running${NC}"
    else
      echo -e "  $container: ${RED}stopped${NC}"
    fi
  done

  echo ""
  echo "Docker mode:"
  if docker compose -f "$PROJECT_DIR/docker-compose.test.yml" ps 2>/dev/null | grep -q "running"; then
    echo -e "  ${GREEN}running${NC}"
    docker compose -f "$PROJECT_DIR/docker-compose.test.yml" ps
  else
    echo -e "  ${RED}stopped${NC}"
  fi
}

reset() {
  print_step "Resetting test data..."
  rm -rf "$PROJECT_DIR/test-data"
  setup_test_data
  print_step "Test data reset complete"
}

case "$1" in
  start)
    case "$MODE" in
      native) start_native ;;
      docker) start_docker ;;
      *) print_error "Unknown mode: $MODE"; exit 1 ;;
    esac
    ;;
  stop)
    case "$MODE" in
      native) stop_native ;;
      docker) stop_docker ;;
      *) stop_native; stop_docker ;;
    esac
    ;;
  status)
    status
    ;;
  reset)
    reset
    ;;
  *)
    echo "Usage: $0 [start|stop|status|reset] [native|docker]"
    exit 1
    ;;
esac
