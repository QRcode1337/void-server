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

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  print_warning "You have uncommitted changes:"
  git status --short
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Update cancelled."
    exit 1
  fi
fi

# Stop services
print_step "Stopping services..."
npx pm2 stop ecosystem.config.js 2>/dev/null || true

# Pull latest code
print_step "Pulling latest code..."
git pull --rebase

# Update submodules
print_step "Updating submodules..."
git submodule update --recursive --remote

# Update server dependencies
print_step "Updating server dependencies..."
npm install

# Update client dependencies
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

print_header "Update Complete!"

echo -e "${GREEN}Void Server has been updated and restarted.${NC}"
echo ""
echo "  API:     http://localhost:4401"
echo "  Client:  http://localhost:4480"
echo ""
