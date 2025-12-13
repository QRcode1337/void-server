# Void Server

A modular, plugin-based creative platform for building and running your own sovereign tools. Extend it with plugins, customize it to your workflow, and engage with the void.

## Quick Start

```bash
git clone https://github.com/ClawedCode/void-server.git
cd void-server
./setup.sh
```

This installs dependencies, builds the client, starts services with PM2, and configures auto-start.

Open http://localhost:4401 in your browser.

**Manage services:**
```bash
npm run status    # Check status
npm run logs      # View logs
npm run restart   # Restart
npm run stop      # Stop
```

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
| `PORT` | 4401 | Server port |
| `CONTENT_DIR` | `../content` | Content directory path |
| `NODE_ENV` | development | Environment mode |

Plugin configurations are stored in `config/plugins.json`.

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
