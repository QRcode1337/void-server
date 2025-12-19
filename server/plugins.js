/**
 * Plugin Management Module
 * Handles plugin installation, removal, enabling/disabling, and configuration
 * Uses functional programming patterns (no classes)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawnSync } = require('child_process');
const AdmZip = require('adm-zip');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(PROJECT_ROOT, 'config');
const CORE_PLUGINS_DIR = path.join(PROJECT_ROOT, 'plugins');
const USER_PLUGINS_DIR = path.join(PROJECT_ROOT, 'data', 'plugins');
const PLUGINS_DIR = CORE_PLUGINS_DIR; // Backward compatibility alias
const PLUGINS_CONFIG_PATH = path.join(CONFIG_DIR, 'plugins.json');
const PLUGINS_MANIFEST_PATH = path.join(CORE_PLUGINS_DIR, 'manifest.json');

// Built-in plugins that ship with void-server and cannot be uninstalled
const BUILT_IN_PLUGINS = [
  'void-plugin-ascii',
  'void-plugin-verify',
  'void-plugin-wallet'
];

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// ============================================================================
// Config Management
// ============================================================================

/**
 * Load plugin configuration from disk
 * @returns {Object} Plugin configuration object
 */
const loadConfig = () => {
  if (!fs.existsSync(PLUGINS_CONFIG_PATH)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(PLUGINS_CONFIG_PATH, 'utf8'));
};

/**
 * Save plugin configuration to disk
 * @param {Object} config - Configuration to save
 */
const saveConfig = (config) => {
  fs.writeFileSync(PLUGINS_CONFIG_PATH, JSON.stringify(config, null, 2));
};

/**
 * Load the global plugin manifest (available plugins catalog)
 * @returns {Object} Manifest with version and plugins
 */
const loadManifest = () => {
  if (!fs.existsSync(PLUGINS_MANIFEST_PATH)) {
    return { version: null, plugins: {} };
  }
  return JSON.parse(fs.readFileSync(PLUGINS_MANIFEST_PATH, 'utf8'));
};

/**
 * Load manifest.json from a specific plugin directory
 * @param {string} pluginPath - Path to plugin directory
 * @returns {Object|null} Plugin manifest or null if not found
 */
const loadPluginManifest = (pluginPath) => {
  const manifestPath = path.join(pluginPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
};

// ============================================================================
// Installation Type Detection
// ============================================================================

/**
 * Check if a path is a symlink
 * @param {string} pluginPath - Path to check
 * @returns {boolean}
 */
const isSymlink = (pluginPath) => {
  try {
    if (!fs.existsSync(pluginPath)) return false;
    return fs.lstatSync(pluginPath).isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * Check if a plugin is a git submodule
 * @param {string} pluginName - Plugin name
 * @returns {boolean}
 */
const isSubmodule = (pluginName) => {
  const gitmodulesPath = path.join(PROJECT_ROOT, '.gitmodules');
  if (!fs.existsSync(gitmodulesPath)) return false;
  const gitmodules = fs.readFileSync(gitmodulesPath, 'utf8');
  return gitmodules.includes(`plugins/${pluginName}`);
};

/**
 * Get the directory where a plugin is installed
 * @param {string} pluginName - Plugin name
 * @returns {string|null} Full path to plugin directory, or null if not found
 */
const getPluginPath = (pluginName) => {
  // Check core plugins first
  const corePath = path.join(CORE_PLUGINS_DIR, pluginName);
  if (fs.existsSync(corePath)) return corePath;

  // Check user plugins
  const userPath = path.join(USER_PLUGINS_DIR, pluginName);
  if (fs.existsSync(userPath)) return userPath;

  return null;
};

/**
 * Check if a plugin is a user-installed plugin (in data/plugins)
 * @param {string} pluginName - Plugin name
 * @returns {boolean}
 */
const isUserPlugin = (pluginName) => {
  const userPath = path.join(USER_PLUGINS_DIR, pluginName);
  return fs.existsSync(userPath);
};

/**
 * Get the installation type of a plugin
 * @param {string} pluginName - Plugin name
 * @returns {'symlink'|'submodule'|'directory'|null}
 */
const getInstallationType = (pluginName) => {
  const pluginPath = getPluginPath(pluginName);
  if (!pluginPath) return null;
  if (isSymlink(pluginPath)) return 'symlink';
  if (isSubmodule(pluginName)) return 'submodule';
  return 'directory';
};

/**
 * Check if plugins directory has any symlinks (dev mode indicator)
 * @returns {boolean}
 */
const isDevMode = () => {
  try {
    if (!fs.existsSync(PLUGINS_DIR)) return false;
    const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
    return entries.some(entry => {
      if (!entry.name.startsWith('void-plugin-')) return false;
      try {
        return fs.lstatSync(path.join(PLUGINS_DIR, entry.name)).isSymbolicLink();
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate plugin name format
 * @param {string} name - Plugin name to validate
 * @returns {{valid: boolean, error?: string}}
 */
const validatePluginName = (name) => {
  if (!name) {
    return { valid: false, error: 'Plugin name is required' };
  }
  if (!/^void-plugin-[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: 'Plugin name must match pattern: void-plugin-[a-z0-9-]+' };
  }
  if (name.includes('..') || name.includes('/')) {
    return { valid: false, error: 'Plugin name contains invalid characters' };
  }
  return { valid: true };
};

/**
 * Validate git URL format
 * @param {string} url - URL to validate
 * @returns {{valid: boolean, error?: string}}
 */
const validateGitUrl = (url) => {
  if (!url) {
    return { valid: false, error: 'Git URL is required' };
  }

  const sshPattern = /^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9._/-]+\.git$/;
  const httpsPattern = /^https:\/\/[a-zA-Z0-9.-]+\/[a-zA-Z0-9._/-]+(?:\.git)?$/;

  if (sshPattern.test(url) || httpsPattern.test(url)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid git URL format. Use SSH (git@...) or HTTPS (https://...)' };
};

/**
 * Extract plugin name from git URL
 * @param {string} url - Git URL
 * @returns {string} Plugin name
 */
const extractPluginName = (url) => {
  // Remove .git suffix and get basename
  return path.basename(url.replace(/\.git$/, ''));
};

// ============================================================================
// Plugin Listing
// ============================================================================

/**
 * Scan a directory for plugins and return their info
 * @param {string} dir - Directory to scan
 * @param {Object} config - Plugin config object
 * @param {Object} manifest - Plugin manifest object
 * @param {boolean} isUserDir - Whether this is the user plugins directory
 * @returns {Array} Array of plugin objects
 */
const scanPluginsDir = (dir, config, manifest, isUserDir = false) => {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.name.startsWith('void-plugin-'))
    .map(entry => {
      const name = entry.name;
      const pluginPath = path.join(dir, name);

      // Skip if not a real directory (broken symlink, etc.)
      try {
        const lstat = fs.lstatSync(pluginPath);
        if (lstat.isSymbolicLink()) {
          // Try to resolve symlink - may fail on Windows
          try {
            const realPath = fs.realpathSync(pluginPath);
            if (!fs.existsSync(realPath)) return null;
          } catch {
            // Symlink resolution failed, skip this entry
            return null;
          }
        } else if (!lstat.isDirectory()) {
          return null;
        }
      } catch {
        // lstat failed, skip this entry
        return null;
      }

      try {
        const pluginManifest = loadPluginManifest(pluginPath);
        const pluginConfig = config[name] || {};
        const catalogEntry = manifest.plugins?.[name];

        return {
          name,
          installed: true,
          enabled: pluginConfig.enabled !== false, // default true
          builtIn: BUILT_IN_PLUGINS.includes(name),
          userInstalled: isUserDir,
          installationType: getInstallationType(name),
          version: pluginManifest?.version || 'unknown',
          description: pluginManifest?.description || catalogEntry?.description || '',
          installedAt: pluginConfig.installedAt,
          installedFrom: pluginConfig.installedFrom || (isUserDir ? 'user' : 'core'),
          mountPath: pluginConfig.mountPath || pluginManifest?.defaultMountPath,
          navConfig: pluginConfig.navConfig || {
            navSection: pluginManifest?.nav?.section ?? null,
            navTitle: pluginManifest?.nav?.title || name.replace('void-plugin-', ''),
            navIcon: pluginManifest?.nav?.icon || 'box'
          }
        };
      } catch (err) {
        console.error(`Failed to load plugin ${name}:`, err.message);
        return null;
      }
    })
    .filter(Boolean);
};

/**
 * List all installed plugins with their status
 * @returns {Array} Array of installed plugin objects
 */
const listInstalledPlugins = () => {
  const config = loadConfig();
  const manifest = loadManifest();

  // Scan both core and user plugin directories
  const corePlugins = scanPluginsDir(CORE_PLUGINS_DIR, config, manifest, false);
  const userPlugins = scanPluginsDir(USER_PLUGINS_DIR, config, manifest, true);

  // Merge, with core plugins taking precedence if somehow duplicated
  const seen = new Set(corePlugins.map(p => p.name));
  const filteredUserPlugins = userPlugins.filter(p => !seen.has(p.name));

  return [...corePlugins, ...filteredUserPlugins];
};

/**
 * List available plugins from manifest that are not installed
 * @returns {Array} Array of available plugin objects
 */
const listAvailablePlugins = () => {
  const manifest = loadManifest();
  const installedNames = new Set(listInstalledPlugins().map(p => p.name));

  return Object.entries(manifest.plugins || {})
    .filter(([name]) => !installedNames.has(name))
    .map(([name, info]) => ({
      name,
      installed: false,
      description: info.description || '',
      repository: info.repository,
      branch: info.branch || 'main',
      category: info.category || 'plugins',
      icon: info.icon || 'box',
      author: info.author || 'unknown'
    }));
};

// ============================================================================
// Git Operations
// ============================================================================

/**
 * Execute a git command and return result
 * @param {Array} args - Git command arguments
 * @param {Object} options - Options for spawnSync
 * @returns {{success: boolean, stdout?: string, stderr?: string, error?: string}}
 */
const execGit = (args, options = {}) => {
  const result = spawnSync('git', args, {
    cwd: options.cwd || PROJECT_ROOT,
    encoding: 'utf8',
    windowsHide: true,
    ...options
  });

  if (result.status !== 0) {
    return {
      success: false,
      error: result.stderr?.trim() || result.error?.message || 'Git command failed',
      stderr: result.stderr
    };
  }

  return { success: true, stdout: result.stdout?.trim() };
};

// ============================================================================
// Plugin Installation
// ============================================================================

/**
 * Check if a URL is a zip file
 * @param {string} url - URL to check
 * @returns {boolean}
 */
const isZipUrl = (url) => {
  return url.endsWith('.zip') || url.includes('/archive/');
};

/**
 * Check if a URL is a git repository
 * @param {string} url - URL to check
 * @returns {boolean}
 */
const isGitUrl = (url) => {
  return url.startsWith('git@') ||
         url.endsWith('.git') ||
         (url.includes('github.com') && !isZipUrl(url));
};

/**
 * Build GitHub release zip URL from repository URL and version
 * @param {string} repoUrl - GitHub repository URL
 * @param {string} version - Version tag (e.g., "1.0.0")
 * @returns {string} Release zip URL
 */
const buildReleaseUrl = (repoUrl, version) => {
  // Convert git@github.com:user/repo.git to https://github.com/user/repo
  let baseUrl = repoUrl
    .replace('git@github.com:', 'https://github.com/')
    .replace(/\.git$/, '');

  return `${baseUrl}/archive/refs/tags/v${version}.zip`;
};

/**
 * Download a file from URL using Node.js native https (cross-platform)
 * @param {string} url - URL to download
 * @param {string} destPath - Destination file path
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const downloadFile = (url, destPath) => {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    let redirectCount = 0;
    const maxRedirects = 10;

    const makeRequest = (requestUrl) => {
      protocol.get(requestUrl, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            file.close();
            fs.unlinkSync(destPath);
            return resolve({ success: false, error: 'Too many redirects' });
          }
          const redirectUrl = response.headers.location.startsWith('http')
            ? response.headers.location
            : new URL(response.headers.location, requestUrl).href;
          return makeRequest(redirectUrl);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          return resolve({ success: false, error: `HTTP ${response.statusCode}: ${response.statusMessage}` });
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          // Verify file exists and has content
          if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
            return resolve({ success: false, error: 'Downloaded file is empty or missing' });
          }
          resolve({ success: true });
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        resolve({ success: false, error: `Download error: ${err.message}` });
      });
    };

    makeRequest(url);
  });
};

/**
 * Extract a zip file using AdmZip (cross-platform)
 * @param {string} zipPath - Path to zip file
 * @param {string} destDir - Destination directory
 * @returns {{success: boolean, extractedDir?: string, error?: string}}
 */
const extractZip = (zipPath, destDir) => {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);

  // Find the extracted directory (usually repo-name-version/)
  const entries = fs.readdirSync(destDir);
  const extractedDir = entries.find(e =>
    fs.statSync(path.join(destDir, e)).isDirectory()
  );

  return { success: true, extractedDir };
};

/**
 * Move directory across filesystems (copy + delete)
 * fs.renameSync fails with EXDEV when moving across different filesystems (e.g., Docker volumes)
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
const moveDirectory = (src, dest) => {
  // Use cpSync with recursive option (Node 16.7+)
  fs.cpSync(src, dest, { recursive: true });
  fs.rmSync(src, { recursive: true, force: true });
};

/**
 * Install plugin from zip URL
 * @param {string} zipUrl - URL to zip file
 * @param {string} pluginName - Target plugin name
 * @param {string} pluginPath - Target installation path
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const installFromZip = async (zipUrl, pluginName, pluginPath) => {
  // Use temp directory on same volume as destination to avoid cross-device issues
  const tempDir = path.join(USER_PLUGINS_DIR, '.temp-install');
  const zipFile = path.join(tempDir, 'plugin.zip');

  // Ensure user plugins directory exists
  if (!fs.existsSync(USER_PLUGINS_DIR)) {
    fs.mkdirSync(USER_PLUGINS_DIR, { recursive: true });
  }

  // Create temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // Download zip
  console.log(`📥 Downloading plugin from ${zipUrl}`);
  const downloadResult = await downloadFile(zipUrl, zipFile);
  if (!downloadResult.success) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { success: false, error: `Download failed: ${downloadResult.error}` };
  }

  // Extract zip
  console.log(`📦 Extracting plugin...`);
  const extractResult = extractZip(zipFile, tempDir);
  if (!extractResult.success) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return { success: false, error: `Extraction failed: ${extractResult.error}` };
  }

  // Move extracted directory to final location
  const extractedPath = path.join(tempDir, extractResult.extractedDir);
  moveDirectory(extractedPath, pluginPath);

  // Cleanup temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });

  return { success: true };
};

/**
 * Install plugin from git repository to a specific path
 * @param {string} gitUrl - Git repository URL
 * @param {string} pluginName - Target plugin name
 * @param {string} branch - Git branch
 * @param {string} pluginPath - Target installation path
 * @returns {{success: boolean, error?: string}}
 */
const installFromGitToPath = (gitUrl, pluginName, branch, pluginPath) => {
  // Clone repository (not as submodule for simpler management)
  console.log(`📥 Cloning plugin from ${gitUrl}`);
  const cloneResult = spawnSync('git', ['clone', '--depth', '1', '-b', branch, gitUrl, pluginPath], {
    encoding: 'utf8',
    cwd: path.dirname(pluginPath),
    windowsHide: true
  });

  if (cloneResult.status !== 0) {
    return { success: false, error: cloneResult.stderr || 'Git clone failed' };
  }

  // Remove .git directory to make it a plain directory (not a submodule)
  const gitDir = path.join(pluginPath, '.git');
  if (fs.existsSync(gitDir)) {
    fs.rmSync(gitDir, { recursive: true, force: true });
  }

  return { success: true };
};

/**
 * Install a plugin from manifest, git URL, or zip URL
 * @param {string} source - Plugin name from manifest, git URL, or zip URL
 * @param {Object} options - Installation options
 * @param {string} options.branch - Git branch (default: main)
 * @param {string} options.name - Override plugin name
 * @returns {Promise<{success: boolean, plugin?: string, requiresRestart?: boolean, message?: string, error?: string}>}
 */
const installPlugin = async (source, options = {}) => {
  const manifest = loadManifest();
  const isUrl = source.includes('://') || source.includes('@');

  let pluginName, installSource, version;

  if (isUrl) {
    // Installing from URL (git or zip)
    if (isZipUrl(source)) {
      // Extract plugin name from zip URL
      // e.g., https://github.com/user/void-plugin-example/archive/refs/tags/v1.0.0.zip
      const match = source.match(/\/(void-plugin-[a-z0-9-]+)\//i);
      pluginName = options.name || (match ? match[1] : null);
      if (!pluginName) {
        return { success: false, error: 'Could not determine plugin name from URL. Use the name option.' };
      }
      installSource = { type: 'zip', url: source };
    } else if (isGitUrl(source)) {
      pluginName = options.name || extractPluginName(source);
      installSource = { type: 'git', url: source, branch: options.branch || 'main' };
    } else {
      return { success: false, error: 'Invalid URL. Must be a git repository or zip file URL.' };
    }
  } else {
    // Install from manifest
    const catalogEntry = manifest.plugins?.[source];
    if (!catalogEntry) {
      return { success: false, error: `Plugin "${source}" not found in manifest` };
    }

    pluginName = source;
    version = catalogEntry.version;

    // Prefer release zip if version is specified
    if (version && catalogEntry.repository) {
      const releaseUrl = buildReleaseUrl(catalogEntry.repository, version);
      installSource = { type: 'zip', url: releaseUrl };
    } else if (catalogEntry.repository) {
      // Fallback to git clone
      installSource = { type: 'git', url: catalogEntry.repository, branch: catalogEntry.branch || 'main' };
    } else {
      return { success: false, error: `Plugin "${source}" has no repository URL` };
    }
  }

  // Validate plugin name
  const nameValidation = validatePluginName(pluginName);
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error };
  }

  // Check if already installed in either directory
  const existingPath = getPluginPath(pluginName);
  if (existingPath) {
    return { success: false, error: `Plugin "${pluginName}" is already installed` };
  }

  // Install to user plugins directory (data/plugins/)
  const pluginPath = path.join(USER_PLUGINS_DIR, pluginName);

  // Ensure user plugins directory exists
  if (!fs.existsSync(USER_PLUGINS_DIR)) {
    fs.mkdirSync(USER_PLUGINS_DIR, { recursive: true });
  }

  // Install based on source type
  let installResult;
  if (installSource.type === 'zip') {
    installResult = await installFromZip(installSource.url, pluginName, pluginPath);
  } else {
    installResult = installFromGitToPath(installSource.url, pluginName, installSource.branch, pluginPath);
  }

  if (!installResult.success) {
    // Cleanup on failure
    if (fs.existsSync(pluginPath)) {
      fs.rmSync(pluginPath, { recursive: true, force: true });
    }
    return { success: false, error: installResult.error };
  }

  // Load the plugin's manifest for defaults
  const pluginManifest = loadPluginManifest(pluginPath);

  // Update config
  const config = loadConfig();
  config[pluginName] = {
    enabled: true,
    mountPath: pluginManifest?.defaultMountPath || `/${pluginName.replace('void-plugin-', '')}`,
    installedAt: new Date().toISOString(),
    installedFrom: installSource.url,
    installedVersion: version || pluginManifest?.version || 'unknown',
    navConfig: {
      navSection: pluginManifest?.nav?.section ?? null,
      navTitle: pluginManifest?.nav?.title || pluginName.replace('void-plugin-', '').replace(/-/g, ' '),
      navIcon: pluginManifest?.nav?.icon || 'box'
    }
  };
  saveConfig(config);

  console.log(`✅ Plugin "${pluginName}" installed successfully`);

  return {
    success: true,
    plugin: pluginName,
    requiresRestart: true,
    message: `Plugin "${pluginName}" installed. Restart required to activate.`
  };
};

/**
 * Uninstall a plugin (remove directory or symlink)
 * @param {string} pluginName - Plugin name to uninstall
 * @returns {{success: boolean, plugin?: string, requiresRestart?: boolean, message?: string, error?: string}}
 */
const uninstallPlugin = (pluginName) => {
  // Validate name
  const nameValidation = validatePluginName(pluginName);
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error };
  }

  // Block uninstallation of built-in plugins
  if (BUILT_IN_PLUGINS.includes(pluginName)) {
    return { success: false, error: `Cannot uninstall built-in plugin "${pluginName}"` };
  }

  // Find plugin in either directory
  const pluginPath = getPluginPath(pluginName);

  if (!pluginPath) {
    return { success: false, error: `Plugin "${pluginName}" is not installed` };
  }

  const installationType = getInstallationType(pluginName);

  if (installationType === 'symlink') {
    // Just remove the symlink
    fs.unlinkSync(pluginPath);
  } else {
    // Regular directory - just remove it
    fs.rmSync(pluginPath, { recursive: true, force: true });
  }

  // Remove from config
  const config = loadConfig();
  delete config[pluginName];
  saveConfig(config);

  console.log(`🗑️ Plugin "${pluginName}" uninstalled`);

  return {
    success: true,
    plugin: pluginName,
    requiresRestart: true,
    message: `Plugin "${pluginName}" uninstalled. Restart required.`
  };
};

// ============================================================================
// Plugin Enable/Disable
// ============================================================================

/**
 * Enable or disable a plugin (keeps files, just toggles loading)
 * @param {string} pluginName - Plugin name
 * @param {boolean} enabled - Whether to enable or disable
 * @returns {{success: boolean, plugin?: string, enabled?: boolean, requiresRestart?: boolean, message?: string, error?: string}}
 */
const setPluginEnabled = (pluginName, enabled) => {
  // Validate name
  const nameValidation = validatePluginName(pluginName);
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error };
  }

  // Find plugin in either directory
  const pluginPath = getPluginPath(pluginName);

  if (!pluginPath) {
    return { success: false, error: `Plugin "${pluginName}" is not installed` };
  }

  const config = loadConfig();
  config[pluginName] = config[pluginName] || {};
  config[pluginName].enabled = enabled;
  saveConfig(config);

  return {
    success: true,
    plugin: pluginName,
    enabled,
    requiresRestart: true,
    message: `Plugin "${pluginName}" ${enabled ? 'enabled' : 'disabled'}. Restart required.`
  };
};

// ============================================================================
// Plugin Version Checking
// ============================================================================

/**
 * Fetch latest release version from GitHub API
 * @param {string} repoUrl - GitHub repository URL (git@ or https://)
 * @returns {Promise<{success: boolean, version?: string, releaseUrl?: string, error?: string}>}
 */
const fetchLatestVersion = (repoUrl) => {
  return new Promise((resolve) => {
    // Convert git URL to API URL
    // git@github.com:user/repo.git -> api.github.com/repos/user/repo/releases/latest
    // https://github.com/user/repo -> api.github.com/repos/user/repo/releases/latest
    let apiPath;
    if (repoUrl.startsWith('git@github.com:')) {
      apiPath = repoUrl.replace('git@github.com:', '').replace(/\.git$/, '');
    } else if (repoUrl.includes('github.com/')) {
      const match = repoUrl.match(/github\.com\/([^/]+\/[^/.]+)/);
      apiPath = match ? match[1] : null;
    }

    if (!apiPath) {
      return resolve({ success: false, error: 'Could not parse GitHub URL' });
    }

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${apiPath}/releases/latest`,
      headers: {
        'User-Agent': 'void-server',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (response) => {
      // Handle rate limiting
      if (response.statusCode === 403) {
        return resolve({ success: false, error: 'GitHub API rate limit exceeded' });
      }

      // Handle no releases
      if (response.statusCode === 404) {
        return resolve({ success: false, error: 'No releases found' });
      }

      if (response.statusCode !== 200) {
        return resolve({ success: false, error: `GitHub API returned ${response.statusCode}` });
      }

      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        const release = JSON.parse(data);
        const version = release.tag_name?.replace(/^v/, '') || null;
        resolve({
          success: true,
          version,
          releaseUrl: release.html_url,
          zipUrl: release.zipball_url
        });
      });
    }).on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
};

/**
 * Compare semantic versions
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
const compareVersions = (v1, v2) => {
  if (!v1 || !v2) return 0;

  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

/**
 * Check a single plugin for updates
 * @param {string} pluginName - Plugin name
 * @returns {Promise<{success: boolean, hasUpdate?: boolean, currentVersion?: string, latestVersion?: string, error?: string}>}
 */
const checkPluginUpdate = async (pluginName) => {
  const pluginPath = getPluginPath(pluginName);
  if (!pluginPath) {
    return { success: false, error: 'Plugin not found' };
  }

  const pluginManifest = loadPluginManifest(pluginPath);
  if (!pluginManifest) {
    return { success: false, error: 'Plugin manifest not found' };
  }

  const currentVersion = pluginManifest.version;

  // Get repository URL from config or manifest
  const config = loadConfig();
  const pluginConfig = config[pluginName] || {};
  let repoUrl = pluginConfig.installedFrom;

  // If no repo URL in config, try to find it in global manifest
  if (!repoUrl) {
    const globalManifest = loadManifest();
    repoUrl = globalManifest.plugins?.[pluginName]?.repository;
  }

  if (!repoUrl || (!repoUrl.includes('github.com') && !repoUrl.startsWith('git@github.com:'))) {
    return { success: false, error: 'No GitHub repository URL found for plugin' };
  }

  const latestResult = await fetchLatestVersion(repoUrl);
  if (!latestResult.success) {
    return { success: false, error: latestResult.error };
  }

  const hasUpdate = compareVersions(latestResult.version, currentVersion) > 0;

  return {
    success: true,
    hasUpdate,
    currentVersion,
    latestVersion: latestResult.version,
    releaseUrl: latestResult.releaseUrl
  };
};

/**
 * Check all installed plugins for updates
 * @returns {Promise<Array<{name: string, hasUpdate: boolean, currentVersion: string, latestVersion?: string, error?: string}>>}
 */
const checkAllPluginUpdates = async () => {
  const plugins = listInstalledPlugins();
  const results = [];

  for (const plugin of plugins) {
    // Skip built-in plugins (they update with void-server)
    if (plugin.builtIn) continue;

    const check = await checkPluginUpdate(plugin.name);
    results.push({
      name: plugin.name,
      hasUpdate: check.hasUpdate || false,
      currentVersion: check.currentVersion || plugin.version,
      latestVersion: check.latestVersion,
      releaseUrl: check.releaseUrl,
      error: check.error
    });
  }

  return results;
};

/**
 * Update a plugin to the latest version
 * @param {string} pluginName - Plugin name to update
 * @returns {Promise<{success: boolean, plugin?: string, oldVersion?: string, newVersion?: string, requiresRestart?: boolean, message?: string, error?: string}>}
 */
const updatePlugin = async (pluginName) => {
  const pluginPath = getPluginPath(pluginName);
  if (!pluginPath) {
    return { success: false, error: 'Plugin not found' };
  }

  // Block update of built-in plugins
  if (BUILT_IN_PLUGINS.includes(pluginName)) {
    return { success: false, error: 'Built-in plugins update with void-server' };
  }

  const pluginManifest = loadPluginManifest(pluginPath);
  const oldVersion = pluginManifest?.version || 'unknown';

  // Get repository URL
  const config = loadConfig();
  const pluginConfig = config[pluginName] || {};
  let repoUrl = pluginConfig.installedFrom;

  if (!repoUrl) {
    const globalManifest = loadManifest();
    repoUrl = globalManifest.plugins?.[pluginName]?.repository;
  }

  if (!repoUrl) {
    return { success: false, error: 'No repository URL found for plugin' };
  }

  // Fetch latest version
  const latestResult = await fetchLatestVersion(repoUrl);
  if (!latestResult.success) {
    return { success: false, error: `Could not fetch latest version: ${latestResult.error}` };
  }

  // Build release URL
  const releaseUrl = buildReleaseUrl(repoUrl, latestResult.version);

  // Backup old plugin data directory if it exists
  const pluginDataDir = path.join(pluginPath, 'data');
  const hasData = fs.existsSync(pluginDataDir);
  const tempDataBackup = hasData ? path.join(USER_PLUGINS_DIR, '.temp-data-backup') : null;

  if (hasData) {
    console.log(`📦 Backing up plugin data...`);
    if (fs.existsSync(tempDataBackup)) {
      fs.rmSync(tempDataBackup, { recursive: true, force: true });
    }
    fs.cpSync(pluginDataDir, tempDataBackup, { recursive: true });
  }

  // Remove old plugin
  console.log(`🗑️ Removing old version...`);
  fs.rmSync(pluginPath, { recursive: true, force: true });

  // Install new version
  console.log(`📥 Installing ${pluginName} v${latestResult.version}...`);
  const installResult = await installFromZip(releaseUrl, pluginName, pluginPath);

  if (!installResult.success) {
    // Attempt to restore on failure
    return { success: false, error: `Update failed: ${installResult.error}` };
  }

  // Restore data directory
  if (tempDataBackup && fs.existsSync(tempDataBackup)) {
    console.log(`📦 Restoring plugin data...`);
    fs.cpSync(tempDataBackup, pluginDataDir, { recursive: true });
    fs.rmSync(tempDataBackup, { recursive: true, force: true });
  }

  // Update config with new version
  config[pluginName] = config[pluginName] || {};
  config[pluginName].installedVersion = latestResult.version;
  config[pluginName].updatedAt = new Date().toISOString();
  saveConfig(config);

  console.log(`✅ Plugin "${pluginName}" updated to v${latestResult.version}`);

  return {
    success: true,
    plugin: pluginName,
    oldVersion,
    newVersion: latestResult.version,
    requiresRestart: true,
    message: `Plugin "${pluginName}" updated from v${oldVersion} to v${latestResult.version}. Restart required.`
  };
};

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Paths
  PROJECT_ROOT,
  CONFIG_DIR,
  PLUGINS_DIR,
  CORE_PLUGINS_DIR,
  USER_PLUGINS_DIR,
  PLUGINS_CONFIG_PATH,
  PLUGINS_MANIFEST_PATH,

  // Config
  loadConfig,
  saveConfig,
  loadManifest,
  loadPluginManifest,

  // Detection
  isSymlink,
  isSubmodule,
  getPluginPath,
  isUserPlugin,
  getInstallationType,
  isDevMode,

  // Validation
  validatePluginName,
  validateGitUrl,
  extractPluginName,

  // Listing
  listInstalledPlugins,
  listAvailablePlugins,

  // Operations
  installPlugin,
  uninstallPlugin,
  setPluginEnabled,

  // Version checking
  checkPluginUpdate,
  checkAllPluginUpdates,
  updatePlugin,
  compareVersions
};
