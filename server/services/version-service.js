/**
 * Version Service
 * Checks for updates against GitHub releases
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_OWNER = 'ClawedCode';
const REPO_NAME = 'void-server';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const PACKAGE_JSON = path.resolve(__dirname, '../../package.json');

// Cache the latest version check (don't spam GitHub API)
let cachedLatestVersion = null;
let lastCheckTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get current version from package.json
 */
function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  return pkg.version;
}

/**
 * Fetch latest release from GitHub
 */
function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'void-server',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(GITHUB_API, options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const release = JSON.parse(data);
          resolve({
            version: release.tag_name.replace(/^v/, ''),
            url: release.html_url,
            name: release.name,
            publishedAt: release.published_at,
            body: release.body
          });
        } else if (res.statusCode === 404) {
          resolve(null); // No releases yet
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Compare version strings (semver)
 */
function compareVersions(current, latest) {
  const parseSemver = (v) => v.split('.').map(n => parseInt(n, 10) || 0);
  const c = parseSemver(current);
  const l = parseSemver(latest);

  for (let i = 0; i < 3; i++) {
    if (l[i] > c[i]) return 1;  // latest is newer
    if (l[i] < c[i]) return -1; // current is newer
  }
  return 0; // equal
}

/**
 * Check for updates (with caching)
 */
async function checkForUpdate() {
  const now = Date.now();
  const currentVersion = getCurrentVersion();

  // Return cached result if still valid
  if (cachedLatestVersion && (now - lastCheckTime) < CACHE_DURATION) {
    return {
      currentVersion,
      latestVersion: cachedLatestVersion.version,
      updateAvailable: compareVersions(currentVersion, cachedLatestVersion.version) > 0,
      releaseUrl: cachedLatestVersion.url,
      releaseName: cachedLatestVersion.name,
      cached: true
    };
  }

  // Fetch latest from GitHub
  const latest = await fetchLatestRelease();

  if (!latest) {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      error: 'No releases found'
    };
  }

  // Update cache
  cachedLatestVersion = latest;
  lastCheckTime = now;

  const updateAvailable = compareVersions(currentVersion, latest.version) > 0;

  return {
    currentVersion,
    latestVersion: latest.version,
    updateAvailable,
    releaseUrl: latest.url,
    releaseName: latest.name,
    publishedAt: latest.publishedAt,
    cached: false
  };
}

/**
 * Check if running in Docker container
 */
function isDocker() {
  // Check for Docker-specific files
  if (fs.existsSync('/.dockerenv')) return true;
  // Check cgroup for docker
  if (fs.existsSync('/proc/1/cgroup')) {
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
    if (cgroup.includes('docker') || cgroup.includes('kubepods')) return true;
  }
  return false;
}

/**
 * Run the update script
 */
function runUpdate() {
  return new Promise((resolve, reject) => {
    // Docker containers should be updated externally
    if (isDocker()) {
      reject(new Error('Docker installation detected. Update from host: docker compose down && git pull && docker compose up -d --build'));
      return;
    }

    const projectRoot = path.resolve(__dirname, '../..');
    const isWindows = process.platform === 'win32';

    // Try to find update script
    let updateScript;
    let command;
    let args;

    if (isWindows) {
      updateScript = path.join(projectRoot, 'update.ps1');
      command = 'powershell';
      args = ['-ExecutionPolicy', 'Bypass', '-File', updateScript];
    } else {
      updateScript = path.join(projectRoot, 'update.sh');
      command = 'bash';
      args = [updateScript];
    }

    if (!fs.existsSync(updateScript)) {
      reject(new Error(`Update script not found: ${updateScript}`));
      return;
    }

    console.log(`🔄 Running update script: ${updateScript}`);

    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Update completed successfully');
        resolve({ success: true, output: stdout });
      } else {
        console.log(`❌ Update failed with code ${code}`);
        reject(new Error(`Update failed: ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to run update: ${err.message}`));
    });
  });
}

/**
 * Clear the version cache (useful after update)
 */
function clearCache() {
  cachedLatestVersion = null;
  lastCheckTime = 0;
}

/**
 * Trigger Watchtower to check for and apply updates (Docker only)
 * Watchtower HTTP API: POST /v1/update with Authorization header
 */
function triggerWatchtowerUpdate() {
  return new Promise((resolve, reject) => {
    if (!isDocker()) {
      reject(new Error('Watchtower updates are only available in Docker'));
      return;
    }

    const watchtowerUrl = process.env.WATCHTOWER_URL || 'http://watchtower:8080';
    const watchtowerToken = process.env.WATCHTOWER_TOKEN || 'void-update-token';

    const url = new URL('/v1/update', watchtowerUrl);
    const http = require('http');

    const options = {
      hostname: url.hostname,
      port: url.port || 8080,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${watchtowerToken}`
      },
      timeout: 10000
    };

    console.log(`🔄 Triggering Watchtower update at ${watchtowerUrl}`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Watchtower update triggered successfully');
          resolve({
            success: true,
            message: 'Update triggered. Container will restart if a new image is available.',
            response: data
          });
        } else {
          console.log(`⚠️ Watchtower returned ${res.statusCode}: ${data}`);
          reject(new Error(`Watchtower returned ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Watchtower connection failed: ${err.message}`);
      reject(new Error(`Failed to connect to Watchtower: ${err.message}. Is Watchtower running?`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Watchtower request timed out'));
    });

    req.end();
  });
}

/**
 * Check if enabled user plugins are compiled into the client bundle
 * Returns list of plugins that need rebuild, or empty array if in sync
 */
function getPluginsNeedingRebuild() {
  const projectRoot = path.resolve(__dirname, '../..');
  const userPluginsDir = path.join(projectRoot, 'data/plugins');
  const pluginConfigPath = path.join(projectRoot, 'config/plugins.json');
  const bundleManifestPath = path.join(projectRoot, 'client/dist/.plugin-manifest.json');

  // Get enabled user plugins from filesystem and config
  const enabledUserPlugins = [];

  if (fs.existsSync(userPluginsDir)) {
    const entries = fs.readdirSync(userPluginsDir, { withFileTypes: true });
    const pluginConfig = fs.existsSync(pluginConfigPath)
      ? JSON.parse(fs.readFileSync(pluginConfigPath, 'utf8'))
      : {};

    for (const entry of entries) {
      if (!entry.name.startsWith('void-plugin-')) continue;

      const pluginPath = path.join(userPluginsDir, entry.name);
      const manifestPath = path.join(pluginPath, 'manifest.json');

      // Must have manifest with client entry
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!manifest.client?.entry) continue;

      // Check if enabled (default is enabled)
      const config = pluginConfig[entry.name] || {};
      if (config.enabled === false) continue;

      enabledUserPlugins.push(entry.name);
    }
  }

  // No user plugins = nothing to check
  if (enabledUserPlugins.length === 0) return [];

  // Check bundle manifest
  if (!fs.existsSync(bundleManifestPath)) {
    // No manifest = old build, all user plugins need rebuild
    return enabledUserPlugins;
  }

  const bundleManifest = JSON.parse(fs.readFileSync(bundleManifestPath, 'utf8'));
  const compiledPlugins = new Set(bundleManifest.plugins.map(p => p.name));

  // Find user plugins not in the compiled bundle
  return enabledUserPlugins.filter(name => !compiledPlugins.has(name));
}

/**
 * Rebuild the client bundle (for Docker plugin installations)
 * This allows newly installed plugins to be included in the client bundle
 */
function rebuildClient() {
  return new Promise((resolve, reject) => {
    const projectRoot = path.resolve(__dirname, '../..');
    const clientDir = path.join(projectRoot, 'client');

    // Check if client source exists (only in Docker with rebuild capability)
    const viteConfig = path.join(clientDir, 'vite.config.js');
    if (!fs.existsSync(viteConfig)) {
      reject(new Error('Client source not available. Rebuild only available in Docker.'));
      return;
    }

    console.log('🔨 Rebuilding client bundle...');

    const child = spawn('npm', ['run', 'build'], {
      cwd: clientDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=4096'
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Client rebuild completed successfully');
        resolve({ success: true, output: stdout });
      } else {
        console.log(`❌ Client rebuild failed with code ${code}`);
        reject(new Error(`Client rebuild failed: ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to run build: ${err.message}`));
    });
  });
}

module.exports = {
  getCurrentVersion,
  checkForUpdate,
  runUpdate,
  clearCache,
  compareVersions,
  isDocker,
  triggerWatchtowerUpdate,
  rebuildClient,
  getPluginsNeedingRebuild
};
