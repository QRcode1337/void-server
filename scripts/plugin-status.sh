#!/bin/bash
# Display plugin status
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/plugin-utils.sh"

PROJECT_ROOT="$(get_project_root)"
PLUGINS_DIR="$PROJECT_ROOT/plugins"
CONFIG_FILE="$PROJECT_ROOT/config/plugins.json"

cd "$PROJECT_ROOT"

print_header "Plugin Status"

# Determine mode
if is_dev_mode "$PLUGINS_DIR"; then
  echo -e "Mode: ${YELLOW}Development (symlinks)${NC}"
else
  echo -e "Mode: ${GREEN}Production (submodules)${NC}"
fi
echo ""

# Count plugins
total=0
enabled=0
disabled=0
symlinks=0
submodules=0

# Get enabled/disabled status from config
get_plugin_enabled() {
  local name="$1"
  if [[ -f "$CONFIG_FILE" ]] && command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
      const enabled = config['$name']?.enabled !== false;
      process.exit(enabled ? 0 : 1);
    " 2>/dev/null
    return $?
  fi
  return 0  # Default to enabled
}

echo "Installed Plugins:"
echo "─────────────────────────────────────────────────────────"

for entry in "$PLUGINS_DIR"/void-plugin-*; do
  if [[ ! -e "$entry" ]]; then
    continue
  fi

  name=$(basename "$entry")
  ((total++))

  # Determine type
  if [[ -L "$entry" ]]; then
    type="symlink"
    target=$(readlink "$entry")
    ((symlinks++))
  elif is_submodule "$PROJECT_ROOT" "$name"; then
    type="submodule"
    ((submodules++))
  else
    type="directory"
  fi

  # Check enabled status
  if get_plugin_enabled "$name"; then
    status="${GREEN}enabled${NC}"
    ((enabled++))
  else
    status="${YELLOW}disabled${NC}"
    ((disabled++))
  fi

  # Get git info for submodules
  git_info=""
  if [[ "$type" == "submodule" ]] && [[ -d "$entry/.git" || -f "$entry/.git" ]]; then
    cd "$entry"
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    git_info="($branch @ $commit)"
    cd "$PROJECT_ROOT"
  elif [[ "$type" == "symlink" ]]; then
    git_info="-> $target"
  fi

  printf "  %-30s %s  %-10s  %s\n" "$name" "$status" "[$type]" "$git_info"
done

if [[ $total -eq 0 ]]; then
  echo "  (no plugins installed)"
fi

echo ""
echo "─────────────────────────────────────────────────────────"
echo "Summary: $total total, $enabled enabled, $disabled disabled"
echo "         $symlinks symlinks, $submodules submodules"
echo ""

# Show submodule sync status if applicable
if [[ -f ".gitmodules" ]] && [[ $submodules -gt 0 ]]; then
  echo "Submodule Status:"
  echo "─────────────────────────────────────────────────────────"

  git submodule status 2>/dev/null | while read -r line; do
    commit=$(echo "$line" | cut -c1-8)
    path=$(echo "$line" | awk '{print $2}')
    name=$(basename "$path")

    # Check prefix for status
    prefix=$(echo "$line" | cut -c1)
    case "$prefix" in
      "-")
        sync_status="${RED}not initialized${NC}"
        ;;
      "+")
        sync_status="${YELLOW}modified${NC}"
        ;;
      "U")
        sync_status="${RED}merge conflict${NC}"
        ;;
      *)
        sync_status="${GREEN}synchronized${NC}"
        ;;
    esac

    if [[ "$name" =~ ^void-plugin- ]]; then
      printf "  %-30s %s\n" "$name" "$sync_status"
    fi
  done

  echo ""
fi

echo "Commands:"
echo "  ./scripts/plugin-add.sh <url>        Add a plugin"
echo "  ./scripts/plugin-remove.sh <name>    Remove a plugin"
echo "  ./scripts/plugin-update.sh --all     Update all plugins"
echo "  ./scripts/plugin-dev-setup.sh        Switch to dev mode"
echo "  ./scripts/plugin-prod-setup.sh       Switch to prod mode"
