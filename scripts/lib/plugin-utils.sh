#!/bin/bash
# Shared utilities for plugin management

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get project root directory
get_project_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  dirname "$script_dir"
}

# Validate plugin name (prevent path traversal, enforce naming convention)
validate_plugin_name() {
  local name="$1"

  # Must start with void-plugin-
  if [[ ! "$name" =~ ^void-plugin-[a-z0-9-]+$ ]]; then
    echo -e "${RED}Error: Invalid plugin name '$name'${NC}" >&2
    echo "Plugin names must:" >&2
    echo "  - Start with 'void-plugin-'" >&2
    echo "  - Contain only lowercase letters, numbers, and hyphens" >&2
    return 1
  fi

  # No path traversal characters
  if [[ "$name" == *".."* ]] || [[ "$name" == *"/"* ]]; then
    echo -e "${RED}Error: Plugin name contains invalid characters${NC}" >&2
    return 1
  fi

  return 0
}

# Validate git URL format
validate_git_url() {
  local url="$1"

  # Allow SSH format: git@github.com:org/repo.git
  local ssh_pattern='^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9._/-]+\.git$'
  # Allow HTTPS format: https://github.com/org/repo.git or without .git
  local https_pattern='^https://[a-zA-Z0-9.-]+/[a-zA-Z0-9._/-]+(\.git)?$'

  if [[ "$url" =~ $ssh_pattern ]] || [[ "$url" =~ $https_pattern ]]; then
    return 0
  fi

  echo -e "${RED}Error: Invalid git URL format${NC}" >&2
  echo "Accepted formats:" >&2
  echo "  - SSH: git@github.com:org/repo.git" >&2
  echo "  - HTTPS: https://github.com/org/repo.git" >&2
  return 1
}

# Extract plugin name from git URL
extract_plugin_name() {
  local url="$1"
  basename "$url" .git
}

# Check if running in dev mode (symlinks present)
is_dev_mode() {
  local plugins_dir="$1"

  if [[ ! -d "$plugins_dir" ]]; then
    return 1
  fi

  for entry in "$plugins_dir"/void-plugin-*; do
    if [[ -L "$entry" ]]; then
      return 0
    fi
  done

  return 1
}

# Check if a plugin is a symlink
is_symlink() {
  local plugin_path="$1"
  [[ -L "$plugin_path" ]]
}

# Check if a plugin is a submodule
is_submodule() {
  local project_root="$1"
  local plugin_name="$2"
  local gitmodules_path="$project_root/.gitmodules"

  if [[ ! -f "$gitmodules_path" ]]; then
    return 1
  fi

  grep -q "plugins/$plugin_name" "$gitmodules_path"
}

# Print a formatted header
print_header() {
  local text="$1"
  echo ""
  echo -e "${BLUE}=== $text ===${NC}"
  echo ""
}

# Print success message
print_success() {
  echo -e "${GREEN}$1${NC}"
}

# Print warning message
print_warning() {
  echo -e "${YELLOW}$1${NC}"
}

# Print error message
print_error() {
  echo -e "${RED}$1${NC}" >&2
}

# Confirm action with user
confirm_action() {
  local message="$1"
  local default="${2:-n}"

  if [[ "$default" == "y" ]]; then
    read -p "$message [Y/n] " response
    [[ -z "$response" || "$response" =~ ^[Yy] ]]
  else
    read -p "$message [y/N] " response
    [[ "$response" =~ ^[Yy] ]]
  fi
}
