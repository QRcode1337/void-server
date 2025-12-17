#!/bin/bash
# Install git hooks for the void-server project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
GIT_HOOKS_DIR="$PROJECT_ROOT/.git/hooks"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Installing git hooks..."

# Check if we're in a git repo
if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
  echo -e "${RED}Error: Not a git repository${NC}"
  exit 1
fi

# Create hooks directory if needed
mkdir -p "$GIT_HOOKS_DIR"

# Install pre-commit hook
HOOK_SOURCE="$SCRIPT_DIR/pre-commit"
HOOK_TARGET="$GIT_HOOKS_DIR/pre-commit"

if [[ -f "$HOOK_SOURCE" ]]; then
  cp "$HOOK_SOURCE" "$HOOK_TARGET"
  chmod +x "$HOOK_TARGET"
  echo -e "${GREEN}Installed: pre-commit${NC}"
else
  echo -e "${YELLOW}Warning: pre-commit hook source not found${NC}"
fi

# Create patterns file if missing
PATTERNS_FILE="$PROJECT_ROOT/scripts/lib/secret-patterns.txt"
if [[ ! -f "$PATTERNS_FILE" ]]; then
  mkdir -p "$(dirname "$PATTERNS_FILE")"
  cat > "$PATTERNS_FILE" << 'EOF'
# Secret detection patterns - see documentation
# Add patterns here, one per line (regex format)
EOF
  echo -e "${GREEN}Created: scripts/lib/secret-patterns.txt${NC}"
fi

# Create allowlist if missing
ALLOWLIST_FILE="$PROJECT_ROOT/config/secrets-allowlist.json"
if [[ ! -f "$ALLOWLIST_FILE" ]]; then
  mkdir -p "$(dirname "$ALLOWLIST_FILE")"
  cat > "$ALLOWLIST_FILE" << 'EOF'
{
  "description": "Allowlist for secret scanning false positives",
  "version": "1.0.0",
  "patterns": [],
  "files": [],
  "hashes": []
}
EOF
  echo -e "${GREEN}Created: config/secrets-allowlist.json${NC}"
fi

echo ""
echo -e "${GREEN}Git hooks installed successfully!${NC}"
echo ""
echo "The pre-commit hook will:"
echo "  1. Scan for secrets (API keys, passwords, private keys)"
echo "  2. Run ESLint on staged client files"
echo ""
echo "Configure secrets allowlist: config/secrets-allowlist.json"
