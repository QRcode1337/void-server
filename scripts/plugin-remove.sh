#!/bin/bash
# Remove a plugin (submodule or symlink)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/plugin-utils.sh"

PROJECT_ROOT="$(get_project_root)"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

usage() {
  echo "Usage: $0 <plugin-name> [options]"
  echo ""
  echo "Arguments:"
  echo "  plugin-name    Name of the plugin to remove (e.g., void-plugin-example)"
  echo ""
  echo "Options:"
  echo "  -f, --force    Skip confirmation prompt"
  echo "  -h, --help     Show this help message"
  echo ""
  echo "Example:"
  echo "  $0 void-plugin-example"
  echo "  $0 void-plugin-example --force"
  exit 1
}

# Parse arguments
PLUGIN_NAME=""
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--force)
      FORCE=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    -*)
      print_error "Unknown option: $1"
      usage
      ;;
    *)
      PLUGIN_NAME="$1"
      shift
      ;;
  esac
done

if [[ -z "$PLUGIN_NAME" ]]; then
  print_error "Plugin name is required"
  usage
fi

# Validate plugin name
if ! validate_plugin_name "$PLUGIN_NAME"; then
  exit 1
fi

PLUGIN_PATH="plugins/$PLUGIN_NAME"
FULL_PLUGIN_PATH="$PLUGINS_DIR/$PLUGIN_NAME"

# Check if plugin exists
if [[ ! -e "$FULL_PLUGIN_PATH" ]]; then
  print_error "Plugin '$PLUGIN_NAME' not found"
  exit 1
fi

# Determine installation type
if is_symlink "$FULL_PLUGIN_PATH"; then
  INSTALL_TYPE="symlink"
elif is_submodule "$PROJECT_ROOT" "$PLUGIN_NAME"; then
  INSTALL_TYPE="submodule"
else
  INSTALL_TYPE="directory"
fi

print_header "Removing Plugin"
echo "Name: $PLUGIN_NAME"
echo "Type: $INSTALL_TYPE"
echo ""

# Confirm removal
if [[ "$FORCE" != true ]]; then
  echo "This will remove the plugin from:"
  if [[ "$INSTALL_TYPE" == "submodule" ]]; then
    echo "  - .gitmodules"
    echo "  - .git/config"
    echo "  - .git/modules/$PLUGIN_PATH"
  fi
  echo "  - $PLUGIN_PATH/"
  echo ""

  if ! confirm_action "Are you sure you want to remove this plugin?"; then
    echo "Aborted."
    exit 0
  fi
fi

cd "$PROJECT_ROOT"

echo "Removing plugin..."

if [[ "$INSTALL_TYPE" == "symlink" ]]; then
  # Just remove the symlink
  rm -f "$FULL_PLUGIN_PATH"

elif [[ "$INSTALL_TYPE" == "submodule" ]]; then
  # Properly remove git submodule
  git submodule deinit -f "$PLUGIN_PATH" 2>/dev/null || true
  git rm -f "$PLUGIN_PATH" 2>/dev/null || true

  # Clean up .git/modules
  rm -rf ".git/modules/$PLUGIN_PATH" 2>/dev/null || true

  # Ensure directory is removed
  rm -rf "$FULL_PLUGIN_PATH" 2>/dev/null || true

else
  # Regular directory - just remove it
  rm -rf "$FULL_PLUGIN_PATH"
fi

# Remove from plugins.json config if present
CONFIG_FILE="$PROJECT_ROOT/config/plugins.json"
if [[ -f "$CONFIG_FILE" ]] && command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
    delete config['$PLUGIN_NAME'];
    fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
  " 2>/dev/null || true
fi

echo ""
print_success "Successfully removed plugin '$PLUGIN_NAME'"
echo ""
echo "Next steps:"
if [[ "$INSTALL_TYPE" == "submodule" ]]; then
  echo "  git commit -m 'Remove plugin: $PLUGIN_NAME'"
fi
echo "  Restart the server to apply changes"
