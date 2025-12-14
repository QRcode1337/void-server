#!/bin/bash
# Void Server - Run Script
# Start the server and client with PM2.

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if already running
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
