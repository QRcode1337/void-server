#!/bin/bash
# Start void-server via Docker and open browser when ready
#
# Usage:
#   ./docker-start.sh          # Pull latest image from registry
#   ./docker-start.sh --build  # Build from local source

set -e

APP_URL="http://localhost:4420"

if [[ "$1" == "--build" ]]; then
    echo "🔨 Building from local source..."
    docker compose build
else
    echo "📥 Pulling latest images..."
    docker compose pull
fi

echo "🐳 Starting void-server containers..."
docker compose up -d

echo "⏳ Waiting for void-server to be healthy..."
until docker inspect --format='{{.State.Health.Status}}' void-server 2>/dev/null | grep -q "healthy"; do
    sleep 2
    printf "."
done
echo ""

echo "✅ void-server is ready!"
echo "🌐 Opening $APP_URL"

# Cross-platform browser open
if command -v open &> /dev/null; then
    open "$APP_URL"
elif command -v xdg-open &> /dev/null; then
    xdg-open "$APP_URL"
else
    echo "   Open manually: $APP_URL"
fi
