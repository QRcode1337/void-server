const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { findChrome, getChromeInfo } = require('./chrome-finder');

/**
 * Browser Management Service
 *
 * Manages persistent browser profiles with authentication states.
 * Each profile stores cookies/sessions for reuse by plugins.
 *
 * Browser profiles are stored in data/browsers/ which is the user data directory.
 * Native Chrome/Chromium browsers are launched with profile directories for authentication.
 */

// Use data directory for persistence
const DATA_DIR = path.join(__dirname, '../../data/browsers');
const LEGACY_DATA_DIR = path.join(__dirname, '../../config/browsers');
const CONFIG_FILE = path.join(DATA_DIR, 'browsers.json');
const LEGACY_CONFIG_FILE = path.join(LEGACY_DATA_DIR, 'browsers.json');

// Default port range for CDP debugging (supports many browser profiles)
const DEFAULT_PORT_START = 9111;
const DEFAULT_PORT_END = 9199;

// Track running browser processes: Map<profileId, { pid, cdpPort, startedAt, process }>
const runningBrowsers = new Map();

// Playwright instance (lazy loaded)
let chromium = null;

async function getPlaywright() {
  if (!chromium) {
    try {
      const playwright = require('playwright');
      chromium = playwright.chromium;
    } catch (err) {
      console.log('⚠️ Playwright not installed. Browser management requires: npm install playwright');
      return null;
    }
  }
  return chromium;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Migrate browser data from legacy location (config/browsers) to new location (data/browsers)
 */
async function migrateFromLegacy() {
  if (!fsSync.existsSync(LEGACY_DATA_DIR)) return 0;

  await ensureDataDir();

  let migrated = 0;
  const entries = fsSync.readdirSync(LEGACY_DATA_DIR);

  for (const entry of entries) {
    const legacyPath = path.join(LEGACY_DATA_DIR, entry);
    const newPath = path.join(DATA_DIR, entry);

    // Skip if already exists
    if (fsSync.existsSync(newPath)) continue;

    const stat = fsSync.statSync(legacyPath);
    if (stat.isDirectory()) {
      // Recursively copy directory (browser profile data)
      fsSync.cpSync(legacyPath, newPath, { recursive: true });
      fsSync.rmSync(legacyPath, { recursive: true });
    } else {
      // Copy file
      fsSync.copyFileSync(legacyPath, newPath);
      fsSync.unlinkSync(legacyPath);
    }
    migrated++;
  }

  return migrated;
}

async function loadConfig() {
  // Migrate from legacy location if needed
  const migrated = await migrateFromLegacy();
  if (migrated > 0) {
    console.log(`📦 Migrated ${migrated} browser item(s) from config/browsers to data/browsers`);
  }

  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { browsers: {} };
  }
}

async function saveConfig(config) {
  await ensureDataDir();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Check if a port is available (not in use)
 */
async function isPortAvailable(port) {
  const net = require('net');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Check if a CDP endpoint is active on a port
 */
async function isCdpActive(port) {
  const http = require('http');
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Find the next available port in the configured range
 */
async function findAvailablePort(config) {
  const usedPorts = new Set(
    Object.values(config.browsers || {})
      .filter(b => b.port)
      .map(b => b.port)
  );

  for (let port = DEFAULT_PORT_START; port <= DEFAULT_PORT_END; port++) {
    if (!usedPorts.has(port) && await isPortAvailable(port)) {
      return port;
    }
  }
  return null;
}

/**
 * Get all used ports
 */
async function getUsedPorts() {
  const config = await loadConfig();
  return Object.entries(config.browsers || {})
    .filter(([_, b]) => b.port)
    .map(([id, b]) => ({ id, port: b.port }));
}

/**
 * List all browser profiles
 */
async function listBrowsers() {
  const config = await loadConfig();
  const browsers = Object.entries(config.browsers).map(([id, browser]) => ({
    id,
    ...browser,
    running: runningBrowsers.has(id)
  }));

  // Check authentication status for each
  for (const browser of browsers) {
    browser.authenticated = await checkAuthentication(browser.id);
  }

  return browsers;
}

/**
 * Get a single browser profile
 */
async function getBrowser(id) {
  const config = await loadConfig();
  const browser = config.browsers[id];
  if (!browser) return null;

  return {
    id,
    ...browser,
    running: runningBrowsers.has(id),
    authenticated: await checkAuthentication(id)
  };
}

/**
 * Create a new browser profile
 */
async function createBrowser(id, options = {}) {
  const { name, description = '', port: requestedPort, autoAssignPort = true, startUrl = '' } = options;

  if (!id || !id.match(/^[a-z0-9-]+$/)) {
    return { success: false, error: 'Invalid ID. Use lowercase letters, numbers, and hyphens only.' };
  }

  const config = await loadConfig();

  if (config.browsers[id]) {
    return { success: false, error: 'Browser profile already exists' };
  }

  // Handle port assignment
  let port = null;
  if (requestedPort) {
    // Validate requested port
    if (requestedPort < 1024 || requestedPort > 65535) {
      return { success: false, error: 'Port must be between 1024 and 65535' };
    }
    // Check if port is already assigned
    const usedPorts = Object.values(config.browsers || {}).filter(b => b.port).map(b => b.port);
    if (usedPorts.includes(requestedPort)) {
      return { success: false, error: `Port ${requestedPort} is already assigned to another profile` };
    }
    port = requestedPort;
  } else if (autoAssignPort) {
    // Auto-assign from default range
    port = await findAvailablePort(config);
    if (!port) {
      return { success: false, error: 'No available ports in range 9222-9299' };
    }
  }

  const profileDir = path.join(DATA_DIR, id);
  await fs.mkdir(profileDir, { recursive: true });

  config.browsers[id] = {
    name: name || id,
    description,
    port,
    startUrl: startUrl || null,
    createdAt: new Date().toISOString(),
    profileDir
  };

  await saveConfig(config);

  console.log(`🌐 Created browser profile: ${id}${port ? ` (port ${port})` : ''}`);

  return { success: true, browser: { id, ...config.browsers[id] } };
}

/**
 * Delete a browser profile
 */
async function deleteBrowser(id) {
  // Close if running
  if (runningBrowsers.has(id)) {
    await closeBrowser(id);
  }

  const config = await loadConfig();

  if (!config.browsers[id]) {
    return { success: false, error: 'Browser profile not found' };
  }

  // Delete profile directory
  const profileDir = path.join(DATA_DIR, id);
  await fs.rm(profileDir, { recursive: true, force: true });

  delete config.browsers[id];
  await saveConfig(config);

  console.log(`🗑️ Deleted browser profile: ${id}`);

  return { success: true };
}

/**
 * Check if browser profile has authentication (cookies exist)
 */
async function checkAuthentication(id) {
  const profileDir = path.join(DATA_DIR, id);
  const cookiesPath = path.join(profileDir, 'Default', 'Cookies');
  const localStatePath = path.join(profileDir, 'Local State');

  const cookiesExist = await fs.access(cookiesPath).then(() => true).catch(() => false);
  const localStateExists = await fs.access(localStatePath).then(() => true).catch(() => false);

  return cookiesExist || localStateExists;
}

/**
 * Check if a process is still running by PID
 */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get browser status
 */
async function getBrowserStatus(id) {
  const config = await loadConfig();
  const browser = config.browsers[id];

  if (!browser) {
    return { success: false, error: 'Browser profile not found' };
  }

  // Check if browser process is running (tracked by us)
  let running = false;
  const browserInfo = runningBrowsers.get(id);
  if (browserInfo) {
    running = isProcessRunning(browserInfo.pid);
    if (!running) {
      // Process died, clean up tracking
      runningBrowsers.delete(id);
    }
  }

  // Also check if CDP is active on the port (browser may have been started externally)
  let cdpActive = false;
  if (browser.port) {
    cdpActive = await isCdpActive(browser.port);
    // If CDP is active but we're not tracking it, update running status
    if (cdpActive && !running) {
      running = true;
    }
  }

  return {
    success: true,
    id,
    name: browser.name,
    port: browser.port,
    running,
    cdpActive,
    authenticated: await checkAuthentication(id)
  };
}

/**
 * Launch browser for authentication
 * Opens native Chrome/Chromium window with profile directory
 */
async function launchBrowser(id, options = {}) {
  const { url } = options;

  // Check if already running
  const existingInfo = runningBrowsers.get(id);
  if (existingInfo && isProcessRunning(existingInfo.pid)) {
    return {
      success: true,
      message: 'Browser already running',
      pid: existingInfo.pid
    };
  }

  // Find Chrome executable
  const chrome = findChrome();
  if (!chrome) {
    return {
      success: false,
      error: 'Chrome/Chromium not found. Install Google Chrome or run: npx playwright install chromium'
    };
  }

  // Get profile info
  const browser = await getBrowser(id);
  if (!browser) {
    return { success: false, error: 'Browser profile not found' };
  }

  const profileDir = getProfileDir(id);
  const cdpPort = browser.port;

  // Ensure profile directory exists
  await fs.mkdir(profileDir, { recursive: true });

  // Chrome launch arguments
  const args = [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${cdpPort}`,
  ];

  // Use provided URL, or fall back to profile's startUrl
  const launchUrl = url || browser.startUrl;
  if (launchUrl) {
    args.push(launchUrl);
  }

  // Spawn Chrome process
  const browserProcess = spawn(chrome.path, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  // Allow Node to exit while browser runs
  browserProcess.unref();

  // Track the process
  runningBrowsers.set(id, {
    pid: browserProcess.pid,
    cdpPort,
    startedAt: Date.now(),
    process: browserProcess
  });

  // Handle process exit to clean up tracking
  browserProcess.on('exit', () => {
    runningBrowsers.delete(id);
  });

  browserProcess.on('error', (err) => {
    console.error(`Browser process error for ${id}:`, err.message);
    runningBrowsers.delete(id);
  });

  console.log(`🌐 Launched browser for ${id} (PID: ${browserProcess.pid}, CDP: ${cdpPort})`);

  return {
    success: true,
    pid: browserProcess.pid,
    cdpPort
  };
}

/**
 * Close a running browser
 * Terminates the native browser process
 */
async function closeBrowser(id) {
  const browserInfo = runningBrowsers.get(id);
  if (!browserInfo) {
    return { success: false, error: 'Browser not running' };
  }

  const { pid } = browserInfo;

  // Platform-specific process termination
  if (process.platform === 'win32') {
    // Windows: use taskkill
    spawn('taskkill', ['/PID', pid.toString(), '/F', '/T'], { stdio: 'ignore', windowsHide: true });
  } else {
    // macOS/Linux: send SIGTERM for graceful close
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process may already be dead
    }
  }

  // Clean up tracking
  runningBrowsers.delete(id);

  console.log(`🌐 Closed browser for ${id} (PID: ${pid})`);

  return { success: true };
}

/**
 * Get a browser context for plugin use
 * Connects to running browser via CDP, or launches headless if not running
 */
async function getBrowserContext(id) {
  const chromium = await getPlaywright();
  if (!chromium) {
    throw new Error('Playwright not installed');
  }

  // Get browser config to find the CDP port
  const config = await loadConfig();
  const browserConfig = config.browsers[id];
  if (!browserConfig) {
    throw new Error(`Browser profile not found: ${id}`);
  }

  const cdpPort = browserConfig.port;
  if (!cdpPort) {
    throw new Error(`Browser profile ${id} has no CDP port configured`);
  }

  // Check if browser is running on the CDP port
  const cdpActive = await isCdpActive(cdpPort);
  if (!cdpActive) {
    throw new Error(`Browser not running on port ${cdpPort}. Launch the browser first from the Browsers page.`);
  }

  // Connect to the running browser via CDP
  console.log(`🌐 Connecting to browser ${id} on CDP port ${cdpPort}`);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);

  // Get the default context (the one with the user's session)
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error('No browser context available');
  }

  return contexts[0];
}

/**
 * Get profile directory path for a browser
 */
function getProfileDir(id) {
  return path.join(DATA_DIR, id);
}

/**
 * Update browser settings (port, name, description)
 */
async function updateBrowser(id, updates = {}) {
  const config = await loadConfig();
  const browser = config.browsers[id];

  if (!browser) {
    return { success: false, error: 'Browser profile not found' };
  }

  // Cannot update while running
  if (runningBrowsers.has(id)) {
    return { success: false, error: 'Cannot update browser while running. Close it first.' };
  }

  // Handle port update
  if (updates.port !== undefined) {
    if (updates.port !== null) {
      if (updates.port < 1024 || updates.port > 65535) {
        return { success: false, error: 'Port must be between 1024 and 65535' };
      }
      // Check if port is already assigned to another profile
      const usedPorts = Object.entries(config.browsers || {})
        .filter(([browserId, b]) => b.port && browserId !== id)
        .map(([_, b]) => b.port);
      if (usedPorts.includes(updates.port)) {
        return { success: false, error: `Port ${updates.port} is already assigned to another profile` };
      }
    }
    browser.port = updates.port;
  }

  // Handle name update
  if (updates.name !== undefined) {
    browser.name = updates.name;
  }

  // Handle description update
  if (updates.description !== undefined) {
    browser.description = updates.description;
  }

  // Handle startUrl update
  if (updates.startUrl !== undefined) {
    browser.startUrl = updates.startUrl || null;
  }

  config.browsers[id] = browser;
  await saveConfig(config);

  console.log(`🌐 Updated browser profile: ${id}`);

  return { success: true, browser: { id, ...browser } };
}

/**
 * Get port range info
 */
function getPortRange() {
  return { start: DEFAULT_PORT_START, end: DEFAULT_PORT_END };
}

/**
 * Get Chrome info for diagnostics
 */
function getChromeStatus() {
  return getChromeInfo();
}

/**
 * Check if running inside Docker container
 */
function isRunningInDocker() {
  return fsSync.existsSync('/.dockerenv') ||
    (fsSync.existsSync('/proc/1/cgroup') &&
      fsSync.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
}

/**
 * Generate platform-specific authentication commands for running Chrome on host
 * Used when server runs in Docker but browser auth needs to happen on host machine
 */
async function getAuthCommand(id, url) {
  const browser = await getBrowser(id);
  if (!browser) {
    return null;
  }

  // Use provided URL, or fall back to profile's startUrl
  const launchUrl = url || browser.startUrl;

  // Host path - data/browsers is mounted from host ./data/browsers
  const hostProfileDir = `./data/browsers/${id}`;

  // Build URL argument only if we have a URL
  const urlArg = launchUrl ? ` "${launchUrl}"` : '';

  return {
    darwin: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --user-data-dir="${hostProfileDir}"${urlArg}`,
    win32: `start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="${hostProfileDir}"${urlArg}`,
    linux: `google-chrome --user-data-dir="${hostProfileDir}"${urlArg}`
  };
}

module.exports = {
  listBrowsers,
  getBrowser,
  createBrowser,
  deleteBrowser,
  updateBrowser,
  getBrowserStatus,
  launchBrowser,
  closeBrowser,
  checkAuthentication,
  getBrowserContext,
  getProfileDir,
  getUsedPorts,
  getPortRange,
  getChromeStatus,
  isRunningInDocker,
  getAuthCommand,
  DATA_DIR
};
