#!/bin/bash
# Add a plugin as a git submodule
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/plugin-utils.sh"

PROJECT_ROOT="$(get_project_root)"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

usage() {
  echo "Usage: $0 <git-url> [options]"
  echo ""
  echo "Arguments:"
  echo "  git-url        Git repository URL (SSH or HTTPS)"
  echo ""
  echo "Options:"
  echo "  -b, --branch   Branch to track (default: main)"
  echo "  -n, --name     Override plugin directory name"
  echo "  -h, --help     Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 https://github.com/org/void-plugin-example.git"
  echo "  $0 git@github.com:org/void-plugin-example.git -b develop"
  echo "  $0 https://github.com/org/my-plugin.git --name void-plugin-custom"
  exit 1
}

# Parse arguments
GIT_URL=""
BRANCH="main"
PLUGIN_NAME=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--branch)
      BRANCH="$2"
      shift 2
      ;;
    -n|--name)
      PLUGIN_NAME="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    -*)
      print_error "Unknown option: $1"
      usage
      ;;
    *)
      GIT_URL="$1"
      shift
      ;;
  esac
done

if [[ -z "$GIT_URL" ]]; then
  print_error "Git URL is required"
  usage
fi

# Validate git URL
if ! validate_git_url "$GIT_URL"; then
  exit 1
fi

# Extract plugin name from URL if not provided
if [[ -z "$PLUGIN_NAME" ]]; then
  PLUGIN_NAME=$(extract_plugin_name "$GIT_URL")
fi

# Validate plugin name
if ! validate_plugin_name "$PLUGIN_NAME"; then
  exit 1
fi

PLUGIN_PATH="plugins/$PLUGIN_NAME"
FULL_PLUGIN_PATH="$PLUGINS_DIR/$PLUGIN_NAME"

# Check for dev mode conflict
if is_dev_mode "$PLUGINS_DIR"; then
  print_warning "Warning: Development symlinks detected in plugins directory."
  echo "Consider running ./scripts/plugin-prod-setup.sh first to switch to production mode."
  echo ""
  if ! confirm_action "Continue anyway?"; then
    echo "Aborted."
    exit 0
  fi
fi

# Check if already exists
if [[ -d "$FULL_PLUGIN_PATH" ]]; then
  print_error "Plugin '$PLUGIN_NAME' already exists at $PLUGIN_PATH"
  exit 1
fi

print_header "Installing Plugin"
echo "Name:       $PLUGIN_NAME"
echo "Repository: $GIT_URL"
echo "Branch:     $BRANCH"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Add submodule
echo "Adding git submodule..."
git submodule add -b "$BRANCH" "$GIT_URL" "$PLUGIN_PATH"

# Initialize and update
echo "Initializing submodule..."
git submodule update --init --recursive "$PLUGIN_PATH"

# Check for manifest
if [[ ! -f "$FULL_PLUGIN_PATH/manifest.json" ]]; then
  print_warning "Warning: Plugin is missing manifest.json"
  echo "The plugin may not load correctly without a manifest."
fi

echo ""
print_success "Successfully installed plugin '$PLUGIN_NAME'"
echo ""
echo "Next steps:"
echo "  1. Review the plugin contents"
echo "  2. git commit -m 'Add plugin: $PLUGIN_NAME'"
echo "  3. Restart the server to load the plugin"
