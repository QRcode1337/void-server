#!/bin/bash
# Void Server - Update Script
# Pull latest code, update dependencies, and restart services.

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

print_success() {
  echo -e "${GREEN}✔${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✖${NC} $1"
}

# Check if Docker is running void-server containers
is_docker_running() {
  if command -v docker &>/dev/null; then
    if docker compose ps --format json 2>/dev/null | grep -q "void"; then
      return 0
    fi
    if docker ps --filter "name=void-server" --format "{{.Names}}" 2>/dev/null | grep -q "void"; then
      return 0
    fi
  fi
  return 1
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_header "Void Server Update"

# Detect installation type
IS_DOCKER=false
if is_docker_running; then
  IS_DOCKER=true
  print_success "Detected Docker installation"
else
  print_success "Detected native installation"
fi

# Auto-stash uncommitted changes
STASHED=false
if [[ -n $(git status --porcelain) ]]; then
  print_step "Stashing local changes..."
  if git stash push -m "void-update-auto-stash" --include-untracked 2>/dev/null; then
    STASHED=true
    print_success "Changes stashed"
  else
    print_warning "Could not stash changes, trying git stash --all..."
    if git stash --all; then
      STASHED=true
      print_success "Changes stashed"
    else
      print_error "Failed to stash changes. Please commit or discard your changes first."
      exit 1
    fi
  fi
fi

# Stop services
print_step "Stopping services..."
if [[ "$IS_DOCKER" == true ]]; then
  docker compose stop 2>/dev/null || true
else
  npx pm2 stop ecosystem.config.js 2>/dev/null || true
fi

# Pull latest code
print_step "Pulling latest code..."
git pull --rebase

# Update dependencies and restart based on installation type
if [[ "$IS_DOCKER" == true ]]; then
  # Docker: pull new images and rebuild
  print_step "Pulling latest Docker images..."
  docker compose pull

  print_step "Rebuilding and restarting containers..."
  docker compose up -d --build

  # Show status
  echo ""
  docker compose ps
else
  # Native: update npm dependencies
  print_step "Updating server dependencies..."
  npm install

  print_step "Updating client dependencies..."
  cd client
  npm install
  cd "$SCRIPT_DIR"

  # Update plugin dependencies
  for plugin_dir in plugins/*/; do
    if [[ -f "${plugin_dir}package.json" ]]; then
      plugin_name=$(basename "$plugin_dir")
      print_step "Updating $plugin_name dependencies..."
      cd "$plugin_dir"
      npm install
      cd "$SCRIPT_DIR"
    fi
  done

  # Restart services
  print_step "Restarting services..."
  npx pm2 restart ecosystem.config.js

  # Show status
  echo ""
  npx pm2 status
fi

# Restore stashed changes
if [[ "$STASHED" == true ]]; then
  print_step "Restoring stashed changes..."
  git stash pop || print_warning "Could not auto-restore stash. Run 'git stash pop' manually."
fi

print_header "Update Complete!"

echo -e "${GREEN}Void Server has been updated and restarted.${NC}"
echo ""
if [[ "$IS_DOCKER" == true ]]; then
  echo "  App:     http://localhost:4420"
  echo "  Neo4j:   http://localhost:4421"
else
  echo "  API:     http://localhost:4401"
  echo "  Client:  http://localhost:4480"
fi
echo ""
