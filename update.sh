#!/bin/bash
# Void Server - Update Script
# Supports both git repos and zip downloads.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/ClawedCode/void-server"

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

# Stop and delete PM2 services (ensures fresh config on restart)
print_step "Stopping services..."
pm2 delete void-server void-client 2>/dev/null || true

# Stop old Docker containers (migration from Docker-only to hybrid)
print_step "Stopping old Docker containers..."
docker compose down --remove-orphans 2>/dev/null || true
# Explicitly stop void-server container if it exists (handles different compose project names)
docker stop void-server 2>/dev/null || true
docker rm void-server 2>/dev/null || true

# Check if this is a git repo or zip download
if [ -d ".git" ]; then
  # Git repo - use git pull
  print_step "Detected git repository"

  # Auto-stash uncommitted changes
  STASHED=false
  if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    print_step "Stashing local changes..."
    if git stash push -m "void-update-auto-stash" --include-untracked 2>/dev/null; then
      STASHED=true
      print_success "Changes stashed"
    else
      print_warning "Could not stash changes, continuing anyway..."
    fi
  fi

  print_step "Pulling latest code..."
  git pull --rebase

  # Restore stashed changes at the end
  RESTORE_STASH=$STASHED
else
  # Zip download - fetch latest release
  print_step "Detected zip installation (no .git directory)"
  print_step "Downloading latest release..."

  # Get latest release tag from GitHub API
  LATEST_TAG=$(curl -s "https://api.github.com/repos/ClawedCode/void-server/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

  if [ -z "$LATEST_TAG" ]; then
    print_error "Could not fetch latest release version"
    exit 1
  fi

  print_success "Latest version: $LATEST_TAG"

  # Download and extract to temp directory
  TEMP_DIR=$(mktemp -d)
  ZIP_URL="${REPO_URL}/archive/refs/tags/${LATEST_TAG}.zip"

  print_step "Downloading ${ZIP_URL}..."
  curl -L -o "${TEMP_DIR}/release.zip" "$ZIP_URL"

  print_step "Extracting..."
  unzip -q "${TEMP_DIR}/release.zip" -d "${TEMP_DIR}"

  # Find extracted directory (void-server-0.x.x)
  EXTRACTED_DIR=$(find "${TEMP_DIR}" -maxdepth 1 -type d -name "void-server-*" | head -1)

  if [ -z "$EXTRACTED_DIR" ]; then
    print_error "Could not find extracted directory"
    rm -rf "$TEMP_DIR"
    exit 1
  fi

  # Preserve data directory
  if [ -d "data" ]; then
    print_step "Preserving data directory..."
    mv data "${TEMP_DIR}/data_backup"
  fi

  # Preserve .env file
  if [ -f ".env" ]; then
    print_step "Preserving .env file..."
    cp .env "${TEMP_DIR}/.env_backup"
  fi

  # Copy new files (excluding data and .env)
  print_step "Updating files..."
  rsync -a --exclude='data' --exclude='.env' "${EXTRACTED_DIR}/" ./

  # Restore data directory
  if [ -d "${TEMP_DIR}/data_backup" ]; then
    mv "${TEMP_DIR}/data_backup" data
    print_success "Data directory restored"
  fi

  # Restore .env file
  if [ -f "${TEMP_DIR}/.env_backup" ]; then
    mv "${TEMP_DIR}/.env_backup" .env
    print_success ".env file restored"
  fi

  # Cleanup
  rm -rf "$TEMP_DIR"
  print_success "Updated to $LATEST_TAG"

  RESTORE_STASH=false
fi

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

# Start PM2 with fresh config
print_step "Starting services..."
pm2 start ecosystem.config.js

echo ""
pm2 status

# Restore stashed changes (git only)
if [[ "$RESTORE_STASH" == true ]]; then
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
