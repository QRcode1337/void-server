# Void Server

A modular, plugin-based creative platform for building and running your own sovereign tools. Extend it with plugins, customize it to your workflow, and engage with the void.

![Void Server Dashboard](screenshot.png)

## Quick Start

### 1. Install Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Run the app + all services | Required |
| [LM Studio](https://lmstudio.ai/) | GPU-accelerated local AI | Optional* |
| [Tailscale](https://tailscale.com/download) | Access from phone/anywhere | Optional |

*Ollama runs inside Docker for local AI. LM Studio is optional but recommended for better GPU inference on the host machine. If using LM Studio, download an embedding model (e.g., `nomic-embed-text`) and a chat model, then start the local server.

### 2. Run

**With git:**
```bash
git clone https://github.com/ClawedCode/void-server.git
cd void-server
docker-compose up -d
```

**Without git:**
```bash
curl -L https://github.com/ClawedCode/void-server/archive/refs/heads/main.zip -o void-server.zip
unzip void-server.zip && cd void-server-main
docker-compose up -d
```

### 3. Access

- **Local:** http://localhost:4420
- **Remote:** `http://<tailscale-ip>:4420` (if Tailscale installed)

That's it! Docker Compose starts both Void Server and Neo4j with persistent storage.

---

## More Options

### Docker Ports

Docker uses different ports to avoid conflicts with native installations:

| Service | Docker Port | Native Port |
|---------|-------------|-------------|
| App | 4420 | 4401 |
| Neo4j Browser | 4421 | 7474 |
| Neo4j Bolt | 4422 | 7687 |

**Manage Docker services:**
```bash
docker-compose logs -f      # View logs (Ctrl+C to exit)
docker-compose restart      # Restart services
docker-compose down         # Stop services
docker-compose up -d        # Start services
```

### Native Installation

For development or if you prefer running services directly on your machine.

```bash
git clone https://github.com/ClawedCode/void-server.git
cd void-server
./setup.sh
```

This installs dependencies, starts dev services with PM2, and configures auto-start.

Development defaults:

- API server: http://localhost:4401
- Client (Vite dev with HMR): http://localhost:4480

PM2 runs both: `void-server` (Express API) and `void-client` (Vite dev server). Use the Vite URL for the live-reload UI; API requests proxy to 4401.

**Manage native services:**
```bash
npm run status    # Check status
npm run logs      # View logs
npm run restart   # Restart
npm run stop      # Stop
```

## Docker Configuration

### Environment Variables

Customize your Docker deployment with environment variables:

```bash
# Custom Neo4j password
NEO4J_PASSWORD=mysecurepassword docker-compose up -d

# Or create a .env file
echo "NEO4J_PASSWORD=mysecurepassword" > .env
docker-compose up -d
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NEO4J_PASSWORD` | `voidserver` | Neo4j database password |
| `NEO4J_URI` | `bolt://neo4j:7687` | Neo4j connection URI |
| `OLLAMA_URL` | `http://ollama:11434/v1` | Ollama API endpoint |
| `OLLAMA_MODELS` | — | Comma-separated models to auto-pull |
| `EMBEDDING_PROVIDER` | `auto` | Embedding provider (`ollama`, `lmstudio`, `auto`) |
| `LM_STUDIO_URL` | `http://host.docker.internal:1234/v1` | LM Studio API endpoint (optional) |
| `BROWSER_NOVNC_PORT` | `6080` | Starting port for browser noVNC |
| `DOCKER_GID` | `0` | Docker group ID for socket access |

### Using External Services

To use an external Neo4j instance instead of the bundled one:

```bash
NEO4J_URI=bolt://your-server:7687 \
NEO4J_USER=neo4j \
NEO4J_PASSWORD=yourpassword \
docker-compose up -d void-server
```

### LM Studio Integration

If running [LM Studio](https://lmstudio.ai/) on your host machine, the Docker container automatically connects via `host.docker.internal`. Just start LM Studio's local server and it will be available to the containerized app.

### Persistent Data

Docker volumes preserve your data across restarts:

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./data` | `/app/data` | All user data (v0.8.0+) |
| `./logs` | `/app/logs` | Application logs |
| `neo4j_data` | Neo4j volume | Graph database |

All user configuration and data is stored in `./data/` for simple backup and migration. See [docs/DATA.md](docs/DATA.md) for details.

### Remote Access

Access your Void Server from your phone or anywhere using [Tailscale](https://tailscale.com/):

1. Install Tailscale on your server and phone
2. Sign in with the same account
3. Access via Tailscale IP: `http://100.x.y.z:4420` (Docker) or `http://100.x.y.z:4401` (native)

See [docs/REMOTE-ACCESS.md](docs/REMOTE-ACCESS.md) for detailed setup instructions.

## Features

- **Plugin System** - Install, enable/disable, and configure plugins via UI or CLI
- **Git Submodule Support** - Manage plugins as git submodules for reproducible builds
- **Real-time Logs** - WebSocket-powered server log viewer in the browser
- **Dynamic Navigation** - Automatically builds nav from installed plugins
- **Security Hooks** - Pre-commit scanning for secrets

## Documentation

| Guide | Description |
|-------|-------------|
| [Contributing](CONTRIBUTING.md) | How to contribute, PR process |
| [Style Guide](docs/STYLE-GUIDE.md) | Code conventions, logging format, icons |
| [Plugin Development](docs/PLUGINS.md) | Plugin structure, manifest, data storage |
| [Theme System](docs/THEME.md) | CSS variables, Tailwind classes, styling |
| [Data Directory](docs/DATA.md) | User data storage, plugin data conventions |
| [Chat System](docs/CHAT.md) | AI chat configuration and usage |
| [Memories](docs/MEMORIES.md) | Neo4j memory system and knowledge graph |
| [Remote Access](docs/REMOTE-ACCESS.md) | Tailscale setup for mobile/remote access |
| [HTTP Client](docs/HTTP-CLIENT.md) | Server-side HTTP request utilities |

## Ports

| Service | Docker | Native |
|---------|--------|--------|
| App | 4420 | 4401 |
| Neo4j Browser | 4421 | 7474 |
| Neo4j Bolt | 4422 | 7687 |
| IPFS API | 4423 | 5001 |
| IPFS Gateway | 4424 | 8080 |
| Ollama | 4425 | 11434 |
| Browser (noVNC) | 6080+ | — |
| Client (dev) | — | 4480 |

## Commands

### Service Management

```bash
npm start            # Start services with PM2
npm run stop         # Stop services
npm run restart      # Restart services
npm run logs         # View logs (Ctrl+C to exit)
npm run status       # Check status
```

PM2 watches for file changes in `server/` and `plugins/` directories, automatically restarting the server when you edit code. The client uses Vite's built-in HMR for instant updates.

### Plugin Management

```bash
npm run plugin:status              # Show installed plugins
npm run plugin:add <git-url>       # Install plugin from git
npm run plugin:remove <name>       # Uninstall plugin
npm run plugin:update -- --all     # Update all plugins
```

## Plugin Development

**Zero-config plugin system** - add a plugin and restart, no core code changes needed.

```bash
# Add plugin, restart, done
git submodule add https://github.com/org/void-plugin-example.git plugins/void-plugin-example
npm run restart
```

See [docs/PLUGINS.md](docs/PLUGINS.md) for complete plugin development guide including manifest format, client/server structure, and data storage.

### Development Mode (Symlinks)

For local development, symlink plugins to sibling repos:

```bash
./scripts/plugin-dev-setup.sh
```

### Production Mode (Submodules)

For deployment, install plugins as git submodules:

```bash
npm run plugin:add https://github.com/org/void-plugin-example.git
```

## Configuration

Environment variables (`.env` file supported):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4401` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j connection URI |
| `NEO4J_USER` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | `voidserver` | Neo4j password |
| `NEO4J_DATABASE` | `neo4j` | Neo4j database name |
| `LM_STUDIO_URL` | `http://localhost:1234/v1` | LM Studio API endpoint |

All user data and configuration is stored in `./data/`. See [docs/DATA.md](docs/DATA.md) for the full directory structure.

## Architecture

```
    ┌──────────┐          ┌──────────┐
    │  Phone   │          │ Computer │
    │  Browser │          │ Browser  │
    └────┬─────┘          └────┬─────┘
         │                     │
         │    Tailscale VPN    │
         │   (100.x.y.z:4420)  │
         └──────────┬──────────┘
                    │
                    │  or localhost:4420
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Docker Compose Stack                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         void-server (:4420)                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐   │    │
│  │  │   Express   │  │   React     │  │   Plugins   │  │  WebSocket│   │    │
│  │  │   API       │  │   Client    │  │   System    │  │  Logs     │   │    │
│  │  └──────┬──────┘  └─────────────┘  └─────────────┘  └───────────┘   │    │
│  │         │                                                           │    │
│  │         ├── Chat Service ──┬── Memory Service ──┬── Browser Mgr ─┐  │    │
│  │         │                  │                    │                │  │    │
│  │         ▼                  ▼                    ▼                │  │    │
│  │  ┌───────────┐      ┌───────────┐        ┌──────────┐       Docker  │    │
│  │  │   IPFS    │      │ Embeddings│        │  Graph   │       Socket  │    │
│  │  │  Service  │      │   (LLM)   │        │ Queries  │         │     │    │
│  │  └─────┬─────┘      └─────┬─────┘        └────┬─────┘         │     │    │
│  └────────┼──────────────────┼───────────────────┼───────────────┼─────┘    │
│           │                  │                   │               │          │
│           ▼                  │                   ▼               │          │
│  ┌─────────────────┐         │         ┌─────────────────┐       │          │
│  │   ipfs (:4423)  │         │         │ neo4j (:4421)   │       │          │
│  │  ┌───────────┐  │         │         │  ┌───────────┐  │       │          │
│  │  │   Kubo    │  │         │         │  │   Graph   │  │       │          │
│  │  │   Node    │  │         │         │  │  Database │  │       │          │
│  │  ├───────────┤  │         │         │  ├───────────┤  │       │          │
│  │  │  Gateway  │  │         │         │  │  Bolt     │  │       │          │
│  │  │  (:4424)  │  │         │         │  │  (:4422)  │  │       │          │
│  │  └───────────┘  │         │         │  └───────────┘  │       │          │
│  │  ipfs_data vol  │         │         │  neo4j_data vol │       │          │
│  └─────────────────┘         │         └─────────────────┘       │          │
│           ┌──────────────────┤                                   │          │
│           │                  ▼                                   ▼          │
│  ┌────────▼────────┐  ┌─────────────────┐  ┌───────────────────────────┐    │
│  │ ollama (:4425)  │  │ LM Studio       │  │    Browser Containers     │    │
│  │  ┌───────────┐  │  │ (optional)      │  │  ┌─────────────────────┐  │    │
│  │  │ Chat Model│  │  │                 │  │  │   void-browser-1    │  │    │
│  │  │ (llama3,  │  │  │ via host.docker │  │  │     noVNC:6080      │  │    │
│  │  │  qwen2)   │  │  │ .internal:1234  │  │  ├─────────────────────┤  │    │
│  │  ├───────────┤  │  │                 │  │  │   void-browser-2    │  │    │
│  │  │ Embedding │  │  │ Preferred for   │  │  │     noVNC:6081      │  │    │
│  │  │ (nomic,   │  │  │ GPU inference   │  │  ├─────────────────────┤  │    │
│  │  │  mxbai)   │  │  │                 │  │  │        ...          │  │    │
│  │  └───────────┘  │  └────────┬────────┘  │  └─────────────────────┘  │    │
│  │ ollama_data vol │           │           │  Spawned via Docker API   │    │
│  └─────────────────┘           │           └───────────────────────────┘    │
│                                │                                            │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │
                   host.docker.internal
                                 │
                                 ▼
                   ┌─────────────────────────┐
                   │   LM Studio (:1234)     │
                   │  ┌───────────────────┐  │
                   │  │   Chat Model      │  │
                   │  │   (Qwen, Llama)   │  │
                   │  ├───────────────────┤  │
                   │  │  Embedding Model  │  │
                   │  │  (nomic-embed)    │  │
                   │  └───────────────────┘  │
                   │                         │
                   │   Runs on Host Machine  │
                   │   (Optional - for GPU)  │
                   └─────────────────────────┘
```

### Port Reference

| Service | Docker | Native | Purpose |
|---------|--------|--------|---------|
| Void Server | 4420 | 4401 | Main application |
| Neo4j Browser | 4421 | 7474 | Database admin UI |
| Neo4j Bolt | 4422 | 7687 | Database connection |
| IPFS API | 4423 | 5001 | IPFS node API |
| IPFS Gateway | 4424 | 8080 | Content gateway |
| Ollama | 4425 | 11434 | Local AI inference |
| Browser (noVNC) | 6080+ | — | Remote browser access |
| Vite (dev) | — | 4480 | HMR dev server |
| LM Studio | 1234 | 1234 | AI inference (optional) |

### Data Flow

1. **Chat** → User message → Prompt template + Memory context → Ollama/LM Studio → Response
2. **Memory** → Extract entities → Generate embeddings → Store in Neo4j graph
3. **IPFS** → Pin content locally → Announce to DHT → Optionally replicate to Pinata
4. **Browser** → Plugin requests browser → Spawn container via Docker API → noVNC stream to UI

## Project Structure

```
void-server/
├── client/                 # React frontend (Vite + Tailwind)
├── server/
│   ├── index.js           # Express server + API
│   └── plugins.js         # Plugin management module
├── plugins/
│   ├── manifest.json      # Available plugins catalog
│   └── void-plugin-*/     # Installed plugins
├── scripts/               # CLI utilities
├── data/                  # User data & configuration (v0.8.0+)
├── docs/                  # Documentation
└── setup.sh               # One-command setup
```

## License

MIT
