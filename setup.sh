#!/bin/bash
# Void Server - Setup Script
# Run this to bootstrap the project. Requires Docker.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

print_step() {
  echo -e "${GREEN}▶${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✖${NC} $1"
}

print_success() {
  echo -e "${GREEN}✔${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
  if command -v docker &>/dev/null; then
    if docker info &>/dev/null 2>&1; then
      return 0  # Docker installed and running
    fi
  fi
  return 1  # Docker not available
}

# Configure Docker GID for browser sidecar support
configure_docker_gid() {
  if [[ -S /var/run/docker.sock ]]; then
    local docker_gid
    # macOS Docker Desktop: Socket appears as root:root inside container, use GID 0
    # Linux: Get actual GID from docker.sock
    if [[ "$(uname)" == "Darwin" ]]; then
      docker_gid=0
      print_step "Docker socket GID: 0 (macOS Docker Desktop)"
    else
      docker_gid=$(stat -c '%g' /var/run/docker.sock)
      print_step "Docker socket GID: $docker_gid (browser sidecar enabled)"
    fi

    # Update .env file with DOCKER_GID
    if [[ -f .env ]]; then
      if grep -q "^DOCKER_GID=" .env; then
        sed -i.bak "s/^DOCKER_GID=.*/DOCKER_GID=$docker_gid/" .env && rm -f .env.bak
      else
        echo "DOCKER_GID=$docker_gid" >> .env
      fi
    else
      echo "DOCKER_GID=$docker_gid" > .env
    fi
  fi
}

# Run with Docker Compose
run_docker_setup() {
  print_header "Starting with Docker Compose"

  # Configure Docker GID for browser management
  configure_docker_gid

  # Clean up unused Docker resources
  print_step "Cleaning up unused Docker resources..."
  docker system prune --force

  # Build browser sidecar image for noVNC support
  print_step "Building browser sidecar image..."
  docker build -t ghcr.io/clawedcode/void-server/void-browser:latest ./docker/browser

  print_step "Pulling latest images and starting containers..."
  docker compose pull
  docker compose up -d --build

  echo ""
  print_success "Void Server is running with Docker!"
  echo ""
  echo "  App:     http://localhost:4420"
  echo "  Neo4j:   http://localhost:4421"
  echo ""
  echo -e "${CYAN}Commands:${NC}"
  echo "  docker compose logs -f    View logs"
  echo "  docker compose restart    Restart services"
  echo "  docker compose down       Stop services"
  echo ""
  echo -e "${CYAN}Streaming logs (Ctrl+C to exit)...${NC}"
  echo ""
  docker compose logs -f
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_header "Void Server Setup"

# Detect OS for informational purposes
case "$(uname -s)" in
  Darwin*) OS="macOS" ;;
  Linux*) OS="Linux" ;;
  *) OS="Unknown" ;;
esac
print_step "Detected OS: $OS"

# Check for Docker (required)
print_step "Checking for Docker..."

if check_docker; then
  print_success "Docker is installed and running"
  run_docker_setup
else
  print_error "Docker is required to run Void Server"
  echo ""
  echo "Docker Desktop provides everything you need:"
  echo "  - Neo4j database"
  echo "  - IPFS node"
  echo "  - Browser automation with noVNC"
  echo "  - Automatic updates via Watchtower"
  echo ""
  echo -e "Please install Docker Desktop from:"
  echo -e "  ${CYAN}https://www.docker.com/products/docker-desktop/${NC}"
  echo ""
  echo "After installation:"
  echo "  1. Start Docker Desktop"
  echo "  2. Run this script again: ./setup.sh"
  echo ""
  exit 1
fi
