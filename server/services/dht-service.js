/**
 * DHT Service
 *
 * Implements a Kademlia-style Distributed Hash Table for decentralized peer discovery.
 * Nodes are identified by their 256-bit ID (SHA-256 of public key).
 * Uses XOR distance metric for routing decisions.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../../data');
const DHT_DIR = path.join(DATA_DIR, 'federation');
const DHT_STATE_PATH = path.join(DHT_DIR, 'dht-state.json');
const BOOTSTRAP_PATH = path.join(DHT_DIR, 'bootstrap-nodes.json');

// DHT Constants
const K = 20; // K-bucket size (max peers per bucket)
const ALPHA = 3; // Parallel lookups
const ID_BITS = 256; // Node ID bit length
const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour
const NODE_TIMEOUT = 15 * 60 * 1000; // 15 minutes without response = stale

/**
 * Generate node ID from public key
 */
function generateNodeId(publicKey) {
  return crypto.createHash('sha256').update(publicKey).digest('hex');
}

/**
 * Calculate XOR distance between two node IDs
 */
function xorDistance(id1, id2) {
  const buf1 = Buffer.from(id1, 'hex');
  const buf2 = Buffer.from(id2, 'hex');
  const result = Buffer.alloc(32);

  for (let i = 0; i < 32; i++) {
    result[i] = buf1[i] ^ buf2[i];
  }

  return result.toString('hex');
}

/**
 * Get the bucket index for a given distance
 * Returns the index of the most significant bit
 */
function getBucketIndex(distance) {
  const buf = Buffer.from(distance, 'hex');

  for (let i = 0; i < 32; i++) {
    if (buf[i] !== 0) {
      // Find the most significant bit in this byte
      for (let j = 7; j >= 0; j--) {
        if ((buf[i] >> j) & 1) {
          return (i * 8) + (7 - j);
        }
      }
    }
  }

  return ID_BITS - 1; // Same node (distance = 0)
}

/**
 * Compare two distances (for sorting)
 */
function compareDistance(d1, d2) {
  const buf1 = Buffer.from(d1, 'hex');
  const buf2 = Buffer.from(d2, 'hex');

  for (let i = 0; i < 32; i++) {
    if (buf1[i] < buf2[i]) return -1;
    if (buf1[i] > buf2[i]) return 1;
  }

  return 0;
}

/**
 * Node entry in the routing table
 */
class DHTNode {
  constructor(nodeId, endpoint, publicKey, serverId) {
    this.nodeId = nodeId;
    this.endpoint = endpoint;
    this.publicKey = publicKey;
    this.serverId = serverId;
    this.lastSeen = Date.now();
    this.failedPings = 0;
  }

  touch() {
    this.lastSeen = Date.now();
    this.failedPings = 0;
  }

  isStale() {
    return Date.now() - this.lastSeen > NODE_TIMEOUT;
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      endpoint: this.endpoint,
      publicKey: this.publicKey,
      serverId: this.serverId,
      lastSeen: this.lastSeen,
      failedPings: this.failedPings
    };
  }

  static fromJSON(data) {
    const node = new DHTNode(data.nodeId, data.endpoint, data.publicKey, data.serverId);
    node.lastSeen = data.lastSeen || Date.now();
    node.failedPings = data.failedPings || 0;
    return node;
  }
}

/**
 * K-Bucket: stores up to K nodes at a specific distance range
 */
class KBucket {
  constructor(index) {
    this.index = index;
    this.nodes = [];
    this.lastRefresh = Date.now();
  }

  /**
   * Add or update a node in the bucket
   */
  addNode(node) {
    // Check if node already exists
    const existingIndex = this.nodes.findIndex(n => n.nodeId === node.nodeId);

    if (existingIndex >= 0) {
      // Move to end (most recently seen)
      this.nodes.splice(existingIndex, 1);
      this.nodes.push(node);
      return true;
    }

    // Bucket not full, add node
    if (this.nodes.length < K) {
      this.nodes.push(node);
      return true;
    }

    // Bucket full - check if oldest node is stale
    const oldest = this.nodes[0];
    if (oldest.isStale()) {
      this.nodes.shift();
      this.nodes.push(node);
      return true;
    }

    // Bucket full with active nodes, reject
    return false;
  }

  /**
   * Remove a node from the bucket
   */
  removeNode(nodeId) {
    const index = this.nodes.findIndex(n => n.nodeId === nodeId);
    if (index >= 0) {
      this.nodes.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId) {
    return this.nodes.find(n => n.nodeId === nodeId);
  }

  /**
   * Check if bucket needs refresh
   */
  needsRefresh() {
    return Date.now() - this.lastRefresh > REFRESH_INTERVAL;
  }

  toJSON() {
    return {
      index: this.index,
      nodes: this.nodes.map(n => n.toJSON()),
      lastRefresh: this.lastRefresh
    };
  }

  static fromJSON(data) {
    const bucket = new KBucket(data.index);
    bucket.nodes = (data.nodes || []).map(n => DHTNode.fromJSON(n));
    bucket.lastRefresh = data.lastRefresh || Date.now();
    return bucket;
  }
}

/**
 * DHT Routing Table
 */
class RoutingTable {
  constructor(localNodeId) {
    this.localNodeId = localNodeId;
    this.buckets = [];

    // Initialize all buckets
    for (let i = 0; i < ID_BITS; i++) {
      this.buckets.push(new KBucket(i));
    }
  }

  /**
   * Add a node to the routing table
   */
  addNode(node) {
    if (node.nodeId === this.localNodeId) {
      return false; // Don't add self
    }

    const distance = xorDistance(this.localNodeId, node.nodeId);
    const bucketIndex = getBucketIndex(distance);
    return this.buckets[bucketIndex].addNode(node);
  }

  /**
   * Remove a node from the routing table
   */
  removeNode(nodeId) {
    const distance = xorDistance(this.localNodeId, nodeId);
    const bucketIndex = getBucketIndex(distance);
    return this.buckets[bucketIndex].removeNode(nodeId);
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId) {
    const distance = xorDistance(this.localNodeId, nodeId);
    const bucketIndex = getBucketIndex(distance);
    return this.buckets[bucketIndex].getNode(nodeId);
  }

  /**
   * Find the K closest nodes to a target ID
   */
  findClosest(targetId, count = K) {
    const allNodes = this.getAllNodes();

    // Sort by XOR distance to target
    allNodes.sort((a, b) => {
      const distA = xorDistance(a.nodeId, targetId);
      const distB = xorDistance(b.nodeId, targetId);
      return compareDistance(distA, distB);
    });

    return allNodes.slice(0, count);
  }

  /**
   * Get all nodes in the routing table
   */
  getAllNodes() {
    const nodes = [];
    for (const bucket of this.buckets) {
      nodes.push(...bucket.nodes);
    }
    return nodes;
  }

  /**
   * Get count of all nodes
   */
  getNodeCount() {
    return this.buckets.reduce((sum, b) => sum + b.nodes.length, 0);
  }

  /**
   * Get buckets that need refresh
   */
  getBucketsNeedingRefresh() {
    return this.buckets.filter(b => b.needsRefresh() && b.nodes.length > 0);
  }

  toJSON() {
    return {
      localNodeId: this.localNodeId,
      buckets: this.buckets.map(b => b.toJSON())
    };
  }

  static fromJSON(data) {
    const table = new RoutingTable(data.localNodeId);
    if (data.buckets) {
      for (let i = 0; i < data.buckets.length && i < ID_BITS; i++) {
        table.buckets[i] = KBucket.fromJSON(data.buckets[i]);
      }
    }
    return table;
  }
}

class DHTService {
  constructor() {
    this.nodeId = null;
    this.routingTable = null;
    this.bootstrapNodes = [];
    this.federationService = null;
    this.refreshInterval = null;
    this.isBootstrapped = false;
  }

  /**
   * Initialize the DHT service
   */
  initialize(federationService) {
    this.federationService = federationService;

    // Generate node ID from server's public key
    this.nodeId = generateNodeId(federationService.identity.publicKey);

    // Load or create routing table
    this.loadState();

    // Load bootstrap nodes
    this.loadBootstrapNodes();

    console.log(`🌐 DHT initialized with node ID: ${this.nodeId.slice(0, 16)}...`);

    // Start periodic refresh
    this.startRefreshLoop();

    return this;
  }

  /**
   * Load DHT state from disk
   */
  loadState() {
    if (fs.existsSync(DHT_STATE_PATH)) {
      const data = JSON.parse(fs.readFileSync(DHT_STATE_PATH, 'utf8'));
      this.routingTable = RoutingTable.fromJSON(data);
      console.log(`🌐 Loaded DHT state: ${this.routingTable.getNodeCount()} nodes`);
    } else {
      this.routingTable = new RoutingTable(this.nodeId);
    }
  }

  /**
   * Save DHT state to disk
   */
  saveState() {
    if (!fs.existsSync(DHT_DIR)) {
      fs.mkdirSync(DHT_DIR, { recursive: true });
    }
    fs.writeFileSync(DHT_STATE_PATH, JSON.stringify(this.routingTable.toJSON(), null, 2));
  }

  /**
   * Load bootstrap nodes from config
   */
  loadBootstrapNodes() {
    // Default bootstrap nodes (can be overridden by config)
    const defaultBootstrap = [
      // Add official ClawedCode bootstrap nodes here when available
      // { endpoint: 'https://bootstrap1.clawedcode.com', name: 'ClawedCode Bootstrap 1' }
    ];

    if (fs.existsSync(BOOTSTRAP_PATH)) {
      const custom = JSON.parse(fs.readFileSync(BOOTSTRAP_PATH, 'utf8'));
      this.bootstrapNodes = [...defaultBootstrap, ...custom];
    } else {
      this.bootstrapNodes = defaultBootstrap;

      // Create default config
      if (!fs.existsSync(DHT_DIR)) {
        fs.mkdirSync(DHT_DIR, { recursive: true });
      }
      fs.writeFileSync(BOOTSTRAP_PATH, JSON.stringify([], null, 2));
    }

    console.log(`🌐 Loaded ${this.bootstrapNodes.length} bootstrap nodes`);
  }

  /**
   * Add a bootstrap node
   */
  addBootstrapNode(endpoint, name = null) {
    const existing = this.bootstrapNodes.find(n => n.endpoint === endpoint);
    if (!existing) {
      this.bootstrapNodes.push({ endpoint, name });
      fs.writeFileSync(BOOTSTRAP_PATH, JSON.stringify(this.bootstrapNodes, null, 2));
    }
  }

  /**
   * Bootstrap the DHT by connecting to bootstrap nodes
   */
  async bootstrap() {
    if (this.bootstrapNodes.length === 0) {
      console.log('🌐 No bootstrap nodes configured');
      return { success: true, contacted: 0, added: 0 };
    }

    console.log(`🌐 Bootstrapping DHT with ${this.bootstrapNodes.length} nodes...`);

    let contacted = 0;
    let added = 0;

    for (const bootstrap of this.bootstrapNodes) {
      const result = await this.pingNode(bootstrap.endpoint).catch(() => null);

      if (result) {
        contacted++;

        // Add to routing table
        const node = new DHTNode(
          generateNodeId(result.publicKey),
          bootstrap.endpoint,
          result.publicKey,
          result.serverId
        );

        if (this.routingTable.addNode(node)) {
          added++;
        }

        // Find nodes near us for better connectivity
        await this.findNode(this.nodeId).catch(() => null);
      }
    }

    this.isBootstrapped = contacted > 0;
    this.saveState();

    console.log(`🌐 Bootstrap complete: contacted ${contacted}, added ${added} nodes`);

    return { success: true, contacted, added };
  }

  /**
   * Ping a node to check if it's alive
   */
  async pingNode(endpoint) {
    const url = `${endpoint.replace(/\/$/, '')}/api/federation/ping`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromServerId: this.federationService.identity.serverId
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Ping failed: ${response.status}`);
    }

    const data = await response.json();

    // Update node in routing table if known
    const node = this.routingTable.getNode(generateNodeId(data.publicKey || ''));
    if (node) {
      node.touch();
    }

    return data;
  }

  /**
   * Find nodes close to a target ID (iterative lookup)
   */
  async findNode(targetId) {
    const closest = this.routingTable.findClosest(targetId, ALPHA);

    if (closest.length === 0) {
      return [];
    }

    const queried = new Set();
    const results = new Map();

    // Add initial closest nodes
    for (const node of closest) {
      results.set(node.nodeId, node);
    }

    // Iterative lookup
    let improved = true;
    while (improved) {
      improved = false;

      // Get ALPHA closest unqueried nodes
      const unqueried = Array.from(results.values())
        .filter(n => !queried.has(n.nodeId))
        .sort((a, b) => {
          const distA = xorDistance(a.nodeId, targetId);
          const distB = xorDistance(b.nodeId, targetId);
          return compareDistance(distA, distB);
        })
        .slice(0, ALPHA);

      if (unqueried.length === 0) break;

      // Query nodes in parallel
      const queries = unqueried.map(async node => {
        queried.add(node.nodeId);

        const url = `${node.endpoint.replace(/\/$/, '')}/api/federation/dht/find-node`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId,
            fromNodeId: this.nodeId,
            fromServerId: this.federationService.identity.serverId
          }),
          signal: AbortSignal.timeout(10000)
        }).catch(() => null);

        if (response?.ok) {
          const data = await response.json();
          node.touch();
          return data.nodes || [];
        }

        node.failedPings++;
        return [];
      });

      const allResults = await Promise.all(queries);

      for (const nodes of allResults) {
        for (const nodeData of nodes) {
          if (!results.has(nodeData.nodeId) && nodeData.nodeId !== this.nodeId) {
            const newNode = new DHTNode(
              nodeData.nodeId,
              nodeData.endpoint,
              nodeData.publicKey,
              nodeData.serverId
            );
            results.set(nodeData.nodeId, newNode);
            this.routingTable.addNode(newNode);
            improved = true;
          }
        }
      }
    }

    this.saveState();

    // Return K closest
    return Array.from(results.values())
      .sort((a, b) => {
        const distA = xorDistance(a.nodeId, targetId);
        const distB = xorDistance(b.nodeId, targetId);
        return compareDistance(distA, distB);
      })
      .slice(0, K);
  }

  /**
   * Announce this node to the network
   */
  async announce() {
    const nodes = this.routingTable.getAllNodes();

    if (nodes.length === 0) {
      console.log('🌐 No nodes to announce to');
      return { success: true, announced: 0 };
    }

    console.log(`🌐 Announcing to ${nodes.length} nodes...`);

    let announced = 0;

    const announcePromises = nodes.map(async node => {
      const url = `${node.endpoint.replace(/\/$/, '')}/api/federation/dht/announce`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: this.nodeId,
          endpoint: this.getLocalEndpoint(),
          publicKey: this.federationService.identity.publicKey,
          serverId: this.federationService.identity.serverId,
          capabilities: this.federationService.capabilities
        }),
        signal: AbortSignal.timeout(10000)
      }).catch(() => null);

      if (response?.ok) {
        node.touch();
        return true;
      }

      node.failedPings++;
      return false;
    });

    const results = await Promise.all(announcePromises);
    announced = results.filter(Boolean).length;

    this.saveState();
    console.log(`🌐 Announced to ${announced}/${nodes.length} nodes`);

    return { success: true, announced };
  }

  /**
   * Get the local endpoint URL
   */
  getLocalEndpoint() {
    // This should be configured - for now return localhost
    const port = process.env.PORT || 4420;
    return process.env.PUBLIC_URL || `http://localhost:${port}`;
  }

  /**
   * Handle incoming find-node request
   */
  handleFindNode(targetId, fromNodeId, fromEndpoint, fromPublicKey, fromServerId) {
    // Add requester to routing table
    if (fromNodeId && fromEndpoint) {
      const requester = new DHTNode(fromNodeId, fromEndpoint, fromPublicKey, fromServerId);
      this.routingTable.addNode(requester);
    }

    // Find closest nodes
    const closest = this.routingTable.findClosest(targetId, K);

    return closest.map(n => ({
      nodeId: n.nodeId,
      endpoint: n.endpoint,
      publicKey: n.publicKey,
      serverId: n.serverId
    }));
  }

  /**
   * Handle incoming announcement
   */
  handleAnnounce(nodeId, endpoint, publicKey, serverId, capabilities) {
    const node = new DHTNode(nodeId, endpoint, publicKey, serverId);
    node.capabilities = capabilities;

    const added = this.routingTable.addNode(node);

    if (added) {
      this.saveState();

      // Also add to federation peers
      this.federationService.addPeer({
        serverId,
        publicKey,
        capabilities
      }, endpoint);
    }

    return added;
  }

  /**
   * Start the periodic refresh loop
   */
  startRefreshLoop() {
    // Initial bootstrap after short delay
    setTimeout(() => {
      this.bootstrap().catch(console.error);
    }, 5000);

    // Periodic refresh
    this.refreshInterval = setInterval(() => {
      this.refresh().catch(console.error);
    }, REFRESH_INTERVAL);
  }

  /**
   * Stop the refresh loop
   */
  stopRefreshLoop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Refresh the routing table
   */
  async refresh() {
    console.log('🌐 Refreshing DHT...');

    // Refresh stale buckets
    const staleBuckets = this.routingTable.getBucketsNeedingRefresh();

    for (const bucket of staleBuckets) {
      // Generate random ID in bucket's range and search for it
      const randomId = crypto.randomBytes(32).toString('hex');
      await this.findNode(randomId).catch(() => null);
      bucket.lastRefresh = Date.now();
    }

    // Re-announce ourselves
    await this.announce().catch(() => null);

    // Remove dead nodes
    const allNodes = this.routingTable.getAllNodes();
    for (const node of allNodes) {
      if (node.failedPings >= 3) {
        this.routingTable.removeNode(node.nodeId);
      }
    }

    this.saveState();
    console.log(`🌐 DHT refresh complete: ${this.routingTable.getNodeCount()} nodes`);
  }

  /**
   * Get DHT status
   */
  getStatus() {
    return {
      nodeId: this.nodeId,
      nodeCount: this.routingTable.getNodeCount(),
      bootstrapNodes: this.bootstrapNodes.length,
      isBootstrapped: this.isBootstrapped,
      bucketStats: this.routingTable.buckets
        .map((b, i) => ({ index: i, count: b.nodes.length }))
        .filter(b => b.count > 0)
    };
  }

  /**
   * Get all known nodes
   */
  getNodes() {
    return this.routingTable.getAllNodes().map(n => ({
      nodeId: n.nodeId,
      endpoint: n.endpoint,
      publicKey: n.publicKey,
      serverId: n.serverId,
      lastSeen: n.lastSeen,
      isStale: n.isStale()
    }));
  }
}

// Singleton instance
let instance = null;

function getDHTService() {
  if (!instance) {
    instance = new DHTService();
  }
  return instance;
}

module.exports = {
  DHTService,
  getDHTService,
  generateNodeId,
  xorDistance,
  getBucketIndex,
  K,
  ALPHA
};
