#!/bin/bash
# Void Server - Setup Script
# Run this to bootstrap the project. Safe to run multiple times (idempotent).
# Prefers Docker installation, falls back to native if Docker unavailable.

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

prompt_yes_no() {
  local prompt="$1"
  local default="${2:-n}"
  local response

  if [[ "$default" == "y" ]]; then
    prompt="$prompt [Y/n]: "
  else
    prompt="$prompt [y/N]: "
  fi

  read -r -p "$prompt" response
  response="${response:-$default}"

  [[ "$response" =~ ^[Yy]$ ]]
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

# Run with Docker Compose
run_docker_setup() {
  print_header "Starting with Docker Compose"

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
  exit 0
}

# Detect OS
detect_os() {
  case "$(uname -s)" in
    Darwin*)
      OS="macos"
      ;;
    Linux*)
      if [[ -f /etc/debian_version ]]; then
        OS="debian"
      elif [[ -f /etc/redhat-release ]]; then
        OS="redhat"
      elif [[ -f /etc/arch-release ]]; then
        OS="arch"
      else
        OS="linux"
      fi
      ;;
    *)
      OS="unknown"
      ;;
  esac
  echo "$OS"
}

# Install Node.js
install_node() {
  local os="$1"
  print_step "Installing Node.js..."

  case "$os" in
    macos)
      if command -v brew &>/dev/null; then
        brew install node
      else
        print_warning "Homebrew not found. Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        brew install node
      fi
      ;;
    debian)
      print_step "Adding NodeSource repository..."
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
      ;;
    redhat)
      print_step "Adding NodeSource repository..."
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo dnf install -y nodejs || sudo yum install -y nodejs
      ;;
    arch)
      sudo pacman -S --noconfirm nodejs npm
      ;;
    *)
      print_error "Unsupported OS for automatic Node.js installation."
      print_warning "Please install Node.js 18+ manually from: https://nodejs.org/"
      exit 1
      ;;
  esac

  print_success "Node.js installed successfully"
}

# Install Neo4j
install_neo4j() {
  local os="$1"
  print_step "Installing Neo4j..."

  case "$os" in
    macos)
      if command -v brew &>/dev/null; then
        brew install neo4j
        print_success "Neo4j installed. Start with: neo4j start"
      else
        print_warning "Homebrew not found. Please install Neo4j Desktop from:"
        echo -e "         ${CYAN}https://neo4j.com/download/${NC}"
        return 1
      fi
      ;;
    debian)
      print_step "Adding Neo4j repository..."
      curl -fsSL https://debian.neo4j.com/neotechnology.gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/neo4j.gpg
      echo "deb [signed-by=/usr/share/keyrings/neo4j.gpg] https://debian.neo4j.com stable latest" | sudo tee /etc/apt/sources.list.d/neo4j.list
      sudo apt-get update
      sudo apt-get install -y neo4j
      print_success "Neo4j installed. Start with: sudo systemctl start neo4j"
      ;;
    redhat)
      print_step "Adding Neo4j repository..."
      sudo rpm --import https://debian.neo4j.com/neotechnology.gpg.key
      cat <<EOF | sudo tee /etc/yum.repos.d/neo4j.repo
[neo4j]
name=Neo4j RPM Repository
baseurl=https://yum.neo4j.com/stable/5
enabled=1
gpgcheck=1
gpgkey=https://debian.neo4j.com/neotechnology.gpg.key
EOF
      sudo dnf install -y neo4j || sudo yum install -y neo4j
      print_success "Neo4j installed. Start with: sudo systemctl start neo4j"
      ;;
    arch)
      print_warning "Neo4j is available in AUR. Install with your AUR helper:"
      echo -e "         ${CYAN}yay -S neo4j-community${NC}"
      return 1
      ;;
    *)
      print_warning "Please install Neo4j manually from:"
      echo -e "         ${CYAN}https://neo4j.com/download/${NC}"
      return 1
      ;;
  esac
}

# Start Neo4j service
start_neo4j() {
  local os="$1"
  print_step "Starting Neo4j..."

  case "$os" in
    macos)
      neo4j start 2>/dev/null || brew services start neo4j 2>/dev/null || true
      ;;
    debian|redhat)
      sudo systemctl start neo4j 2>/dev/null || true
      sudo systemctl enable neo4j 2>/dev/null || true
      ;;
    *)
      print_warning "Please start Neo4j manually"
      ;;
  esac
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_header "Void Server Setup"

# Detect OS
OS=$(detect_os)
print_step "Detected OS: $OS"

# Check for Docker first (preferred installation method)
print_step "Checking for Docker..."

if check_docker; then
  print_success "Docker is installed and running"
  echo ""
  echo -e "${GREEN}Docker detected!${NC} This is the recommended way to run Void Server."
  echo "It includes Neo4j and all dependencies in containers."
  echo ""
  if prompt_yes_no "Would you like to run with Docker? (Recommended)" "y"; then
    run_docker_setup
  else
    print_step "Continuing with native installation..."
  fi
else
  print_warning "Docker not detected or not running"
  echo ""
  echo "Docker Desktop is the easiest way to run Void Server."
  echo "It includes Neo4j and all dependencies with a single command."
  echo ""
  echo -e "Download Docker Desktop: ${CYAN}https://www.docker.com/products/docker-desktop/${NC}"
  echo ""
  if prompt_yes_no "Would you like to install Docker Desktop? (Opens download page)" "y"; then
    case "$OS" in
      macos)
        open "https://www.docker.com/products/docker-desktop/"
        ;;
      *)
        xdg-open "https://www.docker.com/products/docker-desktop/" 2>/dev/null || \
        echo -e "Please visit: ${CYAN}https://www.docker.com/products/docker-desktop/${NC}"
        ;;
    esac
    echo ""
    print_warning "After installing Docker Desktop, run this script again."
    echo ""
    if ! prompt_yes_no "Continue with native installation instead?" "n"; then
      exit 0
    fi
  fi
  print_step "Continuing with native installation..."
fi

echo ""

# Check prerequisites for native installation
print_step "Checking prerequisites..."

# Check for git first (required for everything)
if ! command -v git &>/dev/null; then
  print_error "git is not installed."
  case "$OS" in
    macos)
      echo -e "         Install with: ${CYAN}xcode-select --install${NC}"
      ;;
    debian)
      echo -e "         Install with: ${CYAN}sudo apt-get install git${NC}"
      ;;
    redhat)
      echo -e "         Install with: ${CYAN}sudo dnf install git${NC}"
      ;;
    arch)
      echo -e "         Install with: ${CYAN}sudo pacman -S git${NC}"
      ;;
  esac
  exit 1
fi

# Check for Node.js
if ! command -v node &>/dev/null; then
  print_warning "Node.js is not installed."
  echo ""
  if prompt_yes_no "Would you like to install Node.js automatically?" "y"; then
    install_node "$OS"
  else
    print_error "Node.js is required. Please install Node.js 18+ and try again."
    echo -e "         Download from: ${CYAN}https://nodejs.org/${NC}"
    exit 1
  fi
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 18 ]]; then
  print_warning "Node.js version $NODE_VERSION detected. Version 18+ recommended."
  if prompt_yes_no "Would you like to upgrade Node.js?" "y"; then
    install_node "$OS"
  fi
fi

if ! command -v npm &>/dev/null; then
  print_error "npm is not installed. Please install npm and try again."
  exit 1
fi

print_success "Node.js $(node -v), npm $(npm -v)"

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
  echo ""
  if prompt_yes_no "Would you like to install Neo4j automatically?" "y"; then
    if install_neo4j "$OS"; then
      NEO4J_INSTALLED=true
      if prompt_yes_no "Would you like to start Neo4j now?" "y"; then
        start_neo4j "$OS"
        print_success "Neo4j started"
        echo ""
        print_warning "Default Neo4j credentials: neo4j / neo4j"
        print_warning "You'll be prompted to change the password on first login."
        echo -e "         Neo4j Browser: ${CYAN}http://localhost:7474${NC}"
        echo ""
      fi
    fi
  else
    print_warning "Skipping Neo4j installation. Memory features will be disabled."
    echo -e "         Install later from: ${CYAN}https://neo4j.com/download/${NC}"
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

# Install plugin dependencies
PLUGIN_COUNT=0
for plugin_dir in plugins/*/; do
  if [[ -f "${plugin_dir}package.json" ]]; then
    plugin_name=$(basename "$plugin_dir")
    if [[ -d "${plugin_dir}node_modules" ]] && [[ "${plugin_dir}package.json" -ot "${plugin_dir}node_modules" ]]; then
      print_skip "Plugin $plugin_name dependencies installed"
    else
      print_step "Installing $plugin_name dependencies..."
      cd "$plugin_dir"
      npm install --silent
      cd "$SCRIPT_DIR"
      print_success "Plugin $plugin_name dependencies installed"
    fi
    ((PLUGIN_COUNT++))
  fi
done
if [[ $PLUGIN_COUNT -eq 0 ]]; then
  print_skip "No plugins with dependencies"
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
if [[ "$NEO4J_INSTALLED" == true ]]; then
  echo "  Neo4j:   http://localhost:7474"
fi
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
