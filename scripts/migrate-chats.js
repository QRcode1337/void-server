#!/usr/bin/env node
/**
 * Migration script for chat data
 * Moves chats from legacy location (config/prompts/chats) to new location (data/chats)
 *
 * Usage: node scripts/migrate-chats.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const CHATS_DIR = path.resolve(__dirname, '../data/chats');
const LEGACY_CHATS_DIR = path.resolve(__dirname, '../config/prompts/chats');

const dryRun = process.argv.includes('--dry-run');

console.log('Chat Migration Script');
console.log('=====================');
console.log(`Legacy location: ${LEGACY_CHATS_DIR}`);
console.log(`New location: ${CHATS_DIR}`);
console.log(`Dry run: ${dryRun}`);
console.log('');

// Ensure new directory exists
if (!dryRun && !fs.existsSync(CHATS_DIR)) {
  fs.mkdirSync(CHATS_DIR, { recursive: true });
  console.log(`Created directory: ${CHATS_DIR}`);
}

// Check legacy directory
if (!fs.existsSync(LEGACY_CHATS_DIR)) {
  console.log('No legacy chats directory found. Nothing to migrate.');
  process.exit(0);
}

// Get legacy chat files
const legacyFiles = fs.readdirSync(LEGACY_CHATS_DIR).filter(f => f.endsWith('.json'));

if (legacyFiles.length === 0) {
  console.log('No chat files found in legacy location. Nothing to migrate.');
  process.exit(0);
}

console.log(`Found ${legacyFiles.length} chat file(s) to migrate:`);

let migrated = 0;
let skipped = 0;

for (const file of legacyFiles) {
  const legacyPath = path.join(LEGACY_CHATS_DIR, file);
  const newPath = path.join(CHATS_DIR, file);

  // Check if already exists
  if (fs.existsSync(newPath)) {
    console.log(`  SKIP: ${file} (already exists in new location)`);
    skipped++;
    continue;
  }

  if (dryRun) {
    console.log(`  WOULD MIGRATE: ${file}`);
    migrated++;
  } else {
    // Copy to new location
    const data = fs.readFileSync(legacyPath, 'utf8');
    fs.writeFileSync(newPath, data);

    // Remove from legacy location
    fs.unlinkSync(legacyPath);

    console.log(`  MIGRATED: ${file}`);
    migrated++;
  }
}

console.log('');
console.log('Summary:');
console.log(`  Migrated: ${migrated}`);
console.log(`  Skipped: ${skipped}`);

if (dryRun && migrated > 0) {
  console.log('');
  console.log('Run without --dry-run to perform the migration.');
}
