require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Plugin management module
const pluginManager = require('./plugins');

// Provider system
const aiProvider = require('./services/ai-provider');
const aiProvidersRoutes = require('./routes/ai-providers');

// Prompt and Chat system
const promptExecutor = require('./services/prompt-executor');
const promptsRoutes = require('./routes/prompts');
const chatRoutes = require('./routes/chat');

// Memory system
const memoriesRoutes = require('./routes/memories');

// Backup system
const backupRoutes = require('./routes/backup');
const { setIO } = require('./utils/broadcast');

// Browser management
const browsersRoutes = require('./routes/browsers');
const browserService = require('./services/browser-service');

// FFmpeg service (for plugins that need video processing)
const ffmpegService = require('./services/ffmpeg-service');

// Version management
const versionRoutes = require('./routes/version');
const versionService = require('./services/version-service');

// IPFS management
const ipfsRoutes = require('./routes/ipfs');

// Ollama management
const ollamaRoutes = require('./routes/ollama');
const ollamaService = require('./services/ollama-service');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Set up broadcast utility with socket.io instance
setIO(io);

const PORT = process.env.PORT || 4401;
if (!process.env.CONTENT_DIR) {
  // Point to the existing void-server content directory for development
  process.env.CONTENT_DIR = path.resolve(__dirname, '../../void-server/content');
}
const CONTENT_DIR = process.env.CONTENT_DIR;
const CONFIG_DIR = path.resolve(__dirname, '../config');
const PLUGINS_CONFIG_PATH = path.join(CONFIG_DIR, 'plugins.json');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const APP_VERSION = packageJson.version;

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Log buffer to send to new clients
const logBuffer = [];
const MAX_LOG_BUFFER = 100;

// Helper to broadcast logs to WebSocket clients
const broadcastLog = (type, message) => {
  const logEntry = {
    type,
    level: type === 'error' ? 'error' : 'info',
    message,
    timestamp: new Date().toISOString()
  };

  // Add to buffer
  logBuffer.push(logEntry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.shift();
  }

  // Broadcast to connected clients
  io.emit('server-log', logEntry);
};

// Send buffered logs and app info to new clients
io.on('connection', (socket) => {
  // Send app info (version, etc.) to the client
  socket.emit('app-info', {
    version: APP_VERSION,
    name: packageJson.name
  });

  // Send existing logs to the new client
  logBuffer.forEach(log => {
    socket.emit('server-log', log);
  });
});

// Capture console logs and broadcast (for non-PM2 mode)
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
  originalLog.apply(console, args);
  // Only broadcast if not in PM2 mode (PM2 mode uses tail -F on log files)
  if (!process.env.PM2_HOME) {
    broadcastLog('log', args.map(a => String(a)).join(' '));
  }
};

console.error = function (...args) {
  originalError.apply(console, args);
  if (!process.env.PM2_HOME) {
    broadcastLog('error', args.map(a => String(a)).join(' '));
  }
};

// PM2 log streaming setup (cross-platform, works on Windows)
let logStreamer = null;

const setupLogStreaming = () => {
  const logPath = path.join(__dirname, '../logs/server-out.log');

  // Check if log file exists, create it if not
  if (!fs.existsSync(logPath)) {
    const logsDir = path.dirname(logPath);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.writeFileSync(logPath, '');
  }

  // Cross-platform log streaming using fs.watch + file reading
  let lastSize = 0;
  let lastLines = [];

  // Initial read of last 50 lines
  const content = fs.readFileSync(logPath, 'utf8');
  lastLines = content.split('\n').slice(-50).filter(line => line.trim());
  lastSize = fs.statSync(logPath).size;

  // Broadcast initial lines
  lastLines.forEach(line => broadcastLog('info', line));

  // Watch for file changes
  const watcher = fs.watch(logPath, (eventType) => {
    if (eventType !== 'change') return;

    const stats = fs.statSync(logPath);
    if (stats.size <= lastSize) {
      // File was truncated, reset
      lastSize = stats.size;
      return;
    }

    // Read only new content
    const fd = fs.openSync(logPath, 'r');
    const buffer = Buffer.alloc(stats.size - lastSize);
    fs.readSync(fd, buffer, 0, buffer.length, lastSize);
    fs.closeSync(fd);

    const newContent = buffer.toString('utf8');
    const lines = newContent.split('\n').filter(line => line.trim());
    lines.forEach(line => broadcastLog('info', line));

    lastSize = stats.size;
  });

  watcher.on('error', (error) => {
    console.error(`Log streaming error: ${error.message}`);
  });

  return { close: () => watcher.close() };
};

app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: APP_VERSION });
});

// Providers API
app.use('/api/ai-providers', aiProvidersRoutes);

// Prompts and Chat API
app.use('/api/prompts', promptsRoutes);
app.use('/api/chat', chatRoutes);

// Memories API
app.use('/api/memories', memoriesRoutes);

// Backup API
app.use('/api/backup', backupRoutes);

// Browsers API
app.use('/api/browsers', browsersRoutes);

// Version API
app.use('/api/version', versionRoutes);

// IPFS API
app.use('/api/ipfs', ipfsRoutes);

// Ollama API
app.use('/api/ollama', ollamaRoutes);

// Plugins API
const pluginsRoutes = require('./routes/plugins');
app.use('/api/plugins', pluginsRoutes);

// Initialize Provider system
aiProvider.initialize();

// Pull configured Ollama models on startup (non-blocking)
if (process.env.OLLAMA_MODELS) {
  ollamaService.pullConfiguredModels().then(results => {
    const success = results.filter(r => r.success).length;
    console.log(`🦙 Ollama: pulled ${success}/${results.length} models`);
  }).catch(() => {});
}

// Initialize Prompt Executor (which initializes prompt and chat services)
promptExecutor.initialize();

// Plugin Manager
const plugins = [];

// Load saved plugin configurations
function loadPluginConfig() {
  if (fs.existsSync(PLUGINS_CONFIG_PATH)) {
    const config = JSON.parse(fs.readFileSync(PLUGINS_CONFIG_PATH, 'utf8'));
    return config;
  }
  return {};
}

// Save plugin configurations
function savePluginConfig(config) {
  fs.writeFileSync(PLUGINS_CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Get default nav config for a plugin
function getDefaultNavConfig(pluginName) {
  return {
    navSection: 'Plugins',  // Default section
    navTitle: pluginName.replace('void-plugin-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    navIcon: 'box'  // Default icon
  };
}

// Load manifest.json from a plugin directory
function loadPluginManifest(pluginPath) {
  const manifestPath = path.join(pluginPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  return null;
}

function loadPlugins() {
  console.log('🔌 Loading plugins...');
  const savedConfig = loadPluginConfig();

  // Plugin directories: core (plugins/) and user-installed (data/plugins/)
  const corePluginsDir = path.resolve(__dirname, '../plugins');
  const userPluginsDir = path.resolve(__dirname, '../data/plugins');
  let pluginPaths = [];

  // Helper to scan a directory for plugins
  const scanDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('void-plugin-')) {
        const pluginPath = path.join(dir, entry.name);
        const realPath = fs.realpathSync(pluginPath);
        if (fs.statSync(realPath).isDirectory()) {
          pluginPaths.push(pluginPath);
        }
      }
    }
  };

  // Scan core plugins directory
  scanDir(corePluginsDir);

  // Scan user plugins directory (data/plugins/)
  scanDir(userPluginsDir);

  // Fallback: check sibling directories if no plugins found (dev mode)
  if (pluginPaths.length === 0) {
    const parentDir = path.resolve(__dirname, '../..');
    if (fs.existsSync(parentDir)) {
      const siblingDirs = fs.readdirSync(parentDir);
      for (const dir of siblingDirs) {
        if (dir.startsWith('void-plugin-')) {
          const siblingPath = path.join(parentDir, dir);
          if (fs.statSync(siblingPath).isDirectory()) {
            console.log('⚠️ No plugins in plugins/ dir, falling back to sibling directories');
            pluginPaths.push(siblingPath);
          }
        }
      }
    }
  }

  for (const pluginPath of pluginPaths) {
    if (!fs.existsSync(pluginPath)) {
      console.log(`❌ Plugin not found at ${pluginPath}`);
      continue;
    }

    // Load manifest for client routes and defaults
    const manifest = loadPluginManifest(pluginPath);
    const pluginName = manifest?.name || path.basename(pluginPath);

    // Check if plugin is disabled
    const pluginConfig = savedConfig[pluginName] || {};
    if (pluginConfig.enabled === false) {
      console.log(`⏸️ Skipping disabled plugin: ${pluginName}`);
      continue;
    }

    // Fallback defaults if no manifest
    const defaultMountPath = manifest?.defaultMountPath || `/${pluginName.replace('void-plugin-', '')}`;
    const defaultNavConfig = manifest?.nav || {
      section: 'Plugins',
      title: pluginName.replace('void-plugin-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      icon: 'box'
    };
    const clientRoutes = manifest?.client?.routes || [];

    // Load the plugin module
    const plugin = require(pluginPath);
    if (typeof plugin !== 'function') {
      console.log(`⚠️ ${pluginName} found but does not export a function`);
      continue;
    }

    // Load saved config or use defaults
    const config = savedConfig[pluginName] || {};
    const mountPath = config.mountPath || defaultMountPath;
    const navConfig = {
      navSection: config.navConfig?.navSection !== undefined ? config.navConfig.navSection : defaultNavConfig.section,
      navTitle: config.navConfig?.navTitle || defaultNavConfig.title,
      navIcon: config.navConfig?.navIcon || defaultNavConfig.icon
    };

    // Apply route overrides from instance config
    const routeOverrides = config.routeOverrides || {};
    const resolvedRoutes = clientRoutes.map(route => ({
      ...route,
      enabled: routeOverrides[route.path]?.enabled !== false
    }));

    plugin(app, { mountPath, services: { browserService, ffmpegService, express } });

    // Serve static assets from plugin's assets folder if it exists
    const assetsPath = path.join(pluginPath, 'assets');
    if (fs.existsSync(assetsPath)) {
      app.use(`${mountPath}/assets`, express.static(assetsPath));
      console.log(`📁 Serving assets at ${mountPath}/assets`);
    }

    plugins.push({
      name: pluginName,
      mountPath,
      status: 'active',
      navSection: navConfig.navSection,
      navTitle: navConfig.navTitle,
      navIcon: navConfig.navIcon,
      clientRoutes: resolvedRoutes,
      clientEntry: manifest?.client?.entry || null,
      configurable: true
    });

    console.log(`✅ Loaded ${pluginName} at ${mountPath} with ${resolvedRoutes.length} client routes`);
  }
}

// Load plugins BEFORE defining the catch-all route
loadPlugins();

// API to get plugins (enhanced to include installed and available)
app.get('/api/plugins', (req, res) => {
  const installed = pluginManager.listInstalledPlugins();
  const available = pluginManager.listAvailablePlugins();

  // Merge with in-memory loaded plugins for runtime status
  const installedWithStatus = installed.map(plugin => ({
    ...plugin,
    loaded: plugins.some(p => p.name === plugin.name),
    status: plugins.find(p => p.name === plugin.name)?.status || 'stopped'
  }));

  res.json({
    installed: installedWithStatus,
    available,
    loadedPlugins: plugins
  });
});

// API to get plugin manifest (catalog)
app.get('/api/plugins/manifest', (req, res) => {
  const manifest = pluginManager.loadManifest();
  res.json(manifest);
});

// API to install a plugin
app.post('/api/plugins/install', async (req, res) => {
  const { plugin, gitUrl, branch, name } = req.body;

  // Either plugin name from manifest or gitUrl required
  const source = gitUrl || plugin;
  if (!source) {
    return res.status(400).json({ error: 'Plugin name or gitUrl required' });
  }

  const result = await pluginManager.installPlugin(source, { branch, name });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // In Docker, auto-rebuild client to include new plugin
  if (versionService.isDocker()) {
    console.log('🐳 Docker detected - auto-rebuilding client bundle...');
    result.rebuilding = true;

    // Send response first, then rebuild in background
    res.json(result);

    // Rebuild client asynchronously
    versionService.rebuildClient()
      .then(() => {
        console.log('✅ Client rebuild complete - plugin ready to use');
        // Notify connected clients via WebSocket
        io.emit('plugin:rebuild:complete', { plugin: result.plugin });
      })
      .catch(err => {
        console.error('❌ Client rebuild failed:', err.message);
        io.emit('plugin:rebuild:failed', { plugin: result.plugin, error: err.message });
      });
    return;
  }

  res.json(result);
});

// API to uninstall a plugin
app.delete('/api/plugins/:name', (req, res) => {
  const { name } = req.params;

  // Validate plugin name format
  const validation = pluginManager.validatePluginName(name);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const result = pluginManager.uninstallPlugin(name);

  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }

  res.json(result);
});

// API to enable/disable a plugin
app.put('/api/plugins/:name/enable', (req, res) => {
  const { name } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) required' });
  }

  const result = pluginManager.setPluginEnabled(name, enabled);

  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }

  // In Docker, auto-rebuild client to include/exclude plugin
  if (versionService.isDocker()) {
    console.log(`🐳 Docker detected - auto-rebuilding client after ${enabled ? 'enabling' : 'disabling'} plugin...`);
    result.rebuilding = true;

    // Send response first, then rebuild in background
    res.json(result);

    // Rebuild client asynchronously
    versionService.rebuildClient()
      .then(() => {
        console.log('✅ Client rebuild complete - plugin change ready');
        io.emit('plugin:rebuild:complete', { plugin: name });
      })
      .catch(err => {
        console.error('❌ Client rebuild failed:', err.message);
        io.emit('plugin:rebuild:failed', { plugin: name, error: err.message });
      });
    return;
  }

  res.json(result);
});

// API to update plugin configuration
app.put('/api/plugins/:name/config', (req, res) => {
  const { name } = req.params;
  const { mountPath, navSection, navTitle, navIcon } = req.body;

  const plugin = plugins.find(p => p.name === name);
  if (!plugin) {
    return res.status(404).json({ error: 'Plugin not found' });
  }

  // Load current config
  const savedConfig = loadPluginConfig();

  // Update config
  savedConfig[name] = {
    ...(savedConfig[name] || {}),
    mountPath: mountPath || plugin.mountPath,
    navConfig: {
      navSection: navSection !== undefined ? navSection : plugin.navSection,
      navTitle: navTitle || plugin.navTitle,
      navIcon: navIcon || plugin.navIcon
    }
  };

  // Save config
  savePluginConfig(savedConfig);

  // Update in-memory plugin (note: mountPath changes require restart)
  plugin.navSection = savedConfig[name].navConfig.navSection;
  plugin.navTitle = savedConfig[name].navConfig.navTitle;
  plugin.navIcon = savedConfig[name].navConfig.navIcon;

  // Notify if mountPath changed (requires restart)
  const mountPathChanged = mountPath && mountPath !== plugin.mountPath;

  res.json({
    success: true,
    plugin,
    requiresRestart: mountPathChanged,
    message: mountPathChanged
      ? 'Configuration saved. Restart required for mount path change to take effect.'
      : 'Configuration saved.'
  });
});

// API to restart the server
app.post('/api/server/restart', (req, res) => {
  console.log('🔄 Server restart requested via API');
  res.json({ success: true, message: 'Server restarting...' });

  // Delay restart slightly to allow response to be sent
  setTimeout(() => {
    // Also restart void-client so Vite picks up new plugins
    const { spawn } = require('child_process');
    spawn('npx', ['pm2', 'restart', 'void-client'], {
      stdio: 'ignore',
      detached: true
    }).unref();

    // Give client restart a moment to start
    setTimeout(() => {
      process.exit(0); // PM2 will auto-restart the server process
    }, 200);
  }, 500);
});

// ============================================================================
// PM2 Logs API
// ============================================================================

// Store active PM2 log streams
const activeLogStreams = new Map();

// Get list of PM2 processes
app.get('/api/pm2/processes', async (req, res) => {
  const { promisify } = require('util');
  const { exec } = require('child_process');
  const execAsync = promisify(exec);

  const { stdout } = await execAsync('npx pm2 jlist');
  // PM2 sometimes outputs extra text before the JSON (e.g., ">>> In-memory PM2...")
  const jsonStart = stdout.indexOf('[');
  const jsonString = jsonStart >= 0 ? stdout.slice(jsonStart) : '[]';
  const processes = JSON.parse(jsonString);

  const processList = processes.map(p => ({
    name: p.name,
    pm_id: p.pm_id,
    status: p.pm2_env?.status,
    memory: p.monit?.memory,
    cpu: p.monit?.cpu,
    uptime: p.pm2_env?.pm_uptime
  }));

  res.json({
    success: true,
    processes: processList
  });
});

// SSE endpoint for streaming PM2 logs
app.get('/api/pm2/logs', (req, res) => {
  const { exec } = require('child_process');
  const processName = req.query.process || 'all';
  const initialLines = parseInt(req.query.lines) || 100;
  const streamId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connection message
  res.write(': connected\n\n');

  let pm2Process = null;

  // Cleanup function
  const cleanup = () => {
    if (pm2Process && !pm2Process.killed) {
      pm2Process.kill();
      pm2Process = null;
    }
    activeLogStreams.delete(streamId);
  };

  // Register cleanup handlers
  req.on('close', cleanup);
  res.on('close', cleanup);

  // Store stream reference
  activeLogStreams.set(streamId, { process: null, processName });

  // Get initial logs
  const initialLogsCmd = processName === 'all'
    ? `pm2 logs --lines ${initialLines} --nostream --raw`
    : `pm2 logs ${processName} --lines ${initialLines} --nostream --raw`;

  exec(initialLogsCmd, (error, stdout, stderr) => {
    if (res.writableEnded) return;

    if (!error && stdout) {
      const lines = stdout.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const event = {
          type: 'log',
          message: line,
          stream: 'out',
          timestamp: new Date().toISOString()
        };
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
    }

    // Now start streaming new logs
    const pm2Args = processName === 'all'
      ? ['logs', '--lines', '0', '--raw']
      : ['logs', processName, '--lines', '0', '--raw'];

    pm2Process = spawn('npx', ['pm2', ...pm2Args]);
    activeLogStreams.set(streamId, { process: pm2Process, processName });

    pm2Process.stdout.on('data', (data) => {
      if (res.writableEnded) {
        cleanup();
        return;
      }

      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const event = {
          type: 'log',
          message: line,
          stream: 'out',
          timestamp: new Date().toISOString()
        };
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
    });

    pm2Process.stderr.on('data', (data) => {
      if (res.writableEnded) {
        cleanup();
        return;
      }

      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const event = {
          type: 'log',
          message: line,
          stream: 'err',
          timestamp: new Date().toISOString()
        };
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });
    });

    pm2Process.on('error', (error) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: 'log',
          message: `[ERROR] Failed to spawn pm2: ${error.message}`,
          stream: 'err',
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
      cleanup();
    });

    pm2Process.on('exit', cleanup);
  });
});

// ============================================================================
// Static Files / Dev Proxy
// ============================================================================

const isDev = process.env.NODE_ENV !== 'production';
const VITE_DEV_PORT = 4480;
const clientDistPath = path.join(__dirname, '../client/dist');

if (isDev) {
  // In development, proxy to Vite dev server for HMR
  // Note: ws: false because Vite's HMR WebSocket connects directly to Vite (port 4480)
  // and we need Socket.IO WebSocket connections to stay on Express (port 4401)
  const viteProxy = createProxyMiddleware({
    target: `http://localhost:${VITE_DEV_PORT}`,
    changeOrigin: true,
    ws: false,
    // Don't proxy API routes
    filter: (pathname) => {
      return !pathname.startsWith('/api') &&
             !pathname.startsWith('/health') &&
             !pathname.startsWith('/socket.io');
    }
  });

  app.use(viteProxy);
  console.log(`🔧 Development mode: Proxying client requests to Vite dev server at port ${VITE_DEV_PORT}`);
} else if (fs.existsSync(clientDistPath)) {
  // In production, serve static files from client/dist
  app.use(express.static(clientDistPath));

  // Handle SPA routing - return index.html for any unknown route that isn't an API
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  console.log('⚠️ Client build not found. Please run "npm run build" in the client directory.');
  app.get('/', (req, res) => {
    res.send('Void Server Core is running. Client build not found. Please build the client.');
  });
}

server.listen(PORT, () => {
  console.log(`🚀 Void Server Core running on port ${PORT}`);
  console.log(`📂 Content Directory: ${CONTENT_DIR}`);
  console.log(`🔌 WebSocket server ready`);

  // Start PM2 log streaming if running under PM2
  if (process.env.PM2_HOME) {
    logStreamer = setupLogStreaming();
    console.log(`📋 PM2 log streaming initialized`);
  }

  // Check if user plugins need to be rebuilt into client bundle (production only)
  if (!isDev) {
    const pluginsNeedingRebuild = versionService.getPluginsNeedingRebuild();
    if (pluginsNeedingRebuild.length > 0) {
      console.log(`🔧 User plugins not in client bundle: ${pluginsNeedingRebuild.join(', ')}`);
      console.log(`🔨 Auto-rebuilding client to include user plugins...`);

      versionService.rebuildClient()
        .then(() => {
          console.log('✅ Client rebuild complete - user plugins now available');
          io.emit('plugin:rebuild:complete', { plugins: pluginsNeedingRebuild });
        })
        .catch(err => {
          console.error('❌ Client rebuild failed:', err.message);
          io.emit('plugin:rebuild:failed', { plugins: pluginsNeedingRebuild, error: err.message });
        });
    }
  }

  // Send ready signal to PM2
  if (process.send) {
    process.send('ready');
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('🛑 Received shutdown signal, closing gracefully...');

  // Kill log streamer
  if (logStreamer) {
    logStreamer.kill();
    console.log('📋 Log streaming stopped');
  }

  server.close(() => {
    console.log('✅ HTTP server closed');

    // Close WebSocket connections
    io.close(() => {
      console.log('✅ WebSocket server closed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
