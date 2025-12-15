# Changelog

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
