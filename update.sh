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

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_header "Void Server Update"

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

# Stop PM2 services
print_step "Stopping services..."
pm2 stop void-server void-client 2>/dev/null || true

# Stop old Docker containers (migration from Docker-only to hybrid)
print_step "Stopping old Docker containers..."
docker compose down 2>/dev/null || true

# Pull latest code
print_step "Pulling latest code..."
git pull --rebase

# Start fresh infrastructure containers
print_step "Starting infrastructure containers..."
docker compose pull
docker compose up -d

# Update npm dependencies
print_step "Updating server dependencies..."
npm install

print_step "Updating client dependencies..."
npm install --prefix client

print_step "Rebuilding client..."
npm run build --prefix client

# Restart PM2
print_step "Restarting services..."
pm2 restart void-server void-client 2>/dev/null || pm2 start ecosystem.config.js

echo ""
pm2 status

# Restore stashed changes
if [[ "$STASHED" == true ]]; then
  print_step "Restoring stashed changes..."
  git stash pop || print_warning "Could not auto-restore stash. Run 'git stash pop' manually."
fi

print_header "Update Complete!"

echo -e "${GREEN}Void Server has been updated and restarted.${NC}"
echo ""
echo "  App:     http://localhost:4420"
echo "  Neo4j:   http://localhost:7474"
echo "  IPFS:    http://localhost:5001"
echo "  Ollama:  http://localhost:11434"
echo ""
