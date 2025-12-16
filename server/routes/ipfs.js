/**
 * IPFS API Routes
 * Pin, unpin, and manage IPFS content
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const ipfsService = require('../services/ipfs-service');

/**
 * GET /api/ipfs/status
 * Get IPFS service status including daemon check and metrics
 */
router.get('/status', async (req, res) => {
  const status = await ipfsService.getStatus();
  res.json({ success: true, ...status });
});

/**
 * GET /api/ipfs/pins
 * List all pinned content
 */
router.get('/pins', async (req, res) => {
  const pins = await ipfsService.listPins();
  res.json({ success: true, pins });
});

/**
 * GET /api/ipfs/config
 * Get IPFS configuration
 */
router.get('/config', async (req, res) => {
  const config = await ipfsService.loadConfig();
  res.json({ success: true, config });
});

/**
 * POST /api/ipfs/config
 * Update IPFS configuration
 */
router.post('/config', async (req, res) => {
  const currentConfig = await ipfsService.loadConfig();
  const newConfig = { ...currentConfig, ...req.body };
  await ipfsService.saveConfig(newConfig);
  console.log('⚙️ IPFS config updated');
  res.json({ success: true, config: newConfig });
});

/**
 * POST /api/ipfs/pin/file
 * Pin an uploaded file
 * Expects multipart form data with 'file' field
 */
router.post('/pin/file', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  // Check daemon first
  const status = await ipfsService.checkDaemon();
  if (!status.online) {
    return res.status(503).json({
      success: false,
      error: 'IPFS daemon not running'
    });
  }

  // Get filename from header or query
  const filename = req.query.filename || req.headers['x-filename'] || 'unnamed';

  // Save to temp file
  const tempPath = path.join(os.tmpdir(), `ipfs-upload-${Date.now()}-${filename}`);
  await fs.writeFile(tempPath, req.body);

  console.log(`📤 Pinning uploaded file: ${filename}`);
  const pin = await ipfsService.pinFile(tempPath, {
    name: filename,
    source: 'upload'
  });

  // Clean up temp file
  await fs.unlink(tempPath);

  res.json({ success: true, pin });
});

/**
 * POST /api/ipfs/pin/url
 * Pin content from a URL
 */
router.post('/pin/url', async (req, res) => {
  const { url, name } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    });
  }

  // Check daemon first
  const status = await ipfsService.checkDaemon();
  if (!status.online) {
    return res.status(503).json({
      success: false,
      error: 'IPFS daemon not running'
    });
  }

  console.log(`📤 Pinning URL: ${url}`);
  const pin = await ipfsService.pinUrl(url, { name });

  res.json({ success: true, pin });
});

/**
 * POST /api/ipfs/pin/directory
 * Pin a directory from the server filesystem
 */
router.post('/pin/directory', async (req, res) => {
  const { path: dirPath, name } = req.body;

  if (!dirPath) {
    return res.status(400).json({
      success: false,
      error: 'Directory path is required'
    });
  }

  // Check daemon first
  const status = await ipfsService.checkDaemon();
  if (!status.online) {
    return res.status(503).json({
      success: false,
      error: 'IPFS daemon not running'
    });
  }

  // Verify directory exists
  const stats = await fs.stat(dirPath);
  if (!stats.isDirectory()) {
    return res.status(400).json({
      success: false,
      error: 'Path is not a directory'
    });
  }

  console.log(`📤 Pinning directory: ${dirPath}`);
  const pin = await ipfsService.pinDirectory(dirPath, { name });

  res.json({ success: true, pin });
});

/**
 * DELETE /api/ipfs/pin/:cid
 * Unpin content by CID
 */
router.delete('/pin/:cid', async (req, res) => {
  const { cid } = req.params;

  // Check daemon first
  const status = await ipfsService.checkDaemon();
  if (!status.online) {
    return res.status(503).json({
      success: false,
      error: 'IPFS daemon not running'
    });
  }

  console.log(`📤 Unpinning: ${cid}`);
  const result = await ipfsService.unpin(cid);

  res.json({ success: true, ...result });
});

/**
 * GET /api/ipfs/daemon/check
 * Quick daemon status check
 */
router.get('/daemon/check', async (req, res) => {
  const status = await ipfsService.checkDaemon();
  res.json({ success: true, ...status });
});

// ============================================
// Pinata Routes (Public Pinning Service)
// ============================================

/**
 * GET /api/ipfs/pinata/status
 * Check Pinata service connectivity and auth
 */
router.get('/pinata/status', async (req, res) => {
  const status = await ipfsService.checkPinata();
  res.json({ success: true, ...status });
});

/**
 * POST /api/ipfs/pinata/pin/:cid
 * Pin an existing CID to Pinata for public access
 */
router.post('/pinata/pin/:cid', async (req, res) => {
  const { cid } = req.params;
  const { name } = req.body;

  console.log(`☁️ Pinning to Pinata: ${cid}`);
  const result = await ipfsService.pinByHashToPinata(cid, name);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

/**
 * DELETE /api/ipfs/pinata/pin/:cid
 * Unpin from Pinata
 */
router.delete('/pinata/pin/:cid', async (req, res) => {
  const { cid } = req.params;

  console.log(`☁️ Unpinning from Pinata: ${cid}`);
  const result = await ipfsService.unpinFromPinata(cid);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

/**
 * GET /api/ipfs/pinata/pins
 * List all pins on Pinata
 */
router.get('/pinata/pins', async (req, res) => {
  const result = await ipfsService.listPinataFiles();

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json(result);
});

module.exports = router;
