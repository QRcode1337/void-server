#!/usr/bin/env node
/**
 * Comprehensive Migration Script for v0.8.0
 *
 * Moves all user data from legacy locations to the centralized data/ directory
 * This simplifies Docker volume mounting and backup procedures.
 *
 * Usage: node scripts/migrate-data.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');

const dryRun = process.argv.includes('--dry-run');

// Migration definitions: [legacyPath, newPath, type]
const MIGRATIONS = [
  // Chats
  {
    name: 'Chats',
    legacy: path.join(CONFIG_DIR, 'prompts/chats'),
    target: path.join(DATA_DIR, 'chats'),
    type: 'directory'
  },
  // Browsers
  {
    name: 'Browsers',
    legacy: path.join(CONFIG_DIR, 'browsers'),
    target: path.join(DATA_DIR, 'browsers'),
    type: 'directory'
  },
  // Memories
  {
    name: 'Memories',
    legacy: path.join(CONFIG_DIR, 'memories'),
    target: path.join(DATA_DIR, 'memories'),
    type: 'directory'
  },
  // Prompt Templates
  {
    name: 'Prompt Templates',
    legacy: path.join(CONFIG_DIR, 'prompts/templates.json'),
    target: path.join(DATA_DIR, 'prompts/templates.json'),
    type: 'file'
  },
  // Prompt Variables
  {
    name: 'Prompt Variables',
    legacy: path.join(CONFIG_DIR, 'prompts/variables.json'),
    target: path.join(DATA_DIR, 'prompts/variables.json'),
    type: 'file'
  },
  // AI Providers
  {
    name: 'AI Providers',
    legacy: path.join(CONFIG_DIR, 'ai-providers.json'),
    target: path.join(DATA_DIR, 'ai-providers.json'),
    type: 'file'
  },
  // Neo4j Config
  {
    name: 'Neo4j Config',
    legacy: path.join(CONFIG_DIR, 'neo4j.json'),
    target: path.join(DATA_DIR, 'neo4j.json'),
    type: 'file'
  },
  // Backup Config
  {
    name: 'Backup Config',
    legacy: path.join(CONFIG_DIR, 'backup.json'),
    target: path.join(DATA_DIR, 'backup.json'),
    type: 'file'
  },
  // Backup History
  {
    name: 'Backup History',
    legacy: path.join(CONFIG_DIR, 'backup-history.json'),
    target: path.join(DATA_DIR, 'backup-history.json'),
    type: 'file'
  },
  // Backups Directory
  {
    name: 'Backups',
    legacy: path.join(ROOT_DIR, 'backups'),
    target: path.join(DATA_DIR, 'backups'),
    type: 'directory'
  },
  // Wallet Data (from plugin)
  {
    name: 'Wallet Data',
    legacy: path.join(ROOT_DIR, 'plugins/void-plugin-wallet/data'),
    target: path.join(DATA_DIR, 'wallets'),
    type: 'directory'
  },
  // Video Downloads (from plugin)
  {
    name: 'Video Downloads',
    legacy: path.join(ROOT_DIR, 'plugins/void-plugin-videodownload/data/videos'),
    target: path.join(DATA_DIR, 'video-downloads'),
    type: 'directory'
  }
];

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           void-server v0.8.0 Data Migration                ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Data directory: ${DATA_DIR}`);
console.log(`Dry run: ${dryRun}`);
console.log('');

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Remove directory recursively
 */
function removeDir(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }

  fs.rmdirSync(dir);
}

/**
 * Count files in directory
 */
function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;

  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }

  return count;
}

// Track results
const results = {
  migrated: [],
  skipped: [],
  notFound: []
};

// Ensure data directory exists
if (!dryRun && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Created: ${DATA_DIR}`);
}

// Process each migration
for (const migration of MIGRATIONS) {
  const { name, legacy, target, type } = migration;

  console.log(`\n${name}:`);
  console.log(`  Legacy: ${path.relative(ROOT_DIR, legacy)}`);
  console.log(`  Target: ${path.relative(ROOT_DIR, target)}`);

  // Check if legacy exists
  if (!fs.existsSync(legacy)) {
    console.log(`  Status: Not found (nothing to migrate)`);
    results.notFound.push(name);
    continue;
  }

  // Check if target already exists
  if (fs.existsSync(target)) {
    const targetFiles = type === 'directory' ? countFiles(target) : 1;
    console.log(`  Status: SKIPPED (target already exists with ${targetFiles} file(s))`);
    results.skipped.push(name);
    continue;
  }

  // Ensure target parent directory exists
  const targetDir = type === 'file' ? path.dirname(target) : target;
  if (!dryRun && !fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (type === 'directory') {
    const fileCount = countFiles(legacy);

    if (dryRun) {
      console.log(`  Status: WOULD MIGRATE (${fileCount} file(s))`);
    } else {
      copyDir(legacy, target);
      removeDir(legacy);
      console.log(`  Status: MIGRATED (${fileCount} file(s))`);
    }

    results.migrated.push({ name, count: fileCount });
  } else {
    if (dryRun) {
      console.log(`  Status: WOULD MIGRATE`);
    } else {
      fs.copyFileSync(legacy, target);
      fs.unlinkSync(legacy);
      console.log(`  Status: MIGRATED`);
    }

    results.migrated.push({ name, count: 1 });
  }
}

// Summary
console.log('\n');
console.log('════════════════════════════════════════════════════════════');
console.log('                         Summary');
console.log('════════════════════════════════════════════════════════════');
console.log(`  Migrated: ${results.migrated.length} items`);
if (results.migrated.length > 0) {
  for (const item of results.migrated) {
    console.log(`    - ${item.name} (${item.count} file(s))`);
  }
}
console.log(`  Skipped: ${results.skipped.length} items (already exist)`);
console.log(`  Not found: ${results.notFound.length} items (no legacy data)`);

if (dryRun && results.migrated.length > 0) {
  console.log('\n');
  console.log('Run without --dry-run to perform the migration:');
  console.log('  node scripts/migrate-data.js');
}

console.log('');
