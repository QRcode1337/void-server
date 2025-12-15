/**
 * Backup API Routes
 *
 * Provides REST endpoints for database backup management
 */

const express = require('express');
const router = express.Router();
const BackupService = require('../services/backup-service');

const backupService = new BackupService();

// GET /api/backup/status - Get backup service status
router.get('/status', async (req, res) => {
  console.log('📦 GET /api/backup/status');
  const status = await backupService.getStatus();
  res.json(status);
});

// POST /api/backup/toggle - Enable/disable automated backups
router.post('/toggle', async (req, res) => {
  const { enabled } = req.body;
  console.log(`📦 POST /api/backup/toggle enabled=${enabled}`);
  const result = await backupService.toggle(enabled);
  res.json(result);
});

// POST /api/backup/config - Update backup configuration
router.post('/config', async (req, res) => {
  console.log('📦 POST /api/backup/config');
  const result = await backupService.updateConfig(req.body);
  res.json(result);
});

// POST /api/backup/run - Manually trigger a backup
router.post('/run', async (req, res) => {
  console.log('📦 POST /api/backup/run');
  const result = await backupService.runBackup();
  res.json(result);
});

// GET /api/backup/history - Get backup history
router.get('/history', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  console.log(`📦 GET /api/backup/history limit=${limit}`);
  const history = await backupService.getBackupHistory(limit);
  res.json(history);
});

// GET /api/backup/health - Run Neo4j health check
router.get('/health', async (req, res) => {
  console.log('📦 GET /api/backup/health');
  const result = await backupService.runHealthCheck();
  res.json(result);
});

// GET /api/backup/list - List available backups
router.get('/list', async (req, res) => {
  console.log('📦 GET /api/backup/list');
  const result = await backupService.listBackups();
  res.json(result);
});

// POST /api/backup/restore - Restore from a backup file
router.post('/restore', async (req, res) => {
  const { fileName, clearExisting } = req.body;
  console.log(`📦 POST /api/backup/restore fileName=${fileName} clearExisting=${clearExisting}`);

  if (!fileName) {
    return res.status(400).json({ success: false, error: 'fileName is required' });
  }

  const result = await backupService.restoreFromFile(fileName);
  res.json(result);
});

// POST /api/backup/restore/upload - Restore from uploaded JSON
router.post('/restore/upload', async (req, res) => {
  console.log('📦 POST /api/backup/restore/upload');

  const backupData = req.body;
  if (!backupData || !backupData.metadata) {
    return res.status(400).json({ success: false, error: 'Invalid backup data' });
  }

  const result = await backupService.restoreBackup(backupData, { clearExisting: false });
  res.json(result);
});

module.exports = router;
