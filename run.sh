#!/bin/bash
# Void Server - Run Script
# Prefers Docker, falls back to PM2/native if Docker unavailable.

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if Docker is available and running
check_docker() {
  if command -v docker &>/dev/null; then
    if docker info &>/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

# Run with Docker
run_docker() {
  echo -e "${GREEN}▶${NC} Building latest Docker image..."
  docker compose build

  echo -e "${GREEN}▶${NC} Starting Void Server with Docker..."
  docker compose up -d

  echo ""
  docker compose ps

  echo ""
  echo -e "${GREEN}Void Server is running with Docker!${NC}"
  echo ""
  echo "  App:     http://localhost:4420"
  echo "  Neo4j:   http://localhost:4421"
  echo ""
  echo -e "${CYAN}Streaming logs (Ctrl+C to exit)...${NC}"
  echo ""
  docker compose logs -f
}

# Run with PM2 (native)
run_native() {
  if npx pm2 pid void-server &>/dev/null && [[ -n $(npx pm2 pid void-server) ]]; then
    echo -e "${GREEN}▶${NC} Void Server is already running. Restarting..."
    npx pm2 restart ecosystem.config.js
  else
    echo -e "${GREEN}▶${NC} Starting Void Server..."
    npx pm2 start ecosystem.config.js
  fi

  echo ""
  npx pm2 status

  echo ""
  echo -e "${GREEN}Void Server is running!${NC}"
  echo ""
  echo "  API:     http://localhost:4401"
  echo "  Client:  http://localhost:4480"
  echo ""
  echo -e "${CYAN}Streaming logs (Ctrl+C to exit)...${NC}"
  echo ""
  npx pm2 logs
}

# Main
if check_docker; then
  run_docker
else
  echo -e "${YELLOW}Docker not available, using PM2...${NC}"
  run_native
fi
