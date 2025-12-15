/**
 * Plugin Management Module
 * Handles plugin installation, removal, enabling/disabling, and configuration
 * Uses functional programming patterns (no classes)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(PROJECT_ROOT, 'config');
const PLUGINS_DIR = path.join(PROJECT_ROOT, 'plugins');
const PLUGINS_CONFIG_PATH = path.join(CONFIG_DIR, 'plugins.json');
const PLUGINS_MANIFEST_PATH = path.join(PLUGINS_DIR, 'manifest.json');

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
  if (!fs.existsSync(pluginPath)) return false;
  return fs.lstatSync(pluginPath).isSymbolicLink();
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
 * Get the installation type of a plugin
 * @param {string} pluginName - Plugin name
 * @returns {'symlink'|'submodule'|'directory'|null}
 */
const getInstallationType = (pluginName) => {
  const pluginPath = path.join(PLUGINS_DIR, pluginName);
  if (!fs.existsSync(pluginPath)) return null;
  if (isSymlink(pluginPath)) return 'symlink';
  if (isSubmodule(pluginName)) return 'submodule';
  return 'directory';
};

/**
 * Check if plugins directory has any symlinks (dev mode indicator)
 * @returns {boolean}
 */
const isDevMode = () => {
  if (!fs.existsSync(PLUGINS_DIR)) return false;
  const entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  return entries.some(entry =>
    entry.name.startsWith('void-plugin-') &&
    fs.lstatSync(path.join(PLUGINS_DIR, entry.name)).isSymbolicLink()
  );
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
 * List all installed plugins with their status
 * @returns {Array} Array of installed plugin objects
 */
const listInstalledPlugins = () => {
  if (!fs.existsSync(PLUGINS_DIR)) return [];

  const config = loadConfig();
  const manifest = loadManifest();

  return fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(entry => entry.name.startsWith('void-plugin-'))
    .map(entry => {
      const name = entry.name;
      const pluginPath = path.join(PLUGINS_DIR, name);

      // Skip if not a real directory (broken symlink, etc.)
      let realPath;
      const lstat = fs.lstatSync(pluginPath);
      if (lstat.isSymbolicLink()) {
        realPath = fs.realpathSync(pluginPath);
        if (!fs.existsSync(realPath)) return null;
      } else if (!lstat.isDirectory()) {
        return null;
      }

      const pluginManifest = loadPluginManifest(pluginPath);
      const pluginConfig = config[name] || {};
      const catalogEntry = manifest.plugins?.[name];

      return {
        name,
        installed: true,
        enabled: pluginConfig.enabled !== false, // default true
        builtIn: BUILT_IN_PLUGINS.includes(name),
        installationType: getInstallationType(name),
        version: pluginManifest?.version || 'unknown',
        description: pluginManifest?.description || catalogEntry?.description || '',
        installedAt: pluginConfig.installedAt,
        installedFrom: pluginConfig.installedFrom || 'unknown',
        mountPath: pluginConfig.mountPath || pluginManifest?.defaultMountPath,
        navConfig: pluginConfig.navConfig || {
          navSection: pluginManifest?.nav?.section ?? null,
          navTitle: pluginManifest?.nav?.title || name.replace('void-plugin-', ''),
          navIcon: pluginManifest?.nav?.icon || 'box'
        }
      };
    })
    .filter(Boolean); // Remove nulls
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
 * Download a file from URL
 * @param {string} url - URL to download
 * @param {string} destPath - Destination file path
 * @returns {{success: boolean, error?: string}}
 */
const downloadFile = (url, destPath) => {
  const result = spawnSync('curl', ['-L', '-o', destPath, '-s', '--fail-with-body', '--max-time', '120', url], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    return { success: false, error: result.stderr || `curl exited with status ${result.status}` };
  }

  // Verify file exists and has content
  if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
    return { success: false, error: 'Downloaded file is empty or missing' };
  }

  return { success: true };
};

/**
 * Extract a zip file
 * @param {string} zipPath - Path to zip file
 * @param {string} destDir - Destination directory
 * @returns {{success: boolean, extractedDir?: string, error?: string}}
 */
const extractZip = (zipPath, destDir) => {
  const result = spawnSync('unzip', ['-o', '-q', zipPath, '-d', destDir], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    return { success: false, error: result.stderr || 'Extraction failed' };
  }

  // Find the extracted directory (usually repo-name-version/)
  const entries = fs.readdirSync(destDir);
  const extractedDir = entries.find(e =>
    fs.statSync(path.join(destDir, e)).isDirectory()
  );

  return { success: true, extractedDir };
};

/**
 * Install plugin from zip URL
 * @param {string} zipUrl - URL to zip file
 * @param {string} pluginName - Target plugin name
 * @param {string} pluginPath - Target installation path
 * @returns {{success: boolean, error?: string}}
 */
const installFromZip = (zipUrl, pluginName, pluginPath) => {
  const tempDir = path.join(PLUGINS_DIR, '.temp-install');
  const zipFile = path.join(tempDir, 'plugin.zip');

  // Create temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // Download zip
  console.log(`📥 Downloading plugin from ${zipUrl}`);
  const downloadResult = downloadFile(zipUrl, zipFile);
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
  fs.renameSync(extractedPath, pluginPath);

  // Cleanup temp directory
  fs.rmSync(tempDir, { recursive: true, force: true });

  return { success: true };
};

/**
 * Install plugin from git repository
 * @param {string} gitUrl - Git repository URL
 * @param {string} pluginName - Target plugin name
 * @param {string} branch - Git branch
 * @returns {{success: boolean, error?: string}}
 */
const installFromGit = (gitUrl, pluginName, branch) => {
  const pluginPath = path.join(PLUGINS_DIR, pluginName);

  // Clone repository (not as submodule for simpler management)
  console.log(`📥 Cloning plugin from ${gitUrl}`);
  const cloneResult = spawnSync('git', ['clone', '--depth', '1', '-b', branch, gitUrl, pluginPath], {
    encoding: 'utf8',
    cwd: PLUGINS_DIR
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
 * @returns {{success: boolean, plugin?: string, requiresRestart?: boolean, message?: string, error?: string}}
 */
const installPlugin = (source, options = {}) => {
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

  const pluginPath = path.join(PLUGINS_DIR, pluginName);

  // Check if already installed
  if (fs.existsSync(pluginPath)) {
    return { success: false, error: `Plugin "${pluginName}" is already installed` };
  }

  // Ensure plugins directory exists
  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  }

  // Install based on source type
  let installResult;
  if (installSource.type === 'zip') {
    installResult = installFromZip(installSource.url, pluginName, pluginPath);
  } else {
    installResult = installFromGit(installSource.url, pluginName, installSource.branch);
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

  const pluginPath = path.join(PLUGINS_DIR, pluginName);

  if (!fs.existsSync(pluginPath)) {
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

  const pluginPath = path.join(PLUGINS_DIR, pluginName);

  if (!fs.existsSync(pluginPath)) {
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
// Exports
// ============================================================================

module.exports = {
  // Paths
  PROJECT_ROOT,
  CONFIG_DIR,
  PLUGINS_DIR,
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
  setPluginEnabled
};
