/**
 * Database Backup Service
 *
 * Manages automated Neo4j database backups with scheduling
 */

const fs = require('fs').promises;
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

    this.configDir = path.join(__dirname, '../../config');
    this.configFile = path.join(this.configDir, 'backup.json');
    this.historyFile = path.join(this.configDir, 'backup-history.json');

    this.config = null;
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
    this.scheduleInterval = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await fs.mkdir(this.configDir, { recursive: true });
    this.config = await this.loadConfig();

    this.initialized = true;
    this.log('Backup service initialized');
  }

  async loadConfig() {
    const defaultConfig = {
      enabled: false,
      schedule: 'daily',
      time: '02:00',
      backupPath: path.join(__dirname, '../../backups/neo4j'),
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
        version: '1.0'
      },
      users: [],
      memories: [],
      interactions: [],
      conversations: []
    };

    const userResults = await neo4j.read('MATCH (u:User) RETURN u ORDER BY u.handle').catch(() => []);
    data.users = userResults.map(r => r.u.properties);

    const memoryResults = await neo4j.read('MATCH (m:Memory) RETURN m ORDER BY m.timestamp DESC').catch(() => []);
    data.memories = memoryResults.map(r => r.m.properties);

    const interactionResults = await neo4j.read(`
      MATCH (u:User)-[r:INTERACTED_WITH]->(s:User)
      RETURN u.handle as user, s.handle as system, properties(r) as relationship
    `).catch(() => []);
    data.interactions = interactionResults.map(r => ({
      from: r.user,
      to: r.system,
      ...r.relationship
    }));

    const conversationResults = await neo4j.read('MATCH (c:Conversation) RETURN c').catch(() => []);
    data.conversations = conversationResults.map(r => r.c.properties);

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
        conversations: data.conversations.length
      }
    };

    this.log(`Backup complete: ${backupFileName} (${this.formatBytes(stats.size)})`);
    this.log(`   Users: ${data.users.length}, Memories: ${data.memories.length}, Interactions: ${data.interactions.length}`);

    await this.runMaintenance();

    await this.addToHistory(result);

    this.isRunning = false;
    broadcast('backup:completed', result);

    return result;
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
