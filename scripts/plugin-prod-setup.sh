#!/bin/bash
# Plugin Production Setup
# Restores git submodules for reproducible builds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

echo "🔧 Setting up plugins for production mode (submodules)..."
echo "   Project root: $PROJECT_ROOT"
echo "   Plugins dir:  $PLUGINS_DIR"
echo ""

cd "$PROJECT_ROOT"

# Remove any symlinks in plugins directory
echo "Removing development symlinks..."
find "$PLUGINS_DIR" -maxdepth 1 -type l -exec rm {} \;

# Check if .gitmodules exists
if [ ! -f ".gitmodules" ]; then
  echo ""
  echo "⚠️  No .gitmodules found."
  echo "   To add a plugin as a submodule, run:"
  echo ""
  echo "   git submodule add git@github.com:your-org/void-plugin-example.git plugins/void-plugin-example"
  echo ""
  exit 0
fi

# Initialize and update submodules
echo "Initializing git submodules..."
git submodule update --init --recursive

echo ""
echo "✅ Production mode setup complete!"
echo ""
echo "Active submodules:"
git submodule status
