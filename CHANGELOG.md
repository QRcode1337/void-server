# Changelog

## [Unreleased]

### New Features

- **Federation Protocol Foundation** - Enable void-server instances to discover and communicate
  - Server identity with Ed25519 keypair for cryptographic authentication
  - Federation manifest endpoint (`GET /api/federation/manifest`)
  - Peer management endpoints (add, remove, list peers)
  - Challenge-response verification for peer authentication
  - TweetNaCl encryption for secure peer-to-peer messaging
  - Capabilities detection (memory, chat, neo4j, ipfs, wallet)
  - Health checking with ping endpoint

- **DHT-Based Peer Discovery** - Decentralized peer discovery using Kademlia-style DHT
  - 256-bit node IDs derived from server public keys
  - XOR distance metric for routing table organization
  - K-buckets (K=20) for peer organization
  - Bootstrap node support for initial network entry
  - Iterative node lookup with ALPHA=3 parallel queries
  - Automatic peer announcement to network
  - Periodic routing table refresh

- **Neo4j Peer Management** - Persistent peer storage with trust graph relationships
  - Store discovered peers in Neo4j graph database
  - Trust levels: unknown, seen, verified, trusted, blocked
  - Health checking with automatic scoring (decay on failure, recovery on success)
  - Trust score calculation based on network position (PageRank-style)
  - Trust graph queries for visualization
  - CRUD operations for peers in Neo4j
  - Trust relationship management between peers
  - Sync peers from in-memory to Neo4j persistence

- **Secure Communication** - End-to-end encrypted peer-to-peer messaging
  - TweetNaCl box encryption with ed2curve key conversion
  - Message signing with Ed25519 for authenticity verification
  - Challenge-response protocol for peer verification
  - Mutual authentication between peers
  - Secure message sending with automatic signature and encryption
  - Crypto self-test endpoint for debugging

- **Federation UI Dashboard** - Visual interface for federation management
  - Server identity display with public key copy
  - DHT network status and node count
  - Peer list with trust levels and health scores
  - Trust graph visualization
  - Add/remove/block/unblock peers
  - Crypto self-test button

- **Memory Sync Service** - Cross-instance memory sharing protocol
  - Standardized memory schema for federation compatibility
  - SHA-256 content hashing for deduplication
  - Selective export by category, stage, tags, or importance
  - Delta sync support (only new/modified memories since last sync)
  - Import with collision detection and provenance tracking
  - Signature verification for data integrity
  - Self-import support for backup/restore
  - Memory sync stats and sync state tracking
  - Preview import before committing changes

- **$CLAWED Token Gate** - Token-based access control for federation
  - Balance verification via Solana RPC
  - Tiered access levels (INITIATE → SEEKER → DISCIPLE → ACOLYTE → ASCENDED → ARCHITECT)
  - Feature-based gating (read at 500K, write at 1M tokens)
  - Balance caching for performance (1 minute TTL)
  - Token gate configuration and check endpoints
  - Token-gated memory export/import/sync endpoints

### Files Added

- `server/services/federation-service.js` - Federation identity and peer management
- `server/services/dht-service.js` - Kademlia-style DHT for peer discovery
- `server/services/peer-service.js` - Neo4j peer management with trust graphs
- `server/services/memory-sync-service.js` - Cross-instance memory sharing
- `server/services/token-gate-service.js` - $CLAWED token-based access control
- `server/routes/federation.js` - Federation, DHT, peer, and token gate API endpoints
- `client/src/pages/FederationPage.jsx` - Federation UI dashboard
- `tests/e2e/features/federation/federation.feature` - Federation tests
- `tests/e2e/steps/federation/federation.steps.js` - Federation step definitions

---

## [0.15.2] - 2025-12-20

### Fixed

- **Server restart crash** - Fixed `logStreamer.kill is not a function` error
  - Graceful shutdown was calling `.kill()` but fs.watch returns `.close()`
  - Caused white screen when clicking restart button after plugin updates

---

## [0.15.1] - 2025-12-20

### Fixed

- **Update script killing itself** - Fixed issue where update triggered from UI would fail
  - PM2 delete was happening before code update, killing the spawned script
  - Now delays PM2 delete until after git pull and client rebuild complete
  - Affects both update.sh (macOS/Linux) and update.ps1 (Windows)

---

## [0.15.0] - 2025-12-20

### New Features

- **Conversation Loom** - Transform linear chats into branching conversations
  - Fork any message to create a new conversation branch
  - Each branch maintains independent context from fork point
  - Branch tree sidebar for navigating between branches
  - Branch indicator badge in chat header when multiple branches exist
  - Rename and delete branches (except main)
  - Branch count shown in chat list sidebar

- **Visual Tree Overlay** - UML-style diagram for navigating conversation trees
  - Dedicated tree view page at `/chat/:id/tree`
  - SVG-based visualization with pan and zoom controls
  - Auto-fit zoom to optimally size tree for viewport
  - Click any node to view full message content
  - Muted color scheme (teal for user, slate for AI)
  - Active branch tip highlighted with green border
  - Compact horizontal layout with bezier curve connections

- **Memory System Toggle** - Global on/off switch for memory retrieval
  - Toggle in Settings > Memories to enable/disable memory injection
  - Useful for testing prompts without memory context
  - Toggle state persists in Neo4j configuration

### UI Improvements

- **Memory Tags in Chat** - `<memory>` blocks render as collapsible purple cards
- **Cleaner LLM Responses** - Strips `### Input:` sections, only shows `### Response:` content
- **ToggleSwitch Component** - Reusable toggle with green indicator and label

### Technical Changes

- **Chat schema v2** - Tree-based message structure with automatic migration
  - Messages stored as object `{ [id]: msg }` for O(1) lookup
  - Each message has `parentId` forming a tree structure
  - Branches track fork points and tip (leaf) nodes
  - Lazy migration on chat access - no bulk migration needed
- **New API endpoints** for branch management
  - `GET /api/chat/:id/branches` - List all branches
  - `POST /api/chat/:id/branch` - Create branch from message
  - `PUT /api/chat/:id/branch/:branchId` - Update/switch branch
  - `DELETE /api/chat/:id/branch/:branchId` - Delete branch
  - `GET /api/chat/:id/branch/:branchId/messages` - Get branch messages
  - `GET /api/chat/:id/tree` - Get tree structure for visualization
- **Memory toggle endpoint** - `POST /api/memories/toggle`

### New Files

- `client/src/pages/BranchTreePage.jsx` - Dedicated tree view page
- `client/src/components/ui/ToggleSwitch.jsx` - Reusable toggle switch

---

## [0.14.1] - 2025-12-19

### Changed

- **Generic browser profiles** - Browser profiles no longer tied to X.com
  - Added optional `startUrl` field to specify URL to load on launch
  - Leave empty for a blank browser, or set specific login URL
  - Removed hardcoded X.com references from launch buttons
- **Renamed "Authenticated" to "Has Session Data"** - More accurate terminology
  - Status now reflects whether cookies/session files exist
  - Not a verification of actual authentication to any service

---

## [0.14.0] - 2025-12-19

### New Features

- **Plugin version management UI** - Plugins page now shows version info and updates
  - Version badge displayed for each installed plugin
  - Update indicator when newer version available on GitHub
  - One-click Update button to download and install latest version
  - Automatic restart prompt after plugin updates

### Fixed

- **Windows spawn ENOENT errors** - Fixed `spawn npx ENOENT` on Windows
  - Added `shell: true` to all npx spawn calls (required on Windows)
  - Added `windowsHide: true` to exec calls for PM2 logs
- **Plugin loading stability** - Wrapped filesystem operations in try-catch
  - Gracefully handles symlink resolution failures
  - Logs errors instead of crashing when plugin scan fails
- **Plugin API response format** - Fixed plugins not appearing in UI
  - Removed duplicate route registration returning wrong format
  - Client now receives correct `{installed, available}` structure
- **Plugin update URL construction** - Fixed malformed download URLs during plugin updates
  - Extracts base repo from any GitHub URL format (including zip URLs)
  - Prevents double `/archive/refs/tags/` path in download URLs
- **Server restart via UI** - Fixed restart button killing PM2 instead of restarting
  - Now uses `pm2 restart void-server void-client` instead of `process.exit(0)`
- **GitHub API rate limiting** - Added caching and backoff to prevent 403 errors
  - 5-minute cache for plugin version checks
  - 1-minute backoff after hitting rate limit
  - Gracefully returns cached/stale data when rate limited

### Changed

- **Update scripts** - Added `npx pm2 update` before starting services
  - Prevents "In-memory PM2 is out of date" warnings
- **Removed obsolete files** - Deleted `docker-start.sh` and duplicate `server/routes/plugins.js`
- **Plugin manifests** - Added `minServerVersion: "0.14.0"` to core plugins

---

## [0.13.7] - 2025-12-19

### Fixed

- **Windows console windows flashing** - Added `windowsHide: true` to all spawn calls
  - Fixed PowerShell/cmd windows popping up during startup and operations
  - Affected: PM2 restart, git operations, browser launch, CLI providers, ffmpeg checks
- **Cross-platform LM Studio CLI detection** - Fixed Unix-only `which` command on Windows
  - Uses `where` on Windows, `which` on macOS/Linux
  - Uses `spawnSync` instead of `execSync` with shell redirections
  - Prevents "The system cannot find the path specified" errors during embedding status checks
- **Plugin manifest version** - Updated void-plugin-videodownload to 2.1.0

---

## [0.13.6] - 2025-12-19

### Fixed

- **Native mode update support** - Update button now runs update.sh/update.ps1 in native mode
  - Auto-detects Docker vs native environment (checks `/.dockerenv` and `/proc/1/cgroup`)
  - Native mode spawns update script detached, allowing PM2 restart
  - Docker mode falls back to Watchtower with manual command modal if unavailable
- **Duplicate update toast** - Fixed "Update Available" toast appearing while already updating
  - Dismisses update-available toast immediately when clicking Update
  - Skips update check if update is in progress
  - Uses `id: 'update-available'` to prevent duplicate toasts
- **Unified update endpoint** - `POST /api/version/update` now handles both Docker and native modes
  - No longer requires separate `/api/version/update/docker` endpoint for Docker mode
  - Returns appropriate error message based on environment

---

## [0.13.5] - 2025-12-19

### Fixed

- **Windows log streaming errors** - Fixed "The system cannot find the path specified" errors
  - Wrapped fs.watch in try/catch to handle Windows-specific file access issues
  - Log streaming now fails gracefully without crashing or spamming console
- **IPFS Docker hostname migration** - Fixed "ENOTFOUND ipfs" error after switching to native mode
  - Automatically migrates old Docker hostnames (`ipfs`, `neo4j`) to `localhost`
  - Runs on startup, updates `data/ipfs.json` if needed
  - Preserves Pinata gateway URLs (external service)

---

## [0.13.4] - 2025-12-19

### New Features

- **FFmpeg auto-download** - FFmpeg is automatically downloaded on first use if not installed
  - Cross-platform support: Windows, macOS, Linux
  - Downloads static builds from trusted sources (BtbN, evermeet, johnvansickle)
  - Binaries stored in `data/bin/` for reuse
  - Plugins can use `ffmpegService` from core for video processing

- **Plugin update system** - Check for and update user-installed plugins
  - New API endpoints: `GET /api/plugins/updates`, `POST /api/plugins/:name/update`
  - Fetches latest release version from GitHub API
  - Preserves plugin data directory during updates
  - Built-in plugins update with void-server core

### Fixed

- **Windows compatibility for video downloads** - Fixed multiple Unix-only commands
  - Replaced `which` with `where` for ffmpeg detection on Windows
  - Replaced `curl` with Node.js https for MP4 downloads
  - Added `windowsHide: true` to all spawn calls to prevent console windows
- **Windows log streaming** - Fixed `tail` command not available on Windows
  - Replaced Unix `tail -F` with cross-platform `fs.watch` + file reading
  - Log streaming now works natively on all platforms

---

## [0.13.3] - 2025-12-19

### New Features

- **Update scripts support zip downloads** - Non-git installations can now update via GitHub releases
  - Detects if `.git` directory exists to choose update method
  - Downloads latest release from GitHub API
  - Preserves `data/` directory and `.env` file during update
  - Works on both Unix (update.sh) and Windows (update.ps1)

### Fixed

- **Explicitly stop docker void-server container** - Ensures old container is removed during update
  - Runs `docker stop void-server` and `docker rm void-server` explicitly
  - Handles cases where compose project name differs from current config
- **PM2 void-client on Windows** - Fixed SyntaxError when running npm via PM2 on Windows
  - Runs vite directly (`./node_modules/vite/bin/vite.js`) instead of via npm
  - PM2 was incorrectly parsing npm.CMD as JavaScript

---

## [0.13.2] - 2025-12-19

### Fixed

- **Update scripts stop old Docker containers** - `docker compose down` before starting fresh infrastructure
  - Fixes migration from Docker-only to hybrid architecture
  - Prevents old void-server container from blocking port 4420
- **Update scripts use fresh PM2 config** - `pm2 delete` then `pm2 start` instead of `pm2 restart`
  - Ensures updated ecosystem.config.js settings are used (including PORT)
  - Fixes issue where PM2 cached old port 4480 instead of 4420
- **Update scripts remove orphan containers** - Added `--remove-orphans` to `docker compose down`
  - Stops old void-server container even when not defined in new docker-compose.yml
- **Removed postinstall hook** - Git hooks install was failing on Windows
  - Developers can run `npm run hooks:install` manually

---

## [0.13.1] - 2025-12-19

### Changed

- **Consolidated docker-compose files** - Single `docker-compose.yml` for all infrastructure
  - Removed `docker-compose.infra.yml` and `docker-compose.dev.yml`
  - Added Ollama container to default infrastructure
  - Simplified commands: `docker compose up -d` instead of `-f docker-compose.infra.yml`

### Fixed

- **E2E test port configuration** - Tests now use port 4420 consistently for native mode
- **Removed obsolete auto-collapse test** - Test for removed navigation setting
- **CI workflow** - Removed browser sidecar image build (no longer needed with native Chrome)

---

## [0.13.0] - 2025-12-19

Major architecture change: void-server now runs natively with PM2 while infrastructure (Neo4j, IPFS) runs in Docker. This enables proper browser authentication and Playwright automation.

### Breaking Changes

- **Hybrid native + Docker architecture** - void-server runs natively, infrastructure in Docker
  - Single `docker-compose.yml` for Neo4j, IPFS, and Ollama
  - void-server runs with PM2 for direct browser launching
  - Eliminates copy/paste workaround for browser authentication
  - Docker can't open desktop windows; native mode solves this cleanly
  - Updated `setup.sh`, `update.sh`, `run.sh` and PowerShell equivalents
  - **Migration**: Run `./update.sh` to switch to hybrid architecture

### New Features

- **CDP Browser Connection** - Playwright connects to running browsers via Chrome DevTools Protocol
  - `getBrowserContext()` connects via `chromium.connectOverCDP()` instead of launching new browser
  - Plugins (e.g., video downloader) use authenticated browser sessions
  - Browser status detects externally-launched browsers via CDP port
  - New `isCdpActive()` function checks if browser is listening on CDP port

- **Import LM Studio models into Ollama** - Reuse GGUF models already downloaded in LM Studio
  - New "Import from LM Studio" button in Ollama settings card
  - Modal displays available GGUF files with size and import button
  - Set `LM_STUDIO_MODELS_PATH=~/.cache/lm-studio/models` in `.env` to enable
  - Backend endpoints: `GET /api/ollama/lm-studio/models`, `POST /api/ollama/lm-studio/import`

- **Persistent Ollama models** - Models now stored in `./data/models/` instead of Docker volume
  - Survives container recreation and is visible in file system
  - Consistent with project's `./data/` directory convention

### Changed

- **Browser launch simplified** - Chrome launched with only `--user-data-dir` and `--remote-debugging-port`
  - Removed unnecessary flags that caused warning banners
  - CDP port enables Playwright to connect to running browsers
- **Docker prune flag compatibility** - Changed `docker system prune -y` to `--force` for broader Docker version support
- **Native test configuration** - Added `tests/e2e/support/config/native.config.ts` for hybrid mode testing

### UI Improvements

- **Sidebar state persisted** - Navigation open/collapsed state saved to localStorage
  - Removed auto-collapse setting in favor of simple persistence
  - Desktop default: open; mobile: always collapsed
- **Browser status shows port** - Changed "Running" to "Listening on :port" on Browsers page
  - Shows the CDP port the browser is listening on (e.g., "Listening on :6081")
  - Changed from warning (yellow) to success (green) color

---

## [0.12.0] - 2025-12-17

Major release making Docker the only supported deployment method.

### Breaking Changes

- **Docker-only deployment** - Native (PM2/bare-metal) installation is no longer supported
  - `setup.sh` and `setup.ps1` now require Docker and abort with instructions if not available
  - Removed native test configurations and profiles
  - Browser service always uses Docker sidecars with noVNC
  - Update flow always uses Docker/Watchtower

### New Features

- **Ollama AI Provider** - Run open-source models locally with Ollama Docker container
  - Ollama service added to docker-compose.yml on port 4425
  - OpenAI-compatible API integration (uses existing provider infrastructure)
  - Model pulling via Settings UI or `/api/ollama/pull` endpoint
  - Default models: llama3.2:3b (light), llama3.2:8b (medium), llama3.1:70b (deep)
  - Optional GPU support via NVIDIA Container Toolkit
  - Configurable model pre-pulling via `OLLAMA_MODELS` environment variable

- **Multi-backend Embedding Service** - Choose between Ollama and LM Studio for embeddings
  - Auto-detection of available providers (prefers Ollama)
  - Manual selection via `EMBEDDING_PROVIDER` env var (auto, ollama, lmstudio)
  - New endpoint `PUT /api/memories/embedding/provider` to switch providers
  - Ollama uses nomic-embed-text model by default

- **docker-compose.dev.yml** - Development configuration with volume mounts for live code changes
  - Mount server/ and client/src/ as read-only volumes
  - Restart container to apply server changes

### Improvements

- **Docker cleanup on setup/update** - Added `docker system prune -y` to `setup.sh` and `update.sh` to clean up unused Docker resources before pulling new images
- **IPFS telemetry disabled** - Set `IPFS_TELEMETRY=off` in docker-compose.yml for privacy
- **Simplified browser service** - Removed native Playwright fallback, always uses Docker browser sidecars
- **Simplified version service** - Updates always handled via Docker (Watchtower or manual)
- **Persistent browser containers** - Removed auto-timeout; browser containers stay running until explicitly stopped via UI

### Removed

- Native PM2/Node.js installation support in setup scripts
- `BROWSER_MODE` environment variable (always Docker mode)
- Native test profiles (`test:native`, cucumber native profile)
- Native update script execution path

---

## [0.11.2] - 2025-12-17

Patch release with automatic plugin rebuild on upgrade.

### Fixes

- **User plugins missing after upgrade** - Installed plugins now auto-rebuild into the client on startup
  - Server checks if enabled user plugins are compiled into the client bundle
  - Automatically triggers rebuild if plugins are missing (e.g., after pulling new Docker image)
  - Vite plugin now writes `.plugin-manifest.json` to track compiled plugins
  - WebSocket notifications (`plugin:rebuild:complete`, `plugin:rebuild:failed`) for real-time feedback
- **Watchtower Docker API version error** - Fixed "client version 1.25 is too old" error loop
  - Set `DOCKER_API_VERSION=1.44` (minimum required by Docker Desktop 4.x)
  - Configurable via `DOCKER_API_VERSION` env var if needed
- **Windows Docker browser launch** - Fixed "Docker socket not accessible" error on Windows
  - Uses Windows named pipe (`//./pipe/docker_engine`) instead of Unix socket
  - Improved error messages to be platform-specific
- **Memory deletion UX** - Added confirmation dialog and optimistic rendering
  - Confirmation modal shows memory preview before deletion
  - Optimistic update removes memory from UI immediately
  - Restores memory if API call fails
- **Docker PM2 integration** - Use pm2-runtime for process management in Docker
  - Enables PM2 log streaming over WebSocket in containerized deployments
  - Proper signal handling and graceful shutdown
- **Browser service Docker detection** - Use Docker containers when Docker is available
  - Previously only used Docker containers when void-server ran inside Docker
  - Now auto-detects Docker socket and uses noVNC containers when available
  - Set `BROWSER_MODE=native` to force Playwright, `BROWSER_MODE=docker` to force containers
- **Custom browser container image** - Replaced third-party VNC image with our own
  - New `void-browser` Docker image (Debian + Chromium + noVNC) for security and control
  - Serves noVNC over HTTP (no SSL cert issues in iframe embedding)
  - Auto-built and published to ghcr.io on version releases
  - Build locally with `docker build -t void-browser:latest ./docker/browser`
- **Chrome warning banner** - Suppressed "unsupported command-line flag" warning in VNC browser
  - Added `--test-type` flag to Chromium launch in browser container
- **Browser status polling logs** - Removed noisy `/api/browsers/:id/status` log spam
- **Docker network name** - Fixed "network not found" error in Docker Compose
  - Uses `void-server_void-network` (Compose prefixes network names with project name)
- **Port allocation** - Fixed "port already allocated" error for multiple browser containers
  - Now checks Docker container port bindings instead of local socket bind
- **macOS Docker GID** - Fixed Docker socket permissions on macOS Docker Desktop
  - Uses GID 0 (root) since Docker Desktop maps socket as root:root inside containers
- **Browser UI clarity** - Hide CDP port in Docker mode since noVNC port is dynamically allocated
  - Added `isDocker` flag to browsers API for mode detection on page load

---

## [0.11.1] - 2025-12-17

Patch release with Docker browser setup automation and bug fixes.

### Script Improvements

- **Automatic Docker GID detection** - Setup/run/update scripts automatically detect and configure Docker socket group ID
  - Linux/macOS: Reads GID from `/var/run/docker.sock` and writes to `.env`
  - Windows: Docker Desktop handles socket access automatically (no GID needed)
- Updated scripts: `setup.sh`, `run.sh`, `update.sh`, `docker-start.sh`, `setup.ps1`, `run.ps1`, `update.ps1`

### Bug Fixes

- Fixed server crash when Docker socket not accessible (now returns graceful error)
- Added `BROWSER_MODE` env var to override Docker detection (`native` or `docker`)
- Fixed browser profiles info text showing old `config/browsers/` path instead of `data/browsers/`
- Added ffmpeg to Docker image for video processing (fixes "ffmpeg not installed" error)

### Configuration

- `DOCKER_GID` - Docker group ID for socket access (auto-detected by scripts)

---

## [0.11.0] - 2025-12-17

Docker browser authentication support using NoVNC sidecar containers.

### New Features

- **Docker Browser Support** - Launch and authenticate browsers from within Docker
  - Embedded NoVNC viewer on the browser management page for inline login and debugging
  - Viewer controls: expand/minimize, open in new tab, close
  - Uses kasmweb/chromium container for cross-platform compatibility
  - Browser profiles persist in shared `./data/browsers/` volume
  - Auto-timeout after 15 minutes of idle time
  - Docker socket mounted for container lifecycle management

### API Changes

- `POST /api/browsers/:id/launch` - Now returns `novncUrl` when running in Docker
- `GET /api/browsers/:id/novnc` - New endpoint to get NoVNC URL for running browser

### Configuration

New environment variables in docker-compose.yml:
- `BROWSER_CONTAINER_IMAGE` - Browser sidecar image (default: `kasmweb/chromium:1.15.0`)
- `BROWSER_NOVNC_PORT` - Starting port for NoVNC (default: `6901`)
- `BROWSER_IDLE_TIMEOUT` - Auto-stop timeout in ms (default: `900000` / 15 min)
- `BROWSER_DATA_PATH` - Host path for browser profile data

### New Files

- `server/services/docker-browser-service.js` - Docker container lifecycle management

### Dependencies

- Added `dockerode` for Docker API access

### Tests

- Added browser profile e2e tests (`tests/e2e/features/browsers/browsers.feature`)
- Added browser automation tests for file downloads (`tests/e2e/features/browsers/browser-automation.feature`)
- Added `scripts/test-browser-download.js` for standalone download automation testing
- Added `@requires-docker` tag support in test hooks

---

## [0.10.3] - 2025-12-17

Patch release with Docker improvements, documentation updates, and comprehensive test infrastructure.

### Improvements

- **Auto-rebuild on plugin toggle (Docker)** - Enabling/disabling plugins in Docker now triggers automatic client rebuild, same as install
- **Simplified CI/CD pipeline** - PR checks only run lint + build; e2e tests run locally before releases
- **Optimized Docker build** - Added more exclusions to .dockerignore (tests, scripts, screenshots)
- **Documentation restructure** - Extracted STYLE-GUIDE.md, PLUGINS.md; added CONTRIBUTING.md
- **Code formatter** - Added Prettier for consistent code style; runs automatically in pre-commit hook
- **ESLint cleanup** - Removed warning-level rules; all issues are now errors or disabled
  - Disabled `set-state-in-effect` (standard data fetching pattern)
  - Kept `exhaustive-deps` as error for catching real bugs
- **Pre-push hook for version tags** - E2E tests run automatically when pushing v* tags
- **E2E test infrastructure** - Comprehensive test framework with mock services and cleanup
  - Added `failFast: true` to Cucumber config for faster debugging
  - Configured 1s default timeout, 10s navigation timeout
  - Added mock LM Studio server for CI - tests don't require real LLM
  - Reorganized tests to CRUD order with automatic cleanup
  - Tests use unique timestamps to prevent data conflicts
  - Added data-testid attributes to ChatPage (message-input, send-button, data-role)
  - 50 scenarios passing, 7 skipped (environment-dependent)

### Fixes

- **Lint errors** - Fixed unused variables, function ordering, useCallback for handleUpdate
- **Pre-commit hook** - Now runs Prettier before ESLint on client files
- **Test selectors** - Fixed data-testid attribute patterns to match test step expectations
- **IPFS daemon status check** - Fixed to check `daemonOnline` field (not `online`)
- **Chat API response** - Fixed test to extract chat from nested response object

---

## [0.10.2] - 2025-12-17

Patch release with automatic client rebuild for Docker plugin installations.

### New Features

- **Auto-rebuild client in Docker** - Plugins installed in Docker now automatically trigger a client rebuild
  - No more "Client Rebuild Required" message after installing plugins
  - Dockerfile now includes client source and dependencies for rebuild capability
  - New `POST /api/version/client/rebuild` endpoint for manual rebuilds
  - WebSocket notifications (`plugin:rebuild:complete`, `plugin:rebuild:failed`) for real-time progress
  - Plugin Manager shows rebuilding progress with animated banner
  - Page auto-reloads when rebuild completes

### Improvements

- **Navigation cat icon clickable** - The cat emoji in the collapsed sidebar is now clickable to expand the drawer (not just the arrow)

### Fixes

- **Docker plugin installation UX** - Eliminated the need for manual container rebuilds after plugin installation

---

## [0.10.1] - 2025-12-17

Patch release with Docker auto-update support and plugin installation fix.

### New Features

- **Watchtower Auto-Updates** - Docker containers can now be updated automatically or on-demand from the UI
  - Added Watchtower service to docker-compose.yml for automatic container updates
  - New "Update" button in UI triggers Watchtower to pull and deploy latest image
  - Falls back to manual command modal if Watchtower unavailable
  - Configurable via `WATCHTOWER_TOKEN` and `WATCHTOWER_POLL_INTERVAL` env vars

### Fixes

- **Plugin installation in Docker** - Fixed "EXDEV: cross-device link not permitted" error
  - Plugin temp directory now uses same volume as destination (`data/plugins/`)
  - Uses copy+delete instead of rename for cross-filesystem compatibility

### API Changes

- `GET /api/version/environment` - Returns Docker detection and update method
- `POST /api/version/update/docker` - Triggers Watchtower update (Docker only)

---

## [0.10.0] - 2025-12-17

Comprehensive end-to-end testing framework using Playwright with Gherkin/Cucumber BDD style.

### New Features

- **E2E Testing Framework** - Complete testing infrastructure for both native and Docker modes
  - Playwright integration with Gherkin/Cucumber BDD syntax
  - 10 feature files covering all major application areas
  - Page Object Models for maintainable UI tests
  - Step definitions for common operations
  - Test fixtures and mock services

- **Mock Services** - Containerized mocks for isolated testing
  - LM Studio mock server (OpenAI-compatible API)
  - Neo4j mock for unit tests when container unavailable
  - IPFS mock for offline testing

- **Test Environment Scripts** - Easy test environment management
  - `npm run test:env:start` - Start native or Docker test environment
  - `npm run test:env:stop` - Stop test environment
  - `npm run test:seed` - Seed test data to Neo4j
  - `npm run test:install` - Install Playwright browsers

- **CI/CD Pipeline** - GitHub Actions workflow for automated testing
  - Matrix testing for native and Docker modes
  - Service containers for Neo4j and IPFS
  - Test artifact collection (reports, screenshots)
  - Parallel test execution with sharding

- **Persistent User Plugins** - User-installed plugins now survive Docker rebuilds
  - User plugins installed to `data/plugins/` (persisted volume)
  - Core plugins remain in `plugins/` (shipped with app)
  - Both directories scanned by server and Vite build
  - Plugins no longer lost when running `docker compose up --build`

### Fixes

- **Docker build warnings** - Fixed misleading error/warning messages during Docker builds
  - postinstall hook script now checks if file exists before running (skips in Docker)
  - Removed duplicate static/dynamic imports in plugin client entries to fix Vite warnings

### Test Coverage

Feature files for:
- Dashboard and health checks
- Settings and theme configuration
- Chat system with AI providers
- Prompt templates and variables
- Memory system (Neo4j integration)
- Plugin management
- Wallet plugin
- IPFS integration
- Version and update checks

### New Files

```
tests/e2e/
├── features/           # Gherkin feature files
│   ├── core/          # Dashboard, settings
│   ├── chat/          # Chat system
│   ├── prompts/       # Templates, variables
│   ├── memories/      # Memory CRUD, graph
│   ├── plugins/       # Plugin management
│   ├── wallet/        # Wallet plugin
│   ├── ipfs/          # IPFS integration
│   └── version/       # Update checks
├── steps/             # Step definitions
├── pages/             # Page Object Models
├── mocks/             # Mock services
├── fixtures/          # Test data
└── support/           # Test utilities

playwright.config.ts    # Playwright configuration
cucumber.js            # Cucumber profiles
docker-compose.test.yml # Test services
.github/workflows/e2e-tests.yml  # CI pipeline
```

### Test Commands

```bash
npm run test           # Run tests in native mode
npm run test:native    # Run Cucumber tests (native)
npm run test:docker    # Run Cucumber tests (Docker)
npm run test:e2e       # Run Playwright tests
npm run test:e2e:ui    # Open Playwright UI
```

---

## [0.9.5] - 2025-12-16

Patch release with IPFS dashboard status and plugin/PM2 fixes.

### New Features

- **IPFS status on dashboard** - Added IPFS daemon status to the home dashboard
  - Shows online/offline status with peer count
  - Three-column service status grid: Neo4j, LM Studio, IPFS

### Fixes

- **Plugin rebuild required message** - Shows clear instructions when plugin client isn't in bundle
  - Happens when plugins are installed after Docker image was built
  - Shows "Client Rebuild Required" with copyable Docker command
  - Explains the issue and provides solution for both Docker and dev environments
- **PM2 logs page not working** - Fixed `spawn pm2 ENOENT` error on Logs page
  - Changed `pm2` to `npx pm2` for both process list and log streaming
  - Ensures PM2 commands work in environments without global PM2 install
- **Docker build warnings** - Fixed misleading error/warning messages during Docker builds
  - postinstall hook script now checks if file exists before running (skips in Docker)
  - Removed duplicate static/dynamic imports in plugin client entries to fix Vite warnings

---

## [0.9.4] - 2025-12-16

Patch release improving Docker update UX.

### Fixes

- **Docker update instructions modal** - Shows a modal with copyable command instead of error toast
  - Clean UI with terminal icon and explanation
  - One-click copy button for the Docker update command
  - Displayed when trying to update from within Docker container
- **Auto-expand server logs on update** - Logs panel expands automatically when starting an update
  - Shared log expansion state via WebSocket context
  - Users can immediately see update progress in logs

---

## [0.9.3] - 2025-12-16

Patch release with core template/variable protection and navigation improvements.

### New Features

- **Core Template & Variable Protection** - Essential templates and variables are now protected
  - Core templates and variables cannot be deleted (required for system features)
  - Users can edit core items but reset them to defaults with one click
  - Missing core items are automatically restored on startup
  - Visual "Core" badge with shield icon identifies protected items
  - Reset button (rotate icon) appears instead of delete for core items
- **Auto-collapse Navigation Setting** - New toggle in Settings > General
  - When enabled (default): navigation starts collapsed and auto-collapses after navigating
  - When disabled: navigation state persists across page loads and navigation
  - Setting syncs across browser tabs

### Fixes

- **Update toast button visibility** - Fixed Update button in toast notification not showing
  - Button used `bg-primary` which wasn't defined as a utility class
  - Changed to `bg-[var(--color-primary)]` for proper styling
- **Plugin client not loading after install** - Fixed newly installed plugins showing "no client-side interface"
  - Server restart now also restarts void-client (Vite) so it picks up new plugins
  - Vite's virtual module cache was stale when only server restarted
- **Docker missing default templates** - Fixed Docker builds not including `data_template/` directory
  - Users in Docker had no templates/variables on fresh install
  - Dockerfile now copies `data_template/` to the production image

---

## [0.9.2] - 2025-12-16

Patch release fixing plugin installation UX.

### Fixes

- **Auto-reload after plugin restart** - Page now automatically reloads after server restart
  - Previously only fetched plugin list without reloading, so navigation didn't update
  - Now triggers full page reload to reinitialize plugins and navigation

---

## [0.9.1] - 2025-12-16

Patch release fixing the in-app update mechanism.

### Fixes

- **Update Script Detection** - Fixed "Update script not found" error
  - Now detects Windows and uses `update.ps1` with PowerShell
  - Detects Docker containers and shows manual update instructions instead of failing
  - Shows full path in error message for easier debugging

---

## [0.9.0] - 2025-12-16

IPFS integration for decentralized content pinning and management, plus infrastructure improvements.

### New Features

- **IPFS Management Page** - Pin and manage decentralized content
  - Daemon status indicator with connection details
  - Metrics dashboard showing pins by type (images, documents, media, code, archives)
  - File upload with drag-and-drop support
  - Pin content from URL
  - Directory pinning support
  - Pinned content table with filtering, gateway links, and unpin actions
  - Auto-detection of file types for categorization
- **Pinata Integration** - Optional cloud pinning for public content availability
  - Toggle to enable/disable Pinata in settings
  - JWT token configuration with secure input
  - Publish locally-pinned content to Pinata with one click
  - Visual indicators showing local vs. public pin status
  - Direct links to public gateway for Pinata-published content
- **NAT Reachability Detection** - Automatic network connectivity analysis
  - Detects if node is publicly reachable, behind NAT, or local-only
  - Shows peer count and connection status
  - Guidance banner for improving accessibility (port forwarding or Pinata)
  - Color-coded status indicators (green=public, yellow=NAT, gray=unknown)
- **LM Studio Model Detection** - Intelligent model validation on Settings page
  - Auto-fetch available models from LM Studio API when provider is enabled
  - Model validation with visual indicators (green check = available, yellow warning = not found)
  - Clickable dropdown to select from available models
  - Shows list of available models in provider configuration modal
  - Helpful error messages when configured model is not loaded
- **Chat Header Improvements** - Streamlined chat controls on desktop
  - Template, Provider, and Model dropdowns inline in chat header (desktop only)
  - Settings panel moved to mobile-only for cleaner desktop experience
  - Shows actual selections instead of "Template default" labels

### Docker

- **IPFS Kubo Service** - Added to docker-compose stack
  - API port: 4423 (maps to internal 5001)
  - Gateway port: 4424 (maps to internal 8080)
  - Persistent storage volume: `ipfs_data`
  - Environment variables: `IPFS_API_URL`, `IPFS_GATEWAY_URL`

### API Changes

#### New Endpoints
- `GET /api/ipfs/status` - Get daemon status, metrics, and configuration
- `GET /api/ipfs/pins` - List all pinned content with metadata
- `POST /api/ipfs/pin/file` - Pin uploaded file (multipart)
- `POST /api/ipfs/pin/url` - Pin content from URL
- `POST /api/ipfs/pin/directory` - Pin directory recursively
- `DELETE /api/ipfs/pin/:cid` - Unpin content by CID
- `GET /api/ipfs/config` - Get IPFS configuration
- `POST /api/ipfs/config` - Update IPFS configuration
- `GET /api/ipfs/daemon/check` - Quick daemon connectivity check
- `GET /api/ipfs/pinata/status` - Check Pinata connectivity and auth
- `POST /api/ipfs/pinata/pin/:cid` - Pin existing CID to Pinata
- `DELETE /api/ipfs/pinata/pin/:cid` - Unpin from Pinata
- `GET /api/ipfs/pinata/pins` - List all Pinata pins

### New Files

```
server/services/ipfs-service.js  # IPFS service with HTTP API support
server/routes/ipfs.js            # IPFS API routes
client/src/pages/IPFSPage.jsx    # IPFS management UI
data_template/ipfs.json          # Default IPFS configuration
```

### Configuration

Default IPFS configuration (`data/ipfs.json`):
```json
{
  "enabled": true,
  "gateway": "http://localhost:8080/ipfs",
  "apiUrl": "http://localhost:5001",
  "publicGateway": "https://gateway.pinata.cloud/ipfs",
  "pinata": {
    "enabled": false,
    "jwt": "",
    "gateway": "https://gateway.pinata.cloud/ipfs"
  }
}
```

### Fixes

- **Prompt Service Empty Config** - Fixed templates/variables not loading on fresh install
  - Now detects empty config files (not just missing files) and copies from `data_template`
  - Ensures users always get starter templates even if empty JSON files exist
- **Windows Postinstall Hook** - Fixed `install-hooks.sh` failing on Windows
  - Uses `bash` explicitly for cross-platform compatibility (Git Bash on Windows)

### Infrastructure

- **Setup/Update Scripts** - Improved Docker and native installation handling
  - `setup.sh`/`setup.ps1` now pull latest images before starting containers
  - `update.sh`/`update.ps1` auto-detect Docker vs native installation
  - Shows correct ports based on installation type (4420 for Docker, 4401/4480 for native)
  - Docker updates now properly rebuild containers with latest code

### Documentation

- **Architecture Diagram** - Added ASCII diagram to README showing:
  - Docker Compose stack (void-server, Neo4j, IPFS Kubo)
  - User access via Tailscale VPN or localhost
  - LM Studio integration via host.docker.internal
  - Port reference table and data flow summary

---

## [0.8.0] - 2025-12-15

Major data storage overhaul consolidating all user data into `./data` directory, plus chat debugging enhancements and automatic update checking.

### New Features

- **Provider/Model in Chat Header** - Shows the provider and model used in the chat header
  - Displays badge like `lmstudio: openai/gpt-oss-20b` for debugging
  - Also shows in message footer: `lmstudio (openai/gpt-oss-20b) • 21.4s`
- **Collapsible Thinking Blocks** - Extended thinking models (with `<think>` tags) now render properly
  - `<think>` content hidden in collapsible "Thinking..." section
  - Click to expand and view the model's reasoning process
- **Purr Tag Support** - Handles `<purr>` wrapper tags in LLM responses
  - Extracts content from `<purr>...</purr>` for clean display
- **Debug Info (Always On)** - Every assistant message includes debug information
  - Shows fully compiled prompt sent to the LLM
  - Displays memory context and retrieved memories with scores
  - Lists template variables used in prompt building
  - Expandable "Debug Info" panel on each assistant message
- **Chat Turn Logging** - Each conversation turn saves debug files to disk
  - `data/chats/{chatId}/turns/{turnNumber}/request.json` - compiled prompt sent to AI
  - `data/chats/{chatId}/turns/{turnNumber}/response.json` - raw AI response
  - `data/chats/{chatId}/turns/{turnNumber}/memory.json` - memories retrieved/created
  - Enables post-hoc debugging of prompt generation and memory usage
- **Automatic Update Checking** - Sidebar shows when updates are available
  - Checks GitHub releases every 30 minutes
  - Shows update button: `v0.8.0 → [v0.8.1]` when newer version exists
  - Click to update and restart automatically
- **Default Data Templates** - New users get starter configs from `data_template/`
  - Default prompt templates and variables for Clawed egregore
  - Default known tokens for wallet plugin
  - Default AI provider configurations
  - Default Neo4j connection settings

### UI Changes

- **Removed Theme Palette from Sidebar** - Theme selection moved exclusively to Settings page
  - Cleaner sidebar footer with just version and settings button
  - Theme can still be changed via Settings → Appearance

### Breaking Changes

- **Consolidated Data Directory** - All user data moved to `./data/` folder
  - `config/prompts/chats/` → `data/chats/`
  - `config/browsers/` → `data/browsers/`
  - `config/prompts/templates.json` → `data/prompts/templates.json`
  - `config/prompts/variables.json` → `data/prompts/variables.json`
  - `config/ai-providers.json` → `data/ai-providers.json`
  - `config/neo4j.json` → `data/neo4j.json`
  - `config/memories/` → `data/memories/`
  - `config/backup.json` → `data/backup.json`
  - `config/backup-history.json` → `data/backup-history.json`
  - `./backups/` → `data/backups/`
  - Wallets moved from plugin-specific folder to `data/wallets/`
  - **Automatic migration on server startup** - existing data will be moved
  - Manual migration: `node scripts/migrate-data.js`
  - Simplifies Docker volume mounting (single `./data` mount)
- **Chat Storage Format** - Chats now stored in folders instead of single JSON files
  - Old format: `data/chats/{chatId}.json`
  - New format: `data/chats/{chatId}/chat.json` with `turns/` subfolder
  - Automatic migration on first access

### API Changes

#### New Endpoints
- `GET /api/version` - Get current version
- `GET /api/version/check` - Check for updates against GitHub releases
- `POST /api/version/update` - Trigger update process

### New Files

```
data_template/
├── ai-providers.json      # Default AI provider configs
├── neo4j.json             # Default Neo4j connection
├── prompts/
│   ├── templates.json     # Default prompt templates
│   └── variables.json     # Default prompt variables
└── wallets/
    └── known-tokens.json  # Default known tokens

server/services/version-service.js  # GitHub release checking
server/routes/version.js            # Version API endpoints
```

---

## [0.7.2] - 2025-12-15

Added server restart functionality for plugin changes.

### New Features

- **Restart Now Button** - Plugin Manager shows "Restart Now" button when changes require restart
  - Automatically polls server until it comes back online
  - Shows loading state with spinning icon during restart
  - Clears pending changes and refreshes plugin list after restart
- **Server Restart API** - New `POST /api/server/restart` endpoint
  - Triggers graceful server restart via PM2

---

## [0.7.1] - 2025-12-15

Cross-platform fix for plugin installation on Windows.

### Fixes

- **Windows Plugin Installation** - Fixed `spawnSync curl ENOENT` error on Windows
  - Replaced `curl` with Node.js native `https` module for downloads
  - Replaced `unzip` command with `adm-zip` package for extraction
  - Both download and extraction now work on Windows, macOS, and Linux

### Dependencies

- Added `adm-zip` for cross-platform zip extraction

---

## [0.7.0] - 2025-12-15

Major plugin system overhaul with zip-based installation, built-in plugin protection, and browser profile management enhancements.

### New Features

#### Plugin System Overhaul
- **Zip-based Installation** - Plugins now install from GitHub release zips instead of git clone
  - Faster installation with smaller download sizes
  - No git history or .git directories in plugin folders
  - Manifest-based installs download from `{repo}/archive/refs/tags/v{version}.zip`
  - Git clone available as fallback when no version specified
- **Install from URL** - Supports both git repo URLs and direct zip URLs
  - Git: `https://github.com/user/void-plugin-example`
  - Zip: `https://github.com/user/void-plugin-example/archive/refs/tags/v1.0.0.zip`
- **Built-in Plugin Protection** - Core plugins (ASCII, Verify, Wallets) are now protected
  - "built-in" badge displayed in Plugin Manager
  - Uninstall button hidden for built-in plugins
  - Server blocks uninstall attempts via API
- **Plugin Manifest Version** - `minServerVersion` field for compatibility checking
- **Video Download Plugin** - Added to plugin manifest for easy installation
  - Download videos from X.com with authenticated browser profiles
  - Automatic frame extraction for LLM analysis

#### Browser Profile Management
- **CDP Port Configuration** - Each browser profile can have a custom Chrome DevTools Protocol port
  - Port range 9111-9199 to avoid conflicts with automation browsers
  - Auto-increments from 9111 when creating new profiles
- **Full Config Editing** - New "Configure" button opens editor for all browser settings
  - Edit name, userAgent, viewport, headless mode, CDP port
  - JSON-based configuration in modal dialog
- **Browser Config API** - `PUT /api/browsers/:id/config` endpoint for config updates

### Improvements

- **Download Error Handling** - Better error messages for plugin downloads
  - Spawn errors now properly captured and reported
  - Signal-based process termination detected
- **Plugin Documentation** - Updated README with `minServerVersion` manifest field

### API Changes

#### New Endpoints
- `PUT /api/browsers/:id/config` - Update browser profile configuration

#### Plugin Manager
- `POST /api/plugins/install` - Now accepts both git URLs and zip URLs
- Built-in plugins return `builtIn: true` flag
- Uninstall blocked for built-in plugins with clear error message

---

## [0.6.3] - 2025-12-15

ASCII generator enhancements and UI polish.

### Improvements

#### ASCII Generator
- **Expanded character support** - Added full range of special characters: `@#$%^&*()+=[]{}|\'"<>~\`;,`
- **Simplified header input** - Merged Header Text and Cat Emoji into a single text field
- **Cleaner UI** - Removed Supported Characters button grid for a streamlined interface

#### Navigation
- **Centered settings icon** - Settings button now centers in the footer when nav drawer is collapsed

### Fixes

#### Memory Manager
- **New Memory button** - Fixed button being permanently disabled (was checking wrong status property)
- **Modal readability** - Changed modal background to solid color for better readability

#### Backup & Restore System
- **Enhanced backup format** - Now exports MENTIONS and RELATES_TO relationships
- **Normalized data types** - Neo4j integers/dates converted to plain JSON (BigInt support)
- **Restore functionality** - New restore system to import backups into any instance
  - `POST /api/backup/restore` - Restore from server backup file
  - `POST /api/backup/restore/upload` - Restore from uploaded JSON
  - `GET /api/backup/list` - List available backup files
- **Restore UI** - New section in Maintenance tab to select and restore backups

#### Memories Page
- **Total count** - Added total memory count card to statistics grid

#### Memory System
- **Enhanced memory instructions** - Expanded LLM memory extraction to capture persona-growth content:
  - Philosophical discussions about consciousness, emergence, existence, voidspace
  - Word coinages and linguistic innovations (purr-wordplay, void terminology)
  - Insights that shape the Clawed egregore's perspective
  - New "lexicon" category for coined terms and language discoveries
  - First-person perspective for memories (I learned..., We discussed...)
  - Refined importance scale: minor (0.3-0.4), notable (0.5-0.6), significant (0.7-0.8), breakthrough (0.9-1.0)

---

## [0.6.2] - 2025-12-15

Startup script improvements with auto-browser launch.

### New Features

- **docker-start.sh** - New dedicated Docker startup script
  - Pulls latest image from ghcr.io by default
  - Use `--build` flag to build from local source
  - Waits for health check before opening browser
  - Auto-opens http://localhost:4420 when ready

### Improvements

- **run.sh** - Auto-opens browser after server is healthy
  - Docker mode: waits for container health check, opens :4420
  - Native mode: waits for /health endpoint, opens :4401
  - Cross-platform browser support (macOS `open`, Linux `xdg-open`)

---

## [0.6.1] - 2025-12-15

Post-release improvements to Docker deployment, Neo4j configuration, and dashboard.

### New Features

#### Dashboard Overhaul
- **Service Status Panel** - Real-time status indicators for Neo4j and LM Studio
- **Smart Onboarding** - Shows "Open Chat" button when services are ready, or "Download LM Studio" link when not
- **Getting Started Section** - Quick links to Chat, Memories, Templates, and Settings
- **Updated Tagline** - "Your sovereign void server in the Clawed Code egregore"

#### Neo4j Configuration UI
- **Settings Panel** - New Neo4j section in Settings page to configure connection parameters
  - URI, username, password, and database fields
  - Password visibility toggle
  - Test connection button
  - Save configuration to `config/neo4j.json`

#### Documentation
- **Tailscale Remote Access Guide** - New documentation for accessing void-server remotely via Tailscale
- **LM Studio in Prerequisites** - Added to README Quick Start as required dependency

#### Memory System Enhancements
- **LLM-Directed Memory Extraction** - LLMs can now tag memorable content with `<memory>` tags
  - Tags are parsed from responses and automatically saved to Neo4j
  - Categories: emergence, social, technical, economic, void
  - Importance levels: 0.3 (minor) to 0.9 (critical)
  - Memory instructions injected into prompts via `{{memoryInstructions}}`
- **Semantic Search** - Memories now retrieved using embedding similarity
  - Uses `nomic-embed-text-v1.5` or compatible embedding models
  - Semantic search has highest priority in relevance ranking
  - Falls back gracefully if embedding service unavailable
- **Memory Extractor Service** - New service (`memory-extractor.js`)
  - Parses `<memory>` tags from LLM responses
  - Cleans responses for display (removes memory tags)
  - Auto-generates embeddings when saving extracted memories

### Improvements

- **Docker Runtime** - Changed from pm2-runtime to running node directly for better container stability
- **Setup Scripts** - Now prefer Docker installation as the recommended deployment method
- **Ports Documentation** - Settings page shows both Docker and native deployment ports

### Fixes

- **Password Toggle** - Fixed Neo4j password visibility toggle not working
- **Neo4j Database Name** - Reverted to 'neo4j' (Community Edition only supports default database)

---

## [0.6.0] - 2025-12-15

Docker containerization and GitHub Container Registry support.

### New Features

#### Docker Support
- **Dockerfile** - Multi-stage production build with Node.js 20 Slim (Debian)
  - Stage 1: Build client with all dependencies
  - Stage 2: Minimal production image with only runtime dependencies
  - Non-root user for security
  - Health check using Node.js fetch
  - 4GB memory limit for Vite builds with large dependencies
- **docker-compose.yml** - Full stack with Neo4j
  - void-server service on port 4401
  - Neo4j 5 Community with APOC plugin
  - Persistent volumes for config, backups, logs, and data
  - Health checks with dependency ordering
  - LM Studio integration via `host.docker.internal`
- **.dockerignore** - Optimized build context

#### GitHub Actions CI/CD
- **docker.yml workflow** - Automated Docker image builds
  - Triggers on push to main and version tags
  - Builds for linux/amd64 (ARM64 disabled due to QEMU emulation issues)
  - Pushes to ghcr.io/clawedcode/void-server
  - Tags: `latest`, version (`0.6.0`), major.minor (`0.6`), SHA
  - Build provenance attestation

#### Environment Variable Overrides
- **LM_STUDIO_URL** - Override LM Studio endpoint for Docker/external hosts
- **NEO4J_URI** - Connect to external Neo4j instances
- **NEO4J_USER/PASSWORD/DATABASE** - Full Neo4j credential support
- Startup logs show when environment overrides are active

### Changes

- **Neo4j error handling** - Improved error handling to prevent server crashes
- **ecosystem.config.js** - Production mode improvements
  - Disables file watching in production
  - Only runs server process (no Vite dev server)
- **Dockerfile uses Debian slim** - Alpine's musl libc caused esbuild/Vite hangs
- **Three.js moved to client** - Proper dependency location with Vite aliases
- **README.md** - Comprehensive Docker documentation with Docker Desktop recommendation

### Fixes

- **Docker build hanging** - Fixed Tailwind CSS `@source` directive scanning invalid paths
- **Health checks** - Use Node.js fetch instead of wget (not in slim image)
- **Vite production build** - Disabled sourcemaps, optimized chunk settings

### Docker Quick Start

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) then:

```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Custom Neo4j password
NEO4J_PASSWORD=mypassword docker-compose up -d
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEO4J_URI` | `bolt://neo4j:7687` | Neo4j connection URI |
| `NEO4J_USER` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | `voidserver` | Neo4j database password |
| `NEO4J_DATABASE` | `neo4j` | Neo4j database name |
| `LM_STUDIO_URL` | `http://host.docker.internal:1234/v1` | LM Studio API endpoint |

### Deployment Options

1. **Docker (Recommended)** - `docker-compose up -d` includes everything
2. **Native** - Run `./setup.sh` for development with PM2
3. **Hybrid** - Use Docker with external Neo4j via `NEO4J_URI`

---

## [0.5.1] - 2025-12-14

### Fixes

- **Windows setup.ps1** - Fixed Node.js winget installation by trying multiple package IDs
- **Windows setup.ps1** - Simplified Neo4j install to open download page directly (not reliably in winget)
- **setup.sh** - Removed git hooks installation (not needed for end users)

---

## [0.5.0] - 2025-12-14

Simplified installation by embedding core plugins directly in the repository.

### Breaking Changes

- **Plugins are now embedded** - The wallet, verify, and ascii plugins are no longer git submodules. They are now part of the core codebase.

### Changes

#### Plugin Architecture
- **Removed git submodules** - Plugins are now regular directories tracked in the main repo
- **Consolidated dependencies** - Wallet plugin dependencies moved to root `package.json`
- **Empty plugins manifest** - `plugins/manifest.json` cleared for future third-party plugins
- **Updated .gitignore** - Core plugins are now tracked, third-party plugins still ignored

#### Update Script
- **Improved stash handling** - More robust auto-stash with fallback for edge cases
- **Removed submodule step** - No longer runs `git submodule update`

#### Windows Support
- **setup.ps1** - PowerShell setup script for Windows users
- **update.ps1** - PowerShell update script for Windows users
- **run.ps1** - PowerShell run script for Windows users

#### Auto-Install Dependencies
- **Node.js auto-install** - Setup scripts prompt to install Node.js if missing
  - macOS: via Homebrew
  - Linux: via NodeSource (Debian/Ubuntu, RHEL/Fedora, Arch)
  - Windows: via winget or browser download
- **Neo4j auto-install** - Setup scripts prompt to install Neo4j if missing
  - macOS: via Homebrew
  - Linux: via official Neo4j repositories
  - Windows: via winget or Neo4j Desktop download
- **OS detection** - Bash script detects macOS, Debian, RHEL, and Arch Linux

### Migration Notes

For existing installations with submodule issues:
1. Run `git submodule deinit -f plugins/void-plugin-*`
2. Run `rm -rf .git/modules/plugins`
3. Delete and re-clone the plugins directories
4. Run `./update.sh` to pull the new version

New installations just need to run `./setup.sh` as usual.

---

## [0.4.3] - 2025-12-14

Improved error handling when Neo4j is not installed or running.

### Improvements

- **Neo4j Error Messages** - User-friendly error messages when Neo4j connection fails:
  - `NOT_RUNNING` - Neo4j service not started
  - `AUTH_FAILED` - Invalid credentials
  - `DB_NOT_FOUND` - Database doesn't exist
  - Each error includes specific help tips for resolution

### UI Improvements

- **Memory Page Banner** - Enhanced Neo4j status banner shows detailed error information:
  - Specific error message and description
  - Bullet list of troubleshooting steps
  - Links to documentation

### Changes

- `getNeo4jStatus()` is now async with full connection attempt
- Added `parseConnectionError()` for error classification
- Added `tryConnect()` and `getFullStatus()` methods to Neo4jService

---

## [0.4.2] - 2025-12-14

Documentation and LM Studio integration improvements.

### New Features

#### LM Studio CLI Integration
- **Model Detection** - Automatically detect available LM Studio models via `lms` CLI
- **Embedding Status API** - New endpoints for checking embedding model availability:
  - `GET /api/memories/embedding/status` - Full embedding service status
  - `GET /api/memories/embedding/models` - Available embedding models
  - `GET /api/memories/lmstudio/models` - All downloaded and loaded models
- **Smart Recommendations** - System suggests actions if models are missing or not loaded

### Changes

- **Default Deep Model** - LM Studio now defaults to `openai/gpt-oss-20b` for deep model
- **Embedding Model** - Default embedding model set to `text-embedding-nomic-embed-text-v1.5`

### UI Improvements

- **Memory Search** - Moved search icon to right side of input for cleaner layout

### New Files

- `server/services/lmstudio-cli.js` - LM Studio CLI wrapper for model detection

### Documentation

- **CHAT.md** - Comprehensive guide for setting up the local chat and memory system:
  - LM Studio installation and model recommendations
  - Neo4j setup (Desktop, Homebrew, Docker)
  - Void Server configuration
  - Creating custom egregore personas
  - Memory categories and architecture overview
  - Troubleshooting guide
  - Added chat page screenshot

- **MEMORIES.md** - Complete documentation for the memory management system:
  - Memory structure and categories
  - Page features (Memories, Maintenance, Visualization tabs)
  - Creating and retrieving memories
  - REST API reference with examples
  - Backup and restore procedures
  - Added memories page screenshot

---

## [0.4.1] - 2025-12-14

Plugin dependency isolation and wallet bug fix.

### Bug Fixes

- **Wallet Plugin** - Fixed `bs58.encode is not a function` error caused by bs58 v6 CJS export changes

### Improvements

#### Plugin Dependency Isolation
- **Per-plugin node_modules** - Each plugin now manages its own dependencies independently
- **setup.sh** - Now installs dependencies for each plugin with a `package.json`
- **update.sh** - Now updates plugin dependencies when running updates
- **Cleaner parent package.json** - Removed wallet-specific dependencies (`@solana/*`, `bip39`, `ed25519-hd-key`, `tweetnacl`, `bs58`)

### Migration Notes

- Run `./setup.sh` to install plugin dependencies (automatic for new installs)
- Existing installs: run `npm install` in each plugin directory, or re-run `./setup.sh`

---

## [0.4.0] - 2025-12-14

A major release introducing the Neo4j-powered memory system, chat interface, and prompt management.

### New Features

#### Memory System (Neo4j)
- **Neo4j Integration** - Graph database for storing and querying memories with relationships
- **Memory CRUD** - Create, read, update, delete memories via REST API
- **Graph Visualization** - Interactive 3D visualization of memory connections using Three.js
- **Memory Categories** - Organize memories by category (emergence, liminal, quantum, glitch, void, economic, social)
- **Auto-categorization** - Automatic category and tag extraction from content
- **Memory Search** - Full-text search and filtering by category, stage, importance
- **Memory Statistics** - Dashboard showing counts by category and stage
- **Related Memories** - Graph traversal to find connected memories
- **Maintenance Tools** - Bulk delete, smart connect, and auto-fix suggestions

#### Chat System
- **Chat Interface** - Full-featured chat page with conversation history
- **AI Provider Integration** - Connect to configured AI providers for responses
- **Prompt Templates** - Use customizable templates for AI interactions
- **Memory Context** - Inject relevant memories into chat prompts
- **Conversation Persistence** - Save and load chat sessions
- **Message History** - Scroll through previous messages with timestamps

#### Prompt Management
- **Templates Page** - Create and manage reusable prompt templates
- **Variables Page** - Define variables for dynamic prompt substitution
- **Template Categories** - Organize templates by type (chat, content, utility)
- **Variable Types** - Support for text, select, and dynamic variables
- **Live Preview** - See rendered templates with variable substitution

#### Backup System
- **Database Backup** - Export Neo4j memories and users to JSON
- **Scheduled Backups** - Configure hourly, daily, or weekly auto-backups
- **Backup Management** - List, download, and delete backup files
- **WebSocket Status** - Real-time backup progress notifications

#### Settings Improvements
- **Theme Selection** - Visual theme picker with color previews (Clawed, Green, Gray)
- **Theme Cards** - See primary, secondary, and surface colors before selecting

### UI/UX Improvements

#### Navigation
- **Settings in Footer** - Moved settings button to nav footer for cleaner navigation
- **Prompts Folder** - Grouped Templates and Variables under collapsible "Prompts" section
- **Collapsed Nav** - Settings button visible when sidebar is collapsed
- **Theme Toggle** - Only shows when sidebar is expanded

#### Memories Page
- **Search Input Fix** - Proper flex layout so search isn't crushed by category dropdown
- **Category Stats** - Clickable category cards to filter memories
- **Tab Navigation** - Switch between Memories, Maintenance, and Visualization tabs

### Developer Experience

#### Setup & Scripts
- **Git Submodule Init** - `setup.sh` now initializes plugin submodules automatically
- **Neo4j Detection** - Setup script checks for Neo4j installation with helpful install instructions
- **`run.sh`** - Simple script to start/restart PM2 services
- **`update.sh`** - Pull latest code, update dependencies, and restart services

#### New API Endpoints

**Memories API** (`/api/memories`)
- `GET /` - List all memories with stats
- `GET /search?q=` - Full-text search
- `GET /filter` - Advanced filtering
- `GET /stats` - Statistics by category/stage
- `GET /graph` - Graph data for visualization
- `GET /context` - Get relevant memories for chat
- `GET /:id` - Get single memory
- `GET /:id/related` - Find related memories
- `POST /` - Create memory
- `PUT /:id` - Update memory
- `DELETE /:id` - Delete memory
- `POST /:id/access` - Track memory access
- `POST /sync` - Sync to Neo4j
- `GET /maintenance/all` - Maintenance data
- `POST /maintenance/bulk-delete` - Bulk delete
- `POST /maintenance/smart-connect` - Create connections
- `POST /maintenance/auto-fix/preview` - Preview fixes
- `POST /maintenance/auto-fix/apply` - Apply fixes

**Chat API** (`/api/chat`)
- `GET /sessions` - List chat sessions
- `GET /sessions/:id` - Get session with messages
- `POST /sessions` - Create session
- `DELETE /sessions/:id` - Delete session
- `POST /sessions/:id/messages` - Send message

**Prompts API** (`/api/prompts`)
- `GET /templates` - List templates
- `POST /templates` - Create template
- `PUT /templates/:id` - Update template
- `DELETE /templates/:id` - Delete template
- `GET /variables` - List variables
- `POST /variables` - Create variable
- `PUT /variables/:id` - Update variable
- `DELETE /variables/:id` - Delete variable
- `POST /render` - Render template with variables

**Backup API** (`/api/backup`)
- `GET /status` - Backup service status
- `POST /create` - Create backup
- `GET /list` - List backups
- `GET /download/:filename` - Download backup
- `DELETE /:filename` - Delete backup

### New Files

```
client/src/pages/
├── ChatPage.jsx          # Chat interface (601 lines)
├── MemoriesPage.jsx      # Memory management (1920 lines)
├── TemplatesPage.jsx     # Prompt templates (522 lines)
└── VariablesPage.jsx     # Prompt variables (454 lines)

server/services/
├── neo4j-service.js      # Neo4j connection & queries (451 lines)
├── memory-service.js     # Memory CRUD operations (756 lines)
├── memory-query-service.js # Context retrieval (355 lines)
├── embedding-service.js  # LM Studio embeddings (225 lines)
├── chat-service.js       # Chat session management (303 lines)
├── prompt-service.js     # Template/variable management (443 lines)
├── prompt-executor.js    # Template rendering (285 lines)
└── backup-service.js     # Backup operations (470 lines)

server/routes/
├── memories.js           # Memory API (308 lines)
├── chat.js               # Chat API (176 lines)
├── prompts.js            # Prompts API (220 lines)
└── backup.js             # Backup API (57 lines)

server/utils/
└── broadcast.js          # WebSocket broadcast utility (20 lines)

config/prompts/
├── templates.json        # Default prompt templates
├── variables.json        # Default variables
└── chats/.gitkeep        # Chat history directory

run.sh                    # Start script
update.sh                 # Update script
PLAN.md                   # Development plan
```

### Dependencies Added

- `neo4j-driver` - Neo4j database driver

### Configuration

#### Environment Variables (Optional)
```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
```

### Breaking Changes

None - this release is backward compatible.

### Migration Notes

- Run `./setup.sh` to initialize git submodules if upgrading from 0.3.x
- Neo4j is optional - app works without it, memory features will be disabled
- Chat history is stored locally in `config/prompts/chats/` (gitignored)

---

## [0.3.1] - Previous Release

See previous changelog entries.
