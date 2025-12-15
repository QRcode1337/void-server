const fs = require('fs').promises;
const path = require('path');

/**
 * Browser Management Service
 *
 * Manages persistent browser profiles with authentication states.
 * Each profile stores cookies/sessions for reuse by plugins.
 *
 * Browser profiles are stored in config/browsers/ which is:
 * - Mounted as a volume in Docker (persistent across container restarts)
 * - Accessible from host for native browser authentication
 */

// Use config directory (mounted in Docker) for persistence
const DATA_DIR = path.join(__dirname, '../../config/browsers');
const CONFIG_FILE = path.join(DATA_DIR, 'browsers.json');

// Default port range for CDP debugging
const DEFAULT_PORT_START = 9222;
const DEFAULT_PORT_END = 9299;

// Detect if running in Docker
const isDocker = () => {
  try {
    require('fs').accessSync('/.dockerenv');
    return true;
  } catch {
    return process.env.DOCKER === 'true';
  }
};

// Track active browser instances
const activeBrowsers = new Map();

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

async function loadConfig() {
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
 * Check if a port is available
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
    running: activeBrowsers.has(id)
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
    running: activeBrowsers.has(id),
    authenticated: await checkAuthentication(id)
  };
}

/**
 * Create a new browser profile
 */
async function createBrowser(id, options = {}) {
  const { name, description = '', port: requestedPort, autoAssignPort = true } = options;

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
  if (activeBrowsers.has(id)) {
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
 * Get browser status
 */
async function getBrowserStatus(id) {
  const config = await loadConfig();
  const browser = config.browsers[id];

  if (!browser) {
    return { success: false, error: 'Browser profile not found' };
  }

  return {
    success: true,
    id,
    name: browser.name,
    running: activeBrowsers.has(id),
    authenticated: await checkAuthentication(id)
  };
}

/**
 * Launch browser for authentication
 */
async function launchBrowser(id, options = {}) {
  const { url = 'about:blank' } = options;

  // Prevent GUI browser launch inside Docker
  if (isDocker()) {
    return {
      success: false,
      error: 'Cannot launch browser GUI inside Docker. Run void-server natively to authenticate browsers, then use Docker for deployment.',
      isDocker: true
    };
  }

  const chromium = await getPlaywright();
  if (!chromium) {
    return { success: false, error: 'Playwright not installed. Run: npm install playwright' };
  }

  if (activeBrowsers.has(id)) {
    return { success: false, error: 'Browser is already running' };
  }

  const config = await loadConfig();
  const browser = config.browsers[id];

  if (!browser) {
    return { success: false, error: 'Browser profile not found' };
  }

  const profileDir = path.join(DATA_DIR, id);
  await fs.mkdir(profileDir, { recursive: true });

  // Build launch args
  const args = [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process'
  ];

  // Add CDP debugging port if configured
  if (browser.port) {
    args.push(`--remote-debugging-port=${browser.port}`);
  }

  console.log(`🌐 Launching browser: ${id}${browser.port ? ` (CDP port ${browser.port})` : ''}`);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args
  });

  // Navigate to URL
  const page = context.pages()[0] || await context.newPage();
  if (url !== 'about:blank') {
    await page.goto(url);
  }

  // Store reference with port info
  activeBrowsers.set(id, { context, page, port: browser.port });

  // Set up close handler
  context.on('close', () => {
    console.log(`🌐 Browser closed: ${id}`);
    activeBrowsers.delete(id);
  });

  return { success: true, message: 'Browser launched', port: browser.port };
}

/**
 * Close a running browser
 */
async function closeBrowser(id) {
  const instance = activeBrowsers.get(id);

  if (!instance) {
    return { success: false, error: 'Browser is not running' };
  }

  console.log(`🌐 Closing browser: ${id}`);

  await instance.context.close();
  activeBrowsers.delete(id);

  return { success: true };
}

/**
 * Get a browser context for plugin use (headless)
 */
async function getBrowserContext(id) {
  const chromium = await getPlaywright();
  if (!chromium) {
    throw new Error('Playwright not installed');
  }

  const profileDir = path.join(DATA_DIR, id);

  // Check if profile exists
  const exists = await fs.access(profileDir).then(() => true).catch(() => false);
  if (!exists) {
    throw new Error(`Browser profile not found: ${id}`);
  }

  // Launch headless context with the profile
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  return context;
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
  if (activeBrowsers.has(id)) {
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
  isDocker,
  DATA_DIR
};
