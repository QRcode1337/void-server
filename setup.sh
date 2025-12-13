#!/bin/bash
# Void Server - Setup Script
# Run this to bootstrap the project. Safe to run multiple times (idempotent).

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

print_skip() {
  echo -e "${CYAN}○${NC} $1 ${CYAN}(already done)${NC}"
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

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_header "Void Server Setup"

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  print_error "Node.js is not installed. Please install Node.js 18+ and try again."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 18 ]]; then
  print_warning "Node.js version $NODE_VERSION detected. Version 18+ recommended."
fi

if ! command -v npm &>/dev/null; then
  print_error "npm is not installed. Please install npm and try again."
  exit 1
fi

if ! command -v git &>/dev/null; then
  print_error "git is not installed. Please install git and try again."
  exit 1
fi

print_success "Prerequisites satisfied (Node $(node -v), npm $(npm -v))"

# Install server dependencies (check if node_modules is up to date)
if [[ -d "node_modules" ]] && [[ "package.json" -ot "node_modules" ]]; then
  print_skip "Server dependencies installed"
else
  print_step "Installing server dependencies..."
  npm install --silent
  print_success "Server dependencies installed"
fi

# Install client dependencies
if [[ -d "client/node_modules" ]] && [[ "client/package.json" -ot "client/node_modules" ]]; then
  print_skip "Client dependencies installed"
else
  print_step "Installing client dependencies..."
  cd client
  npm install --silent
  cd ..
  print_success "Client dependencies installed"
fi

# Create necessary directories
for dir in logs config plugins; do
  if [[ ! -d "$dir" ]]; then
    mkdir -p "$dir"
    print_step "Created $dir/"
  fi
done

# Initialize config files if they don't exist
if [[ ! -f "config/plugins.json" ]]; then
  print_step "Creating default plugin config..."
  echo '{}' > config/plugins.json
else
  print_skip "Plugin config exists"
fi

if [[ ! -f "config/secrets-allowlist.json" ]]; then
  print_step "Creating secrets allowlist..."
  cat > config/secrets-allowlist.json << 'EOF'
{
  "description": "Allowlist for secret scanning false positives",
  "version": "1.0.0",
  "patterns": [],
  "files": [],
  "hashes": []
}
EOF
else
  print_skip "Secrets allowlist exists"
fi

# Install git hooks
if [[ -d ".git" ]]; then
  if [[ -f ".git/hooks/pre-commit" ]]; then
    print_skip "Git hooks installed"
  else
    print_step "Installing git hooks..."
    ./.githooks/install-hooks.sh >/dev/null 2>&1 || print_warning "Could not install git hooks (non-fatal)"
    print_success "Git hooks installed"
  fi
else
  print_skip "Not a git repository, skipping hooks"
fi

# Build client for production (check if dist exists and is newer than src)
if [[ -d "client/dist" ]] && [[ -f "client/dist/index.html" ]]; then
  # Check if any source file is newer than dist
  NEWEST_SRC=$(find client/src -type f -newer client/dist/index.html 2>/dev/null | head -1)
  if [[ -z "$NEWEST_SRC" ]]; then
    print_skip "Client already built"
  else
    print_step "Rebuilding client (source changed)..."
    cd client
    npm run build --silent
    cd ..
    print_success "Client rebuilt"
  fi
else
  print_step "Building client..."
  cd client
  npm run build
  cd ..
  print_success "Client built"
fi

# PM2 setup
print_header "Starting Services with PM2"

# Stop any existing instances first
print_step "Stopping existing instances..."
npx pm2 delete ecosystem.config.js 2>/dev/null || true

# Start with PM2
print_step "Starting void-server and void-client..."
npx pm2 start ecosystem.config.js

# Configure PM2 startup (run on system boot)
print_step "Configuring PM2 startup..."
echo ""
echo -e "${YELLOW}To enable auto-start on boot, run the command shown below:${NC}"
echo ""
npx pm2 startup 2>/dev/null || true
echo ""

# Save PM2 process list
print_step "Saving PM2 process list..."
npx pm2 save

# Show status
echo ""
npx pm2 status

# Summary
print_header "Setup Complete!"

echo -e "${GREEN}Void Server is running!${NC}"
echo ""
echo "  Server:  http://localhost:4401"
echo "  Client:  http://localhost:4480"
echo ""
echo -e "${CYAN}Commands:${NC}"
echo "  npm run pm2:logs      View logs"
echo "  npm run pm2:status    Check status"
echo "  npm run pm2:restart   Restart services"
echo "  npm run pm2:stop      Stop services"
echo ""
echo -e "${CYAN}Tip: Run the pm2 startup command above to auto-start on boot${NC}"
echo ""
