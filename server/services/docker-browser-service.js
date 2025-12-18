/**
 * Docker Browser Service
 *
 * Manages browser sidecar containers for web-based browser access in Docker.
 * Uses kasmweb/chromium image with noVNC for browser authentication.
 */

const path = require('path');
const net = require('net');

// Dockerode for Docker API (lazy loaded)
let Docker = null;
let docker = null;

const CONTAINER_PREFIX = 'void-browser-';
const DEFAULT_IMAGE = process.env.BROWSER_CONTAINER_IMAGE || 'kasmweb/chromium:1.15.0';
const NOVNC_PORT = parseInt(process.env.BROWSER_NOVNC_PORT || '6901', 10);
const IDLE_TIMEOUT_MS = parseInt(process.env.BROWSER_IDLE_TIMEOUT || '900000', 10); // 15 min

// Track active containers and their timeouts
const activeContainers = new Map();
const containerTimeouts = new Map();

/**
 * Get Docker socket path based on platform
 */
function getDockerSocketOptions() {
  // On Windows, use named pipe; on Unix, use socket file
  if (process.platform === 'win32') {
    return { socketPath: '//./pipe/docker_engine' };
  }
  return { socketPath: '/var/run/docker.sock' };
}

/**
 * Get Docker client instance (lazy loaded)
 */
async function getDocker() {
  if (!Docker) {
    Docker = require('dockerode');
    docker = new Docker(getDockerSocketOptions());
  }
  return docker;
}

/**
 * Check if Docker is accessible
 */
async function isDockerAvailable() {
  const dockerClient = await getDocker();
  const info = await dockerClient.ping();
  return info.toString() === 'OK';
}

/**
 * Check if a port is available on the host
 */
async function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '0.0.0.0');
  });
}

/**
 * Find an available port starting from the base port
 */
async function findAvailablePort(startPort) {
  let port = startPort;
  while (port < startPort + 100) {
    if (await isPortAvailable(port)) return port;
    port++;
  }
  throw new Error('No available ports found');
}

/**
 * Get container by name
 */
async function getContainerByName(name) {
  const docker = await getDocker();
  const containers = await docker.listContainers({ all: true });
  const match = containers.find(c => c.Names.includes(`/${name}`));
  return match ? docker.getContainer(match.Id) : null;
}

/**
 * Get the data directory path (for volume mounting)
 */
function getDataDir() {
  // When running in Docker, we need the host path for the volume mount
  // The container sees /app/data, but we need to mount the host's ./data directory
  return process.env.BROWSER_DATA_PATH || '/app/data/browsers';
}

/**
 * Schedule auto-timeout for container
 */
function scheduleTimeout(profileId) {
  // Clear any existing timeout
  if (containerTimeouts.has(profileId)) {
    clearTimeout(containerTimeouts.get(profileId));
  }

  const timeout = setTimeout(async () => {
    console.log(`⏱️ Auto-stopping idle browser: ${profileId}`);
    await stopBrowserContainer(profileId);
  }, IDLE_TIMEOUT_MS);

  containerTimeouts.set(profileId, timeout);
}

/**
 * Start a browser container for a specific profile
 */
async function startBrowserContainer(profileId, options = {}) {
  const { url = '' } = options;
  const docker = await getDocker();
  const containerName = `${CONTAINER_PREFIX}${profileId}`;

  // Check if already running
  const existing = await getContainerByName(containerName);
  if (existing) {
    const info = await existing.inspect();
    if (info.State.Running) {
      const tracked = activeContainers.get(profileId);
      // Reset the idle timeout
      scheduleTimeout(profileId);
      return {
        success: true,
        novncUrl: `http://localhost:${tracked?.port || NOVNC_PORT}`,
        message: 'Browser already running',
        containerId: existing.id
      };
    }
    // Remove stopped container
    await existing.remove();
  }

  // Find available port
  const port = await findAvailablePort(NOVNC_PORT);

  // Pull image if not present
  const images = await docker.listImages();
  const hasImage = images.some(img => img.RepoTags?.includes(DEFAULT_IMAGE));
  if (!hasImage) {
    console.log(`📦 Pulling browser image: ${DEFAULT_IMAGE}`);
    await new Promise((resolve, reject) => {
      docker.pull(DEFAULT_IMAGE, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
    console.log(`✅ Browser image pulled`);
  }

  // Create container with kasmweb configuration
  const container = await docker.createContainer({
    Image: DEFAULT_IMAGE,
    name: containerName,
    Env: [
      'VNC_PW=voidserver',
      'VNC_RESOLUTION=1280x800',
      `LAUNCH_URL=${url || 'about:blank'}`
    ],
    HostConfig: {
      Binds: [
        // Mount browsers data for profile persistence
        // Note: kasmweb stores profile in /home/kasm-user
        `${getDataDir()}/${profileId}:/home/kasm-user/.config/chromium`
      ],
      PortBindings: {
        '6901/tcp': [{ HostPort: String(port) }]
      },
      NetworkMode: 'void-network',
      ShmSize: 536870912 // 512MB shared memory for browser
    },
    Labels: {
      'void-server': 'browser-sidecar',
      'profile-id': profileId
    }
  });

  await container.start();

  // Track container
  activeContainers.set(profileId, {
    containerId: container.id,
    port,
    startedAt: Date.now()
  });

  // Set up idle timeout
  scheduleTimeout(profileId);

  console.log(`🌐 Started browser container for ${profileId} on port ${port}`);

  return {
    success: true,
    novncUrl: `http://localhost:${port}`,
    containerId: container.id,
    port
  };
}

/**
 * Stop a browser container
 */
async function stopBrowserContainer(profileId) {
  const docker = await getDocker();
  const containerName = `${CONTAINER_PREFIX}${profileId}`;

  // Clear timeout
  if (containerTimeouts.has(profileId)) {
    clearTimeout(containerTimeouts.get(profileId));
    containerTimeouts.delete(profileId);
  }

  const container = await getContainerByName(containerName);
  if (!container) {
    activeContainers.delete(profileId);
    return { success: false, error: 'Container not found' };
  }

  const info = await container.inspect();
  if (info.State.Running) {
    await container.stop({ t: 5 });
  }
  await container.remove();

  activeContainers.delete(profileId);

  console.log(`🌐 Stopped browser container for ${profileId}`);

  return { success: true };
}

/**
 * Get container status
 */
async function getBrowserContainerStatus(profileId) {
  const containerName = `${CONTAINER_PREFIX}${profileId}`;

  const container = await getContainerByName(containerName);
  if (!container) {
    return { running: false };
  }

  const info = await container.inspect();
  const tracked = activeContainers.get(profileId);

  return {
    running: info.State.Running,
    port: tracked?.port,
    startedAt: tracked?.startedAt,
    containerId: container.Id
  };
}

/**
 * Get noVNC URL for a running browser
 */
async function getNoVNCUrl(profileId) {
  const status = await getBrowserContainerStatus(profileId);
  if (!status.running) {
    return { success: false, error: 'Browser not running' };
  }
  return {
    success: true,
    novncUrl: `http://localhost:${status.port}`
  };
}

/**
 * Cleanup stale containers on startup
 */
async function cleanupStaleContainers() {
  const docker = await getDocker();
  const containers = await docker.listContainers({
    all: true,
    filters: { label: ['void-server=browser-sidecar'] }
  });

  for (const containerInfo of containers) {
    const container = docker.getContainer(containerInfo.Id);
    if (containerInfo.State === 'running') {
      await container.stop({ t: 5 });
    }
    await container.remove();
    console.log(`🧹 Cleaned up stale browser container: ${containerInfo.Names[0]}`);
  }
}

module.exports = {
  startBrowserContainer,
  stopBrowserContainer,
  getBrowserContainerStatus,
  getNoVNCUrl,
  cleanupStaleContainers,
  isDockerAvailable
};
