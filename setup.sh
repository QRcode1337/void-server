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

# Check for Neo4j (optional but recommended for memory features)
NEO4J_INSTALLED=false
if command -v neo4j &>/dev/null; then
  NEO4J_INSTALLED=true
  print_success "Neo4j found: $(neo4j --version 2>/dev/null || echo 'version unknown')"
elif command -v cypher-shell &>/dev/null; then
  NEO4J_INSTALLED=true
  print_success "Neo4j found (via cypher-shell)"
elif [[ -d "/Applications/Neo4j Desktop.app" ]] || [[ -d "$HOME/Library/Application Support/Neo4j Desktop" ]]; then
  NEO4J_INSTALLED=true
  print_success "Neo4j Desktop detected"
else
  print_warning "Neo4j not detected. Memory features require Neo4j."
  echo -e "         Install from: ${CYAN}https://neo4j.com/download/${NC}"
  echo -e "         Or via Homebrew: ${CYAN}brew install neo4j${NC}"
fi

print_success "Prerequisites satisfied (Node $(node -v), npm $(npm -v))"

# Initialize git submodules (plugins)
if [[ -d ".git" ]]; then
  if [[ -f ".gitmodules" ]]; then
    print_step "Initializing git submodules (plugins)..."
    git submodule init
    git submodule update --recursive
    print_success "Git submodules initialized"
  else
    print_skip "No git submodules configured"
  fi
fi

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

# PM2 setup
print_header "Starting Services with PM2"

# Stop any existing instances first
print_step "Stopping existing instances..."
npx pm2 delete ecosystem.config.js 2>/dev/null || true

# Start with PM2
print_step "Starting void-server (4401) and void-client dev (4480)..."
npx pm2 start ecosystem.config.js --env development

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
echo "  API:     http://localhost:4401"
echo "  Client:  http://localhost:4480 (Vite dev server with HMR)"
echo ""
echo -e "${CYAN}Commands:${NC}"
echo "  npm run logs      View logs"
echo "  npm run status    Check status"
echo "  npm run restart   Restart services"
echo "  npm run stop      Stop services"
echo ""
echo -e "${CYAN}Tip: Run the pm2 startup command above to auto-start on boot${NC}"
echo ""
echo -e "${CYAN}Streaming logs (Ctrl+C to exit)...${NC}"
echo ""
npx pm2 logs
