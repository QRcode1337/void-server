# Data Directory

All user-specific data must be stored in the `./data/` directory. This is the single source of truth for user configuration and persistent data, introduced in v0.8.0.

## Benefits

- **Simple Docker mounting**: Single volume mount (`-v ./data:/app/data`)
- **Easy backups**: Copy one directory to backup everything
- **Clean separation**: Code and user data don't mix

## Directory Structure

```
data/
├── chats/              # Chat history and conversations
├── browsers/           # Browser profile configurations
├── prompts/            # Prompt templates and variables
├── memories/           # Memory system JSON files
├── wallets/            # Wallet plugin data
├── backups/            # Neo4j database backups
├── video-downloads/    # Video download plugin data
├── ai-providers.json   # AI provider configuration
├── neo4j.json          # Neo4j connection settings
├── backup.json         # Backup configuration
└── backup-history.json # Backup history log
```

## For Plugin Developers

Plugins should store user data in `data/<plugin-name>/`, NOT inside the plugin directory.

### Example

```javascript
// server/index.js
const path = require('path');
const fs = require('fs');

module.exports = (app, config = {}) => {
  // Use main app data directory
  const DATA_DIR = path.join(__dirname, '../../../data/my-plugin');

  // Create on demand when writing
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Now use DATA_DIR for all persistent storage
  const settingsPath = path.join(DATA_DIR, 'settings.json');
  // ...
};
```

### Migration Pattern

If your plugin previously stored data inside its own directory, add automatic migration:

```javascript
const LEGACY_DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = path.join(__dirname, '../../../data/my-plugin');

// Migrate on load if needed
if (fs.existsSync(LEGACY_DATA_DIR) && !fs.existsSync(DATA_DIR)) {
  fs.cpSync(LEGACY_DATA_DIR, DATA_DIR, { recursive: true });
  fs.rmSync(LEGACY_DATA_DIR, { recursive: true, force: true });
  console.log(`Migrated data to data/my-plugin/`);
}
```

## Migration from v0.7.x

When updating from v0.7.x, services automatically migrate data on first load. You can also run the migration script manually:

```bash
# Preview what will be migrated
node scripts/migrate-data.js --dry-run

# Execute migration
node scripts/migrate-data.js
```

The script migrates:
- `config/prompts/chats/` → `data/chats/`
- `config/browsers/` → `data/browsers/`
- `config/memories/` → `data/memories/`
- `config/prompts/*.json` → `data/prompts/`
- `config/*.json` → `data/`
- `backups/` → `data/backups/`
- Plugin data directories → `data/<plugin-name>/`
