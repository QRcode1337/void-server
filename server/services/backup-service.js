/**
 * Database Backup Service
 *
 * Manages automated Neo4j database backups with scheduling
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const EventEmitter = require('events');
const { broadcast } = require('../utils/broadcast');
const { Neo4jService } = require('./neo4j-service');

class BackupService extends EventEmitter {
  constructor() {
    super();

    this.configDir = path.join(__dirname, '../../data');
    this.legacyConfigDir = path.join(__dirname, '../../config');
    this.legacyBackupsDir = path.join(__dirname, '../../backups');
    this.configFile = path.join(this.configDir, 'backup.json');
    this.historyFile = path.join(this.configDir, 'backup-history.json');

    this.config = null;
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
    this.scheduleInterval = null;
    this.initialized = false;
  }

  migrateFromLegacy() {
    // Migrate backup.json
    const legacyConfigFile = path.join(this.legacyConfigDir, 'backup.json');
    if (fsSync.existsSync(legacyConfigFile) && !fsSync.existsSync(this.configFile)) {
      fsSync.copyFileSync(legacyConfigFile, this.configFile);
      fsSync.unlinkSync(legacyConfigFile);
      console.log('📦 Migrated backup.json from config/ to data/');
    }

    // Migrate backup-history.json
    const legacyHistoryFile = path.join(this.legacyConfigDir, 'backup-history.json');
    if (fsSync.existsSync(legacyHistoryFile) && !fsSync.existsSync(this.historyFile)) {
      fsSync.copyFileSync(legacyHistoryFile, this.historyFile);
      fsSync.unlinkSync(legacyHistoryFile);
      console.log('📦 Migrated backup-history.json from config/ to data/');
    }

    // Migrate backups folder
    const newBackupsDir = path.join(this.configDir, 'backups');
    if (fsSync.existsSync(this.legacyBackupsDir) && !fsSync.existsSync(newBackupsDir)) {
      fsSync.cpSync(this.legacyBackupsDir, newBackupsDir, { recursive: true });
      fsSync.rmSync(this.legacyBackupsDir, { recursive: true });
      console.log('📦 Migrated backups/ to data/backups/');
    }
  }

  async initialize() {
    if (this.initialized) return;

    await fs.mkdir(this.configDir, { recursive: true });
    this.migrateFromLegacy();
    this.config = await this.loadConfig();

    this.initialized = true;
    this.log('Backup service initialized');
  }

  async loadConfig() {
    const defaultConfig = {
      enabled: false,
      schedule: 'daily',
      time: '02:00',
      backupPath: path.join(__dirname, '../../data/backups/neo4j'),
      retention: {
        keepDays: 7,
        archiveDays: 30
      },
      compression: {
        enabled: true,
        afterDays: 7
      }
    };

    const content = await fs.readFile(this.configFile, 'utf8').catch(() => null);
    if (!content) {
      await this.saveConfig(defaultConfig);
      return defaultConfig;
    }

    return { ...defaultConfig, ...JSON.parse(content) };
  }

  async saveConfig(config) {
    await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
    this.config = config;
    this.emit('config:updated', config);
  }

  async getStatus() {
    await this.initialize();

    const history = await this.getBackupHistory();
    const lastBackup = history.backups[0] || null;

    let backupDirSize = 0;
    let backupCount = 0;

    const backupDirExists = await fs.access(this.config.backupPath).then(() => true).catch(() => false);
    if (backupDirExists) {
      const files = await fs.readdir(this.config.backupPath);
      backupCount = files.filter(f => f.endsWith('.json') || f.endsWith('.json.gz')).length;

      const { stdout } = await execAsync(`du -sk "${this.config.backupPath}"`).catch(() => ({ stdout: '0' }));
      const sizeKB = parseInt(stdout.split('\t')[0]) || 0;
      backupDirSize = sizeKB * 1024;
    }

    return {
      success: true,
      enabled: this.config.enabled,
      running: this.isRunning,
      schedule: this.config.schedule,
      time: this.config.time,
      backupPath: this.config.backupPath,
      lastRun: this.lastRun || lastBackup?.timestamp || null,
      nextRun: this.nextRun,
      metrics: {
        totalBackups: backupCount,
        totalSize: backupDirSize,
        lastBackupSize: lastBackup?.size || 0,
        successCount: history.backups.filter(b => b.success).length,
        failCount: history.backups.filter(b => !b.success).length
      },
      lastBackup,
      config: this.config
    };
  }

  async toggle(enabled) {
    await this.initialize();

    this.config.enabled = enabled;
    await this.saveConfig(this.config);

    if (enabled) {
      await this.startSchedule();
    } else {
      await this.stopSchedule();
    }

    broadcast('backup:toggled', { enabled });

    return {
      success: true,
      enabled,
      message: enabled ? 'Automated backups enabled' : 'Automated backups disabled'
    };
  }

  async updateConfig(updates) {
    await this.initialize();

    if (updates.backupPath) {
      await fs.mkdir(updates.backupPath, { recursive: true });
    }

    this.config = { ...this.config, ...updates };
    await this.saveConfig(this.config);

    if (this.config.enabled) {
      await this.stopSchedule();
      await this.startSchedule();
    }

    return {
      success: true,
      config: this.config
    };
  }

  async runBackup() {
    await this.initialize();

    this.isRunning = true;
    this.lastRun = new Date().toISOString();
    broadcast('backup:started', { timestamp: this.lastRun });

    this.log('Starting database backup...');

    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `backup_${timestamp}.json`;
    const backupPath = path.join(this.config.backupPath, backupFileName);

    let result = {
      success: false,
      timestamp: this.lastRun,
      fileName: backupFileName,
      path: backupPath,
      duration: 0,
      size: 0,
      error: null,
      stats: {}
    };

    const neo4j = new Neo4jService();

    const isAvailable = await neo4j.isAvailable().catch(() => false);
    if (!isAvailable) {
      result.error = 'Neo4j is not available';
      result.duration = Date.now() - startTime;
      this.log(`Backup failed: ${result.error}`, 'error');
      await this.addToHistory(result);
      this.isRunning = false;
      broadcast('backup:completed', result);
      return result;
    }

    await fs.mkdir(this.config.backupPath, { recursive: true });

    const data = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.1'
      },
      users: [],
      memories: [],
      interactions: [],
      conversations: [],
      mentions: [],
      relations: []
    };

    const userResults = await neo4j.read('MATCH (u:User) RETURN u ORDER BY u.handle').catch(() => []);
    data.users = userResults.map(r => this.normalizeProperties(r.u.properties));

    const memoryResults = await neo4j.read('MATCH (m:Memory) RETURN m ORDER BY m.timestamp DESC').catch(() => []);
    data.memories = memoryResults.map(r => this.normalizeProperties(r.m.properties));

    const interactionResults = await neo4j.read(`
      MATCH (u:User)-[r:INTERACTED_WITH]->(s:User)
      RETURN u.handle as user, s.handle as system, properties(r) as relationship
    `).catch(() => []);
    data.interactions = interactionResults.map(r => ({
      from: r.user,
      to: r.system,
      ...this.normalizeProperties(r.relationship)
    }));

    const conversationResults = await neo4j.read('MATCH (c:Conversation) RETURN c').catch(() => []);
    data.conversations = conversationResults.map(r => this.normalizeProperties(r.c.properties));

    // Export MENTIONS relationships (Memory -> User)
    const mentionResults = await neo4j.read(`
      MATCH (m:Memory)-[r:MENTIONS]->(u:User)
      RETURN m.id as memoryId, u.handle as userHandle, properties(r) as props
    `).catch(() => []);
    data.mentions = mentionResults.map(r => ({
      memoryId: r.memoryId,
      userHandle: r.userHandle,
      ...this.normalizeProperties(r.props || {})
    }));

    // Export RELATES_TO relationships (Memory -> Memory)
    const relationResults = await neo4j.read(`
      MATCH (m1:Memory)-[r:RELATES_TO]->(m2:Memory)
      RETURN m1.id as fromId, m2.id as toId, properties(r) as props
    `).catch(() => []);
    data.relations = relationResults.map(r => ({
      fromId: r.fromId,
      toId: r.toId,
      ...this.normalizeProperties(r.props || {})
    }));

    await neo4j.close();

    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(backupPath, jsonContent);

    const stats = await fs.stat(backupPath);
    const duration = Date.now() - startTime;

    result = {
      success: true,
      timestamp: this.lastRun,
      fileName: backupFileName,
      path: backupPath,
      duration,
      size: stats.size,
      error: null,
      stats: {
        users: data.users.length,
        memories: data.memories.length,
        interactions: data.interactions.length,
        conversations: data.conversations.length,
        mentions: data.mentions.length,
        relations: data.relations.length
      }
    };

    this.log(`Backup complete: ${backupFileName} (${this.formatBytes(stats.size)})`);
    this.log(`   Users: ${data.users.length}, Memories: ${data.memories.length}, Mentions: ${data.mentions.length}, Relations: ${data.relations.length}`);

    await this.runMaintenance();

    await this.addToHistory(result);

    this.isRunning = false;
    broadcast('backup:completed', result);

    return result;
  }

  async restoreBackup(backupData, options = {}) {
    await this.initialize();

    const { clearExisting = false } = options;
    this.log('Starting database restore...');
    broadcast('restore:started', { timestamp: new Date().toISOString() });

    const startTime = Date.now();
    const result = {
      success: false,
      duration: 0,
      stats: {
        users: 0,
        memories: 0,
        interactions: 0,
        conversations: 0,
        mentions: 0,
        relations: 0
      },
      errors: []
    };

    const neo4j = new Neo4jService();
    const isAvailable = await neo4j.isAvailable().catch(() => false);
    if (!isAvailable) {
      result.errors.push('Neo4j is not available');
      result.duration = Date.now() - startTime;
      this.log(`Restore failed: Neo4j not available`, 'error');
      broadcast('restore:completed', result);
      return result;
    }

    // Optionally clear existing data
    if (clearExisting) {
      this.log('Clearing existing data...');
      await neo4j.write('MATCH (n) DETACH DELETE n').catch(err => {
        result.errors.push(`Failed to clear data: ${err.message}`);
      });
    }

    // Restore Users
    if (backupData.users?.length > 0) {
      this.log(`Restoring ${backupData.users.length} users...`);
      for (const user of backupData.users) {
        await neo4j.write(`
          MERGE (u:User {handle: $handle})
          SET u += $props
        `, { handle: user.handle, props: user }).catch(err => {
          result.errors.push(`User ${user.handle}: ${err.message}`);
        });
        result.stats.users++;
      }
    }

    // Restore Memories
    if (backupData.memories?.length > 0) {
      this.log(`Restoring ${backupData.memories.length} memories...`);
      for (const memory of backupData.memories) {
        await neo4j.write(`
          MERGE (m:Memory {id: $id})
          SET m += $props
        `, { id: memory.id, props: memory }).catch(err => {
          result.errors.push(`Memory ${memory.id}: ${err.message}`);
        });
        result.stats.memories++;
      }
    }

    // Restore Conversations
    if (backupData.conversations?.length > 0) {
      this.log(`Restoring ${backupData.conversations.length} conversations...`);
      for (const conv of backupData.conversations) {
        await neo4j.write(`
          MERGE (c:Conversation {id: $id})
          SET c += $props
        `, { id: conv.id, props: conv }).catch(err => {
          result.errors.push(`Conversation ${conv.id}: ${err.message}`);
        });
        result.stats.conversations++;
      }
    }

    // Restore INTERACTED_WITH relationships
    if (backupData.interactions?.length > 0) {
      this.log(`Restoring ${backupData.interactions.length} interactions...`);
      for (const interaction of backupData.interactions) {
        const { from, to, ...props } = interaction;
        await neo4j.write(`
          MATCH (u1:User {handle: $from})
          MATCH (u2:User {handle: $to})
          MERGE (u1)-[r:INTERACTED_WITH]->(u2)
          SET r += $props
        `, { from, to, props }).catch(err => {
          result.errors.push(`Interaction ${from}->${to}: ${err.message}`);
        });
        result.stats.interactions++;
      }
    }

    // Restore MENTIONS relationships
    if (backupData.mentions?.length > 0) {
      this.log(`Restoring ${backupData.mentions.length} mentions...`);
      for (const mention of backupData.mentions) {
        const { memoryId, userHandle, ...props } = mention;
        await neo4j.write(`
          MATCH (m:Memory {id: $memoryId})
          MATCH (u:User {handle: $userHandle})
          MERGE (m)-[r:MENTIONS]->(u)
          SET r += $props
        `, { memoryId, userHandle, props }).catch(err => {
          result.errors.push(`Mention ${memoryId}->${userHandle}: ${err.message}`);
        });
        result.stats.mentions++;
      }
    }

    // Restore RELATES_TO relationships
    if (backupData.relations?.length > 0) {
      this.log(`Restoring ${backupData.relations.length} relations...`);
      for (const relation of backupData.relations) {
        const { fromId, toId, ...props } = relation;
        await neo4j.write(`
          MATCH (m1:Memory {id: $fromId})
          MATCH (m2:Memory {id: $toId})
          MERGE (m1)-[r:RELATES_TO]->(m2)
          SET r += $props
        `, { fromId, toId, props }).catch(err => {
          result.errors.push(`Relation ${fromId}->${toId}: ${err.message}`);
        });
        result.stats.relations++;
      }
    }

    await neo4j.close();

    result.success = result.errors.length === 0;
    result.duration = Date.now() - startTime;

    this.log(`Restore complete: ${result.stats.users} users, ${result.stats.memories} memories, ${result.stats.mentions} mentions, ${result.stats.relations} relations`);
    if (result.errors.length > 0) {
      this.log(`   ${result.errors.length} errors occurred`, 'warning');
    }

    broadcast('restore:completed', result);
    return result;
  }

  async restoreFromFile(fileName) {
    await this.initialize();

    const backupPath = path.join(this.config.backupPath, fileName);
    const exists = await fs.access(backupPath).then(() => true).catch(() => false);
    if (!exists) {
      return { success: false, error: `Backup file not found: ${fileName}` };
    }

    let content = await fs.readFile(backupPath, 'utf8');

    // Handle gzipped files
    if (fileName.endsWith('.gz')) {
      const zlib = require('zlib');
      const buffer = await fs.readFile(backupPath);
      content = zlib.gunzipSync(buffer).toString('utf8');
    }

    const backupData = JSON.parse(content);
    return this.restoreBackup(backupData, { clearExisting: false });
  }

  async listBackups() {
    await this.initialize();

    const backupDirExists = await fs.access(this.config.backupPath).then(() => true).catch(() => false);
    if (!backupDirExists) {
      return { success: true, backups: [] };
    }

    const files = await fs.readdir(this.config.backupPath);
    const backups = [];

    for (const file of files) {
      if (!file.startsWith('backup_') || (!file.endsWith('.json') && !file.endsWith('.json.gz'))) {
        continue;
      }

      const filePath = path.join(this.config.backupPath, file);
      const stats = await fs.stat(filePath);

      backups.push({
        fileName: file,
        size: stats.size,
        created: stats.mtime.toISOString(),
        compressed: file.endsWith('.gz')
      });
    }

    // Sort by date descending
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));

    return { success: true, backups };
  }

  async runMaintenance() {
    if (!this.config.compression.enabled) return;

    this.log('Running backup maintenance...');

    const backupDirExists = await fs.access(this.config.backupPath).then(() => true).catch(() => false);
    if (!backupDirExists) return;

    const files = await fs.readdir(this.config.backupPath);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f.startsWith('backup_'));

    let compressed = 0;
    let deleted = 0;

    for (const file of jsonFiles) {
      const filePath = path.join(this.config.backupPath, file);
      const stats = await fs.stat(filePath);
      const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

      if (ageInDays > this.config.compression.afterDays) {
        await execAsync(`gzip "${filePath}"`).catch(() => {});
        compressed++;
      }
    }

    const gzFiles = files.filter(f => f.endsWith('.json.gz'));
    for (const file of gzFiles) {
      const filePath = path.join(this.config.backupPath, file);
      const stats = await fs.stat(filePath);
      const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

      if (ageInDays > this.config.retention.archiveDays) {
        await fs.unlink(filePath);
        deleted++;
      }
    }

    if (compressed > 0 || deleted > 0) {
      this.log(`   Compressed ${compressed} files, deleted ${deleted} old backups`);
    }
  }

  async getBackupHistory(limit = 10) {
    const defaultHistory = {
      backups: [],
      stats: {
        totalBackups: 0,
        totalSuccess: 0,
        totalFailed: 0,
        averageDuration: 0,
        averageSize: 0
      }
    };

    const content = await fs.readFile(this.historyFile, 'utf8').catch(() => null);
    if (!content) {
      await fs.writeFile(this.historyFile, JSON.stringify(defaultHistory, null, 2));
      return defaultHistory;
    }

    const history = JSON.parse(content);

    return {
      backups: history.backups.slice(0, limit),
      stats: history.stats
    };
  }

  async addToHistory(backup) {
    const history = await this.getBackupHistory(1000);

    history.backups.unshift(backup);

    history.stats.totalBackups = history.backups.length;
    history.stats.totalSuccess = history.backups.filter(b => b.success).length;
    history.stats.totalFailed = history.backups.filter(b => !b.success).length;

    const successfulBackups = history.backups.filter(b => b.success);
    if (successfulBackups.length > 0) {
      history.stats.averageDuration = Math.round(
        successfulBackups.reduce((sum, b) => sum + b.duration, 0) / successfulBackups.length
      );
      history.stats.averageSize = Math.round(
        successfulBackups.reduce((sum, b) => sum + b.size, 0) / successfulBackups.length
      );
    }

    await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
  }

  async startSchedule() {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }

    const intervalMs = this.getScheduleInterval();

    this.scheduleInterval = setInterval(async () => {
      if (this.config.enabled && !this.isRunning) {
        await this.runBackup();
      }
    }, intervalMs);

    this.calculateNextRun();

    this.log(`Backup schedule started (${this.config.schedule} at ${this.config.time})`);

    return { success: true, nextRun: this.nextRun };
  }

  async stopSchedule() {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }

    this.nextRun = null;
    this.log('Backup schedule stopped');

    return { success: true };
  }

  getScheduleInterval() {
    switch (this.config.schedule) {
      case 'hourly':
        return 60 * 60 * 1000;
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  calculateNextRun() {
    if (!this.config.enabled || this.config.schedule === 'manual') {
      this.nextRun = null;
      return;
    }

    const now = new Date();
    const [hours, minutes] = this.config.time.split(':').map(Number);

    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      if (this.config.schedule === 'daily') {
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (this.config.schedule === 'weekly') {
        nextRun.setDate(nextRun.getDate() + 7);
      }
    }

    this.nextRun = nextRun.toISOString();
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Convert Neo4j Integer and DateTime types to plain JS values
  normalizeProperties(obj) {
    if (obj === null || obj === undefined) return obj;

    // Handle BigInt
    if (typeof obj === 'bigint') {
      return Number(obj);
    }

    if (typeof obj !== 'object') return obj;

    // Neo4j Integer (has low/high properties) - handle BigInt in low/high
    if ('low' in obj && 'high' in obj && Object.keys(obj).length === 2) {
      const low = typeof obj.low === 'bigint' ? Number(obj.low) : obj.low;
      return low;
    }

    // Neo4j DateTime (has year, month, day, etc.)
    if ('year' in obj && 'month' in obj && 'day' in obj) {
      const toNum = (val) => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'bigint') return Number(val);
        if (typeof val === 'object' && 'low' in val) {
          return typeof val.low === 'bigint' ? Number(val.low) : val.low;
        }
        return Number(val) || 0;
      };

      const year = toNum(obj.year);
      const month = toNum(obj.month);
      const day = toNum(obj.day);
      const hour = toNum(obj.hour);
      const minute = toNum(obj.minute);
      const second = toNum(obj.second);
      return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
    }

    // Array
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeProperties(item));
    }

    // Object - recursively normalize
    const normalized = {};
    for (const [key, value] of Object.entries(obj)) {
      normalized[key] = this.normalizeProperties(value);
    }
    return normalized;
  }

  log(message, level = 'info') {
    const emoji = {
      info: '📦',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[level] || '📦';

    console.log(`${emoji} [Backup] ${message}`);
    broadcast('backup:log', { message, level, timestamp: new Date().toISOString() });
  }

  async runHealthCheck() {
    const neo4j = new Neo4jService();

    const isAvailable = await neo4j.isAvailable().catch(() => false);
    if (!isAvailable) {
      return {
        success: false,
        healthy: false,
        message: 'Neo4j is not available'
      };
    }

    // Helper to convert Neo4j integers to plain numbers
    const toNumber = (val) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'object' && typeof val.toNumber === 'function') return val.toNumber();
      if (typeof val === 'object' && 'low' in val) return val.low;
      return Number(val) || 0;
    };

    const memoryCount = await neo4j.read('MATCH (m:Memory) RETURN count(m) as count').catch(() => [{ count: 0 }]);
    const userCount = await neo4j.read('MATCH (u:User) RETURN count(u) as count').catch(() => [{ count: 0 }]);
    const relationshipCount = await neo4j.read('MATCH ()-[r]-() RETURN count(r) as count').catch(() => [{ count: 0 }]);

    await neo4j.close();

    return {
      success: true,
      healthy: true,
      stats: {
        memories: toNumber(memoryCount[0]?.count),
        users: toNumber(userCount[0]?.count),
        relationships: toNumber(relationshipCount[0]?.count)
      }
    };
  }
}

module.exports = BackupService;
