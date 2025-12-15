# Plugins

Zero-config plugin system. Add a plugin, restart, done.

## Quick Start

```bash
# Add a plugin
git submodule add https://github.com/org/void-plugin-example.git plugins/void-plugin-example

# Restart server
npm run restart

# Done! Plugin appears in navigation automatically
```

## Directory Structure

```
plugins/
├── README.md
├── manifest.json         # Available plugins catalog
└── void-plugin-*/        # Installed plugins
```

## How It Works

1. Server scans `plugins/` for directories with `server/index.js`
2. Each plugin is loaded and mounted at its configured path
3. Navigation is built dynamically from installed plugins
4. The universal PluginViewer renders plugin API responses

No core code changes required to add new plugins.

## Plugin Structure

A minimal plugin needs:

```
void-plugin-example/
├── server/
│   └── index.js          # Express routes (required)
└── manifest.json         # Plugin metadata (optional)
```

### server/index.js

```javascript
module.exports = (app, config = {}) => {
  const mountPath = config.mountPath || '/example';

  app.get(`${mountPath}/`, (req, res) => {
    res.json({ message: 'Hello from plugin!' });
  });
};
```

### manifest.json

```json
{
  "name": "void-plugin-example",
  "version": "1.0.0",
  "minServerVersion": "0.7.0",
  "description": "Example plugin",
  "defaultMountPath": "/example",
  "nav": {
    "section": null,
    "title": "Example",
    "icon": "box"
  }
}
```

**Manifest fields:**
- `minServerVersion` - Minimum void-server version required (semver, e.g., "0.7.0")

**Nav options:**
- `section: null` - Standalone nav item (top level)
- `section: "Tools"` - Grouped under "Tools" section
- `icon` - Any [Lucide icon](https://lucide.dev/icons) name (e.g., "terminal", "shield", "box")

## Managing Plugins

```bash
npm run plugin:status              # Show installed plugins
npm run plugin:add <git-url>       # Install plugin
npm run plugin:remove <name>       # Uninstall plugin
npm run plugin:update -- --all     # Update all plugins
```

## Development Mode

For local development, symlink plugins to sibling repos:

```bash
./scripts/plugin-dev-setup.sh
```

This auto-detects `void-plugin-*` directories in the parent folder and creates symlinks.

## Configuration

Plugin settings are stored in `config/plugins.json`:

```json
{
  "void-plugin-example": {
    "enabled": true,
    "mountPath": "/example",
    "navConfig": {
      "navSection": null,
      "navTitle": "Example",
      "navIcon": "box"
    }
  }
}
```

Configure via the Plugin Manager UI at `/plugins`.

## Theme Compliance

**All plugins must use CSS variables for colors.** This ensures plugins adapt to theme changes.

### Required: Use CSS Variables

```jsx
// GOOD - theme-aware styling
<div style={{ backgroundColor: 'var(--color-surface)' }}>
<input style={{
  backgroundColor: 'var(--color-background)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)'
}} />
<button className="btn btn-primary">Action</button>
<span className="text-primary">Accent text</span>
```

### Forbidden: Hardcoded Colors

```jsx
// BAD - breaks theme switching
style={{ backgroundColor: 'rgba(0, 50, 30, 0.3)' }}
style={{ color: '#33ff33' }}
className="text-green-400"
```

### Available CSS Variables

| Variable | Purpose |
|----------|---------|
| `--color-background` | Page background |
| `--color-surface` | Card/panel background |
| `--color-border` | Borders |
| `--color-primary` | Theme accent color |
| `--color-text-primary` | Main text |
| `--color-text-secondary` | Muted text |
| `--color-success` | Success states (always green) |
| `--color-error` | Error states (always red) |
| `--color-warning` | Warning states (always orange) |
| `--color-info` | Info states (always blue) |

### Tailwind Classes

```jsx
className="text-primary"        // Theme accent
className="text-text-primary"   // Main text
className="text-secondary"      // Muted text
className="bg-surface"          // Card background
className="border-border"       // Standard border
className="btn btn-primary"     // Primary button
className="card"                // Card container
className="form-input"          // Input fields
```

See `CLAUDE.md` for complete theme documentation.
