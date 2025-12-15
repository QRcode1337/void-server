# Void Server

A modular, plugin-based creative platform for building and running your own sovereign tools. Extend it with plugins, customize it to your workflow, and engage with the void.

![Void Server Dashboard](screenshot.png)

## Quick Start

Choose your preferred installation method:

### Option 1: Docker (Recommended)

The easiest way to run Void Server with all dependencies included.

**Prerequisites:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for your platform (macOS, Windows, or Linux).

```bash
git clone https://github.com/ClawedCode/void-server.git
cd void-server
docker-compose up -d
```

That's it! Access the app at **http://localhost:4420**

Docker Compose starts both Void Server and Neo4j (for the memory system) with persistent storage. Docker uses different ports to avoid conflicts with native installations:

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

### Option 2: Native Installation

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
| `LM_STUDIO_URL` | `http://host.docker.internal:1234/v1` | LM Studio API endpoint |

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
| `./config` | `/app/config` | App configuration |
| `./backups` | `/app/backups` | Database backups |
| `./logs` | `/app/logs` | Application logs |
| `./data` | `/app/data` | General data |
| `neo4j_data` | Neo4j volume | Graph database |

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

## Ports

| Service | Port |
|---------|------|
| Server  | 4401 |
| Client (dev) | 4480 |

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

See [docs/THEME.md](docs/THEME.md) for theme system documentation (CSS variables, Tailwind classes, styling guidelines).

```bash
# Add plugin, restart, done
git submodule add https://github.com/org/void-plugin-example.git plugins/void-plugin-example
npm run restart
```

Plugins are loaded from `plugins/` and must export a function:

```javascript
// plugins/void-plugin-example/server/index.js
module.exports = (app, config = {}) => {
  const { mountPath = '/example' } = config;
  app.get(`${mountPath}/hello`, (req, res) => {
    res.json({ message: 'Hello from plugin!' });
  });
};
```

Plugins should include a `manifest.json`:

```json
{
  "name": "void-plugin-example",
  "version": "1.0.0",
  "description": "Example plugin",
  "defaultMountPath": "/example",
  "nav": {
    "section": "Plugins",
    "title": "Example",
    "icon": "box"
  }
}
```

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
| `NEO4J_PASSWORD` | `clawedcode` | Neo4j password |
| `NEO4J_DATABASE` | `neo4j` | Neo4j database name |
| `LM_STUDIO_URL` | `http://localhost:1234/v1` | LM Studio API endpoint |

Plugin configurations are stored in `config/plugins.json`.
AI provider settings are stored in `config/ai-providers.json`.

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
├── config/                # Runtime configuration
└── setup.sh               # One-command setup
```

## License

MIT
