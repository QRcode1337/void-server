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
 * Install a plugin from manifest or git URL
 * @param {string} source - Plugin name from manifest or git URL
 * @param {Object} options - Installation options
 * @param {string} options.branch - Git branch (default: main)
 * @param {string} options.name - Override plugin name
 * @param {boolean} options.dev - Install as symlink (dev mode)
 * @returns {{success: boolean, plugin?: string, requiresRestart?: boolean, message?: string, error?: string}}
 */
const installPlugin = (source, options = {}) => {
  const manifest = loadManifest();
  const isUrl = source.includes('://') || source.includes('@');

  let gitUrl, pluginName, branch;

  if (isUrl) {
    const urlValidation = validateGitUrl(source);
    if (!urlValidation.valid) {
      return { success: false, error: urlValidation.error };
    }

    gitUrl = source;
    pluginName = options.name || extractPluginName(source);
    branch = options.branch || 'main';
  } else {
    // Install from manifest
    const catalogEntry = manifest.plugins?.[source];
    if (!catalogEntry) {
      return { success: false, error: `Plugin "${source}" not found in manifest` };
    }
    gitUrl = catalogEntry.repository;
    pluginName = source;
    branch = options.branch || catalogEntry.branch || 'main';
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

  // Add as git submodule
  const submodulePath = `plugins/${pluginName}`;

  const addResult = execGit(['submodule', 'add', '-b', branch, gitUrl, submodulePath]);
  if (!addResult.success) {
    return { success: false, error: `Failed to add submodule: ${addResult.error}` };
  }

  const initResult = execGit(['submodule', 'update', '--init', '--recursive', submodulePath]);
  if (!initResult.success) {
    // Try to clean up failed installation
    execGit(['rm', '-f', submodulePath]);
    return { success: false, error: `Failed to initialize submodule: ${initResult.error}` };
  }

  // Load the plugin's manifest for defaults
  const pluginManifest = loadPluginManifest(pluginPath);

  // Update config
  const config = loadConfig();
  config[pluginName] = {
    enabled: true,
    mountPath: pluginManifest?.defaultMountPath || `/${pluginName.replace('void-plugin-', '')}`,
    installedAt: new Date().toISOString(),
    installedFrom: isUrl ? gitUrl : 'manifest',
    navConfig: {
      navSection: pluginManifest?.nav?.section ?? null,
      navTitle: pluginManifest?.nav?.title || pluginName.replace('void-plugin-', '').replace(/-/g, ' '),
      navIcon: pluginManifest?.nav?.icon || 'box'
    }
  };
  saveConfig(config);

  return {
    success: true,
    plugin: pluginName,
    requiresRestart: true,
    message: `Plugin "${pluginName}" installed. Restart required to activate.`
  };
};

/**
 * Uninstall a plugin (remove submodule or symlink)
 * @param {string} pluginName - Plugin name to uninstall
 * @returns {{success: boolean, plugin?: string, requiresRestart?: boolean, message?: string, error?: string}}
 */
const uninstallPlugin = (pluginName) => {
  // Validate name
  const nameValidation = validatePluginName(pluginName);
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error };
  }

  const pluginPath = path.join(PLUGINS_DIR, pluginName);

  if (!fs.existsSync(pluginPath)) {
    return { success: false, error: `Plugin "${pluginName}" is not installed` };
  }

  const installationType = getInstallationType(pluginName);

  if (installationType === 'symlink') {
    // Just remove the symlink
    fs.unlinkSync(pluginPath);
  } else if (installationType === 'submodule') {
    // Properly remove git submodule
    const submodulePath = `plugins/${pluginName}`;

    // Deinitialize
    const deinitResult = execGit(['submodule', 'deinit', '-f', submodulePath]);
    if (!deinitResult.success) {
      console.warn(`Warning: Failed to deinit submodule: ${deinitResult.error}`);
    }

    // Remove from git
    const rmResult = execGit(['rm', '-f', submodulePath]);
    if (!rmResult.success) {
      console.warn(`Warning: Failed to git rm submodule: ${rmResult.error}`);
    }

    // Clean up .git/modules
    const gitModulesPath = path.join(PROJECT_ROOT, '.git', 'modules', submodulePath);
    if (fs.existsSync(gitModulesPath)) {
      fs.rmSync(gitModulesPath, { recursive: true, force: true });
    }

    // Ensure directory is removed
    if (fs.existsSync(pluginPath)) {
      fs.rmSync(pluginPath, { recursive: true, force: true });
    }
  } else {
    // Regular directory - just remove it
    fs.rmSync(pluginPath, { recursive: true, force: true });
  }

  // Remove from config
  const config = loadConfig();
  delete config[pluginName];
  saveConfig(config);

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
