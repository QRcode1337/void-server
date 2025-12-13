#!/bin/bash
# Plugin Development Setup
# Creates symlinks to sibling plugin repos for shared development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGINS_DIR="$PROJECT_ROOT/plugins"
PARENT_DIR="$(dirname "$PROJECT_ROOT")"

echo "🔧 Setting up plugins for development mode..."
echo "   Project root: $PROJECT_ROOT"
echo "   Plugins dir:  $PLUGINS_DIR"
echo "   Parent dir:   $PARENT_DIR"
echo ""

# List of plugins to symlink (auto-detect from parent directory)
PLUGINS=()
for dir in "$PARENT_DIR"/void-plugin-*; do
  if [ -d "$dir" ]; then
    PLUGINS+=("$(basename "$dir")")
  fi
done

if [ ${#PLUGINS[@]} -eq 0 ]; then
  echo "No void-plugin-* directories found in $PARENT_DIR"
  echo "Clone plugin repos there first, e.g.:"
  echo "  git clone <repo-url> $PARENT_DIR/void-plugin-example"
  exit 0
fi

# Ensure plugins directory exists
mkdir -p "$PLUGINS_DIR"

for plugin in "${PLUGINS[@]}"; do
  PLUGIN_SOURCE="$PARENT_DIR/$plugin"
  PLUGIN_TARGET="$PLUGINS_DIR/$plugin"

  echo "Processing $plugin..."

  # Check if source exists
  if [ ! -d "$PLUGIN_SOURCE" ]; then
    echo "   ⚠️  Source not found: $PLUGIN_SOURCE"
    echo "      Clone it with: git clone <repo-url> $PLUGIN_SOURCE"
    continue
  fi

  # If target exists and is a directory (submodule), back it up
  if [ -d "$PLUGIN_TARGET" ] && [ ! -L "$PLUGIN_TARGET" ]; then
    echo "   📦 Found submodule, deinitializing..."
    cd "$PROJECT_ROOT"
    git submodule deinit -f "plugins/$plugin" 2>/dev/null || true
    rm -rf ".git/modules/plugins/$plugin" 2>/dev/null || true
    rm -rf "$PLUGIN_TARGET"
  fi

  # If target is already a symlink, check if it points to the right place
  if [ -L "$PLUGIN_TARGET" ]; then
    CURRENT_LINK=$(readlink "$PLUGIN_TARGET")
    EXPECTED_LINK="../../$plugin"
    if [ "$CURRENT_LINK" = "$EXPECTED_LINK" ]; then
      echo "   ✅ Symlink already correct"
      continue
    else
      echo "   🔄 Updating symlink..."
      rm "$PLUGIN_TARGET"
    fi
  fi

  # Create symlink
  echo "   🔗 Creating symlink: $PLUGIN_TARGET -> ../../$plugin"
  ln -s "../../$plugin" "$PLUGIN_TARGET"
  echo "   ✅ Done"
done

echo ""
echo "✅ Development mode setup complete!"
echo ""
echo "The following symlinks are active:"
ls -la "$PLUGINS_DIR" | grep "^l"
echo ""
echo "Note: Symlinks are gitignored. Use plugin-prod-setup.sh to switch back to submodules."
