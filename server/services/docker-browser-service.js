/**
 * Docker Browser Service
 *
 * Manages browser sidecar containers for web-based browser access in Docker.
 * Uses void-browser image (Chromium + noVNC) for browser authentication.
 * This image serves noVNC over HTTP (no SSL cert required for iframe embedding).
 */

const path = require('path');

// Dockerode for Docker API (lazy loaded)
let Docker = null;
let docker = null;

const CONTAINER_PREFIX = 'void-browser-';
const DEFAULT_IMAGE = process.env.BROWSER_CONTAINER_IMAGE || 'void-browser:latest';
const NOVNC_PORT = parseInt(process.env.BROWSER_NOVNC_PORT || '6080', 10);

// Track active containers
const activeContainers = new Map();

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
 * Get ports currently used by browser containers
 */
async function getUsedPorts() {
  const dockerClient = await getDocker();
  const containers = await dockerClient.listContainers({
    all: false, // only running containers
    filters: { label: ['void-server=browser-sidecar'] }
  });

  const usedPorts = new Set();
  for (const container of containers) {
    const ports = container.Ports || [];
    for (const p of ports) {
      if (p.PublicPort) usedPorts.add(p.PublicPort);
    }
  }
  return usedPorts;
}

/**
 * Find an available port starting from the base port
 */
async function findAvailablePort(startPort) {
  const usedPorts = await getUsedPorts();
  let port = startPort;
  while (port < startPort + 100) {
    if (!usedPorts.has(port)) return port;
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
 * Detect if void-server is running inside Docker
 */
function isRunningInDocker() {
  try {
    require('fs').accessSync('/.dockerenv');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the data directory path (for volume mounting)
 * When running natively, use the actual host path
 * When running in Docker, use BROWSER_DATA_PATH env var (set to host path)
 */
function getDataDir() {
  // Explicit override always wins
  if (process.env.BROWSER_DATA_PATH) {
    return process.env.BROWSER_DATA_PATH;
  }

  // When running natively, use the actual path on disk
  if (!isRunningInDocker()) {
    return path.resolve(__dirname, '../../data/browsers');
  }

  // When running in Docker, default to container path
  // (user should set BROWSER_DATA_PATH to host path for volume mounts to work)
  return '/app/data/browsers';
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
      return {
        success: true,
        novncPort: tracked?.port || NOVNC_PORT,
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

  // Create container with void-browser configuration
  // This image serves noVNC over HTTP on port 6080 (no SSL cert issues)
  const container = await docker.createContainer({
    Image: DEFAULT_IMAGE,
    name: containerName,
    Env: [
      'VNC_PASSWORD=voidserver',
      'RESOLUTION=1280x800x24',
      // Open URL on startup if provided
      ...(url ? [`LAUNCH_URL=${url}`] : [])
    ],
    HostConfig: {
      PortBindings: {
        '6080/tcp': [{ HostPort: String(port) }]
      },
      // Use compose network when running in Docker, bridge when native
      // Note: Docker Compose prefixes network names with project name
      NetworkMode: isRunningInDocker() ? (process.env.DOCKER_NETWORK || 'void-server_void-network') : 'bridge',
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

  console.log(`🌐 Started browser container for ${profileId} on port ${port}`);

  return {
    success: true,
    novncPort: port,
    containerId: container.id
  };
}

/**
 * Stop a browser container
 */
async function stopBrowserContainer(profileId) {
  const docker = await getDocker();
  const containerName = `${CONTAINER_PREFIX}${profileId}`;

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
    novncPort: status.port
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
