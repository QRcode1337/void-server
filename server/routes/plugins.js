/**
 * Plugin Management API Routes
 */
const express = require('express');
const router = express.Router();
const pluginManager = require('../plugins');

// List all installed plugins
router.get('/', (req, res) => {
  const plugins = pluginManager.listInstalledPlugins();
  res.json({ success: true, plugins });
});

// List available plugins from manifest
router.get('/available', (req, res) => {
  const plugins = pluginManager.listAvailablePlugins();
  res.json({ success: true, plugins });
});

// Check for plugin updates
router.get('/updates', async (req, res) => {
  const updates = await pluginManager.checkAllPluginUpdates();
  const hasUpdates = updates.some(u => u.hasUpdate);
  res.json({ success: true, hasUpdates, plugins: updates });
});

// Check single plugin for updates
router.get('/:name/check-update', async (req, res) => {
  const { name } = req.params;
  const result = await pluginManager.checkPluginUpdate(name);
  res.json(result);
});

// Install a plugin
router.post('/install', async (req, res) => {
  const { source, branch, name } = req.body;

  if (!source) {
    return res.status(400).json({ success: false, error: 'Source is required' });
  }

  const result = await pluginManager.installPlugin(source, { branch, name });
  res.json(result);
});

// Update a plugin
router.post('/:name/update', async (req, res) => {
  const { name } = req.params;
  const result = await pluginManager.updatePlugin(name);
  res.json(result);
});

// Uninstall a plugin
router.delete('/:name', (req, res) => {
  const { name } = req.params;
  const result = pluginManager.uninstallPlugin(name);
  res.json(result);
});

// Enable/disable a plugin
router.post('/:name/toggle', (req, res) => {
  const { name } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
  }

  const result = pluginManager.setPluginEnabled(name, enabled);
  res.json(result);
});

module.exports = router;
