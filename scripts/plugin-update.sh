#!/bin/bash
# Update plugin submodules
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/plugin-utils.sh"

PROJECT_ROOT="$(get_project_root)"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

usage() {
  echo "Usage: $0 [plugin-name] [options]"
  echo ""
  echo "Arguments:"
  echo "  plugin-name    Update specific plugin (optional)"
  echo ""
  echo "Options:"
  echo "  -a, --all      Update all plugins"
  echo "  -b, --branch   Branch to pull from (default: current branch)"
  echo "  -h, --help     Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 --all                               # Update all plugins"
  echo "  $0 void-plugin-example                 # Update specific plugin"
  echo "  $0 void-plugin-example --branch main   # Update to specific branch"
  exit 1
}

# Parse arguments
PLUGIN_NAME=""
UPDATE_ALL=false
BRANCH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -a|--all)
      UPDATE_ALL=true
      shift
      ;;
    -b|--branch)
      BRANCH="$2"
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
      PLUGIN_NAME="$1"
      shift
      ;;
  esac
done

# Check for dev mode
if is_dev_mode "$PLUGINS_DIR"; then
  print_warning "Warning: Development mode detected (symlinks present)."
  echo "Symlinked plugins should be updated directly in their source repos."
  echo ""
  echo "To update a symlinked plugin, navigate to the source directory:"
  echo "  cd ../void-plugin-NAME && git pull"
  echo ""
  echo "To switch to submodule mode, run:"
  echo "  ./scripts/plugin-prod-setup.sh"
  exit 1
fi

cd "$PROJECT_ROOT"

update_plugin() {
  local name="$1"
  local plugin_path="plugins/$name"
  local full_path="$PLUGINS_DIR/$name"

  if [[ ! -d "$full_path" ]]; then
    print_error "Plugin '$name' not found"
    return 1
  fi

  if ! is_submodule "$PROJECT_ROOT" "$name"; then
    print_warning "Plugin '$name' is not a submodule, skipping"
    return 0
  fi

  echo "Updating $name..."

  cd "$full_path"

  # Fetch latest
  git fetch origin

  # Determine target branch
  local target_branch="$BRANCH"
  if [[ -z "$target_branch" ]]; then
    target_branch=$(git rev-parse --abbrev-ref HEAD)
  fi

  # Checkout and pull
  git checkout "$target_branch" 2>/dev/null || git checkout -b "$target_branch" "origin/$target_branch"
  git pull origin "$target_branch"

  cd "$PROJECT_ROOT"

  print_success "Updated $name to latest $target_branch"
}

if [[ "$UPDATE_ALL" == true ]]; then
  print_header "Updating All Plugins"

  # Check if .gitmodules exists
  if [[ ! -f ".gitmodules" ]]; then
    echo "No submodules configured."
    exit 0
  fi

  # Get list of plugin submodules
  plugin_count=0
  while IFS= read -r submodule; do
    plugin_name=$(basename "$submodule")
    if [[ "$plugin_name" =~ ^void-plugin- ]]; then
      update_plugin "$plugin_name"
      ((plugin_count++)) || true
    fi
  done < <(git submodule foreach --quiet 'echo $name')

  echo ""
  if [[ $plugin_count -gt 0 ]]; then
    print_success "Updated $plugin_count plugin(s)"
    echo ""
    echo "Next steps:"
    echo "  git add plugins/"
    echo "  git commit -m 'Update plugins'"
  else
    echo "No plugin submodules found."
  fi

else
  if [[ -z "$PLUGIN_NAME" ]]; then
    print_error "Specify a plugin name or use --all"
    usage
  fi

  if ! validate_plugin_name "$PLUGIN_NAME"; then
    exit 1
  fi

  print_header "Updating Plugin"
  update_plugin "$PLUGIN_NAME"

  echo ""
  echo "Next steps:"
  echo "  git add plugins/$PLUGIN_NAME"
  echo "  git commit -m 'Update $PLUGIN_NAME'"
fi
