# Changelog

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
