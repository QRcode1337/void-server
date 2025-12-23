/**
 * Peer Service
 *
 * Manages federation peers using Neo4j for persistent storage and trust graph relationships.
 * Provides health checking, trust level management, and peer scoring.
 */

const { getNeo4jService } = require('./neo4j-service');

// Trust levels in order of increasing trust
const TRUST_LEVELS = ['unknown', 'seen', 'verified', 'trusted', 'blocked'];

// Health check constants
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_CHECKS = 5;
const HEALTH_DECAY_RATE = 0.1;
const HEALTH_RECOVERY_RATE = 0.05;

class PeerService {
  constructor() {
    this.healthCheckInterval = null;
    this.federationService = null;
  }

  /**
   * Initialize with federation service reference
   */
  initialize(federationService) {
    this.federationService = federationService;
    this.startHealthChecks();
    console.log('🌐 Peer service initialized with Neo4j backend');
  }

  /**
   * Check if Neo4j is available
   */
  async isNeo4jAvailable() {
    const neo4j = getNeo4jService();
    return neo4j.connected || await neo4j.isAvailable();
  }

  /**
   * Create or update a peer in Neo4j
   */
  async upsertPeer(peer) {
    if (!await this.isNeo4jAvailable()) {
      console.log('⚠️ Neo4j not available, peer not persisted');
      return null;
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MERGE (p:FederationPeer {serverId: $serverId})
      SET p.publicKey = $publicKey,
          p.nodeId = $nodeId,
          p.endpoint = $endpoint,
          p.version = $version,
          p.capabilities = $capabilities,
          p.plugins = $plugins,
          p.trustLevel = $trustLevel,
          p.isProtected = $isProtected,
          p.healthScore = $healthScore,
          p.failedChecks = $failedChecks,
          p.lastSeen = datetime($lastSeen),
          p.addedAt = COALESCE(p.addedAt, datetime($addedAt)),
          p.verifiedAt = CASE WHEN $verifiedAt IS NOT NULL THEN datetime($verifiedAt) ELSE p.verifiedAt END,
          p.updatedAt = datetime()
      RETURN p
    `;

    const params = {
      serverId: peer.serverId,
      publicKey: peer.publicKey,
      nodeId: peer.nodeId || null,
      endpoint: peer.endpoint,
      version: peer.version || null,
      capabilities: peer.capabilities || [],
      plugins: JSON.stringify(peer.plugins || []),
      trustLevel: peer.trustLevel || 'unknown',
      isProtected: peer.isProtected || false,
      healthScore: peer.healthScore ?? 1.0,
      failedChecks: peer.failedChecks || 0,
      lastSeen: peer.lastSeen || new Date().toISOString(),
      addedAt: peer.addedAt || new Date().toISOString(),
      verifiedAt: peer.verifiedAt || null
    };

    const result = await neo4j.write(cypher, params);
    return result[0]?.p;
  }

  /**
   * Get a peer by server ID
   */
  async getPeer(serverId) {
    if (!await this.isNeo4jAvailable()) {
      return null;
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (p:FederationPeer {serverId: $serverId})
      RETURN p
    `;

    const result = await neo4j.read(cypher, { serverId });
    return result[0]?.p ? this.formatPeer(result[0].p) : null;
  }

  /**
   * Get all peers with optional filters
   */
  async getAllPeers(filters = {}) {
    if (!await this.isNeo4jAvailable()) {
      return [];
    }

    const neo4j = getNeo4jService();

    let cypher = 'MATCH (p:FederationPeer)';
    const conditions = [];
    const params = {};

    if (filters.trustLevel) {
      conditions.push('p.trustLevel = $trustLevel');
      params.trustLevel = filters.trustLevel;
    }

    if (filters.minHealthScore !== undefined) {
      conditions.push('p.healthScore >= $minHealthScore');
      params.minHealthScore = filters.minHealthScore;
    }

    if (filters.hasCapability) {
      conditions.push('$capability IN p.capabilities');
      params.capability = filters.hasCapability;
    }

    if (filters.excludeBlocked) {
      conditions.push("p.trustLevel <> 'blocked'");
    }

    if (conditions.length > 0) {
      cypher += ' WHERE ' + conditions.join(' AND ');
    }

    cypher += ' RETURN p ORDER BY p.healthScore DESC, p.lastSeen DESC';

    if (filters.limit) {
      cypher += ' LIMIT $limit';
      params.limit = neo4j.driver ? require('neo4j-driver').int(filters.limit) : filters.limit;
    }

    const result = await neo4j.read(cypher, params);
    return result.map(r => this.formatPeer(r.p));
  }

  /**
   * Get healthy peers (for memory sharing)
   */
  async getHealthyPeers(minHealthScore = 0.5) {
    return this.getAllPeers({
      minHealthScore,
      excludeBlocked: true
    });
  }

  /**
   * Get trusted peers
   */
  async getTrustedPeers() {
    return this.getAllPeers({
      trustLevel: 'trusted',
      excludeBlocked: true
    });
  }

  /**
   * Get verified peers (verified or trusted)
   */
  async getVerifiedPeers() {
    if (!await this.isNeo4jAvailable()) {
      return [];
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (p:FederationPeer)
      WHERE p.trustLevel IN ['verified', 'trusted']
      RETURN p
      ORDER BY p.healthScore DESC
    `;

    const result = await neo4j.read(cypher);
    return result.map(r => this.formatPeer(r.p));
  }

  /**
   * Delete a peer
   */
  async deletePeer(serverId) {
    if (!await this.isNeo4jAvailable()) {
      return false;
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (p:FederationPeer {serverId: $serverId})
      DETACH DELETE p
      RETURN count(p) as deleted
    `;

    const result = await neo4j.write(cypher, { serverId });
    return result[0]?.deleted > 0;
  }

  /**
   * Update peer trust level
   */
  async setTrustLevel(serverId, trustLevel) {
    if (!TRUST_LEVELS.includes(trustLevel)) {
      console.log(`❌ Invalid trust level: ${trustLevel}`);
      return null;
    }

    if (!await this.isNeo4jAvailable()) {
      return null;
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (p:FederationPeer {serverId: $serverId})
      SET p.trustLevel = $trustLevel,
          p.verifiedAt = CASE WHEN $trustLevel IN ['verified', 'trusted'] THEN datetime() ELSE p.verifiedAt END,
          p.updatedAt = datetime()
      RETURN p
    `;

    const result = await neo4j.write(cypher, { serverId, trustLevel });

    if (result[0]?.p) {
      console.log(`🌐 Set trust level for ${serverId}: ${trustLevel}`);
      return this.formatPeer(result[0].p);
    }
    return null;
  }

  /**
   * Block a peer
   */
  async blockPeer(serverId, reason = null) {
    if (!await this.isNeo4jAvailable()) {
      return null;
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (p:FederationPeer {serverId: $serverId})
      SET p.trustLevel = 'blocked',
          p.blockedAt = datetime(),
          p.blockReason = $reason,
          p.updatedAt = datetime()
      RETURN p
    `;

    const result = await neo4j.write(cypher, { serverId, reason });

    if (result[0]?.p) {
      console.log(`🚫 Blocked peer ${serverId}: ${reason || 'no reason given'}`);
      return this.formatPeer(result[0].p);
    }
    return null;
  }

  /**
   * Unblock a peer
   */
  async unblockPeer(serverId) {
    return this.setTrustLevel(serverId, 'unknown');
  }

  /**
   * Update peer health after check
   */
  async updateHealth(serverId, isHealthy, responseTimeMs = null) {
    if (!await this.isNeo4jAvailable()) {
      return null;
    }

    const neo4j = getNeo4jService();

    // Get current peer state
    const peer = await this.getPeer(serverId);
    if (!peer) return null;

    let newHealthScore = peer.healthScore;
    let newFailedChecks = peer.failedChecks;

    if (isHealthy) {
      newFailedChecks = 0;
      newHealthScore = Math.min(1.0, newHealthScore + HEALTH_RECOVERY_RATE);
    } else {
      newFailedChecks = (peer.failedChecks || 0) + 1;
      newHealthScore = Math.max(0, newHealthScore - HEALTH_DECAY_RATE);
    }

    const cypher = `
      MATCH (p:FederationPeer {serverId: $serverId})
      SET p.healthScore = $healthScore,
          p.failedChecks = $failedChecks,
          p.lastSeen = CASE WHEN $isHealthy THEN datetime() ELSE p.lastSeen END,
          p.lastResponseTime = $responseTime,
          p.lastChecked = datetime(),
          p.updatedAt = datetime()
      RETURN p
    `;

    const result = await neo4j.write(cypher, {
      serverId,
      healthScore: newHealthScore,
      failedChecks: newFailedChecks,
      isHealthy,
      responseTime: responseTimeMs
    });

    return result[0]?.p ? this.formatPeer(result[0].p) : null;
  }

  /**
   * Create a trust relationship between peers
   */
  async createTrustRelationship(fromServerId, toServerId, trustType = 'TRUSTS') {
    if (!await this.isNeo4jAvailable()) {
      return false;
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (from:FederationPeer {serverId: $fromServerId})
      MATCH (to:FederationPeer {serverId: $toServerId})
      MERGE (from)-[r:${trustType}]->(to)
      SET r.createdAt = COALESCE(r.createdAt, datetime()),
          r.updatedAt = datetime()
      RETURN from, to, r
    `;

    const result = await neo4j.write(cypher, { fromServerId, toServerId });
    return result.length > 0;
  }

  /**
   * Get peers that trust a given peer (incoming trust)
   */
  async getPeersThatTrust(serverId) {
    if (!await this.isNeo4jAvailable()) {
      return [];
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (p:FederationPeer)-[:TRUSTS]->(target:FederationPeer {serverId: $serverId})
      RETURN p
    `;

    const result = await neo4j.read(cypher, { serverId });
    return result.map(r => this.formatPeer(r.p));
  }

  /**
   * Get peers trusted by a given peer (outgoing trust)
   */
  async getPeersTrustedBy(serverId) {
    if (!await this.isNeo4jAvailable()) {
      return [];
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (source:FederationPeer {serverId: $serverId})-[:TRUSTS]->(p:FederationPeer)
      RETURN p
    `;

    const result = await neo4j.read(cypher, { serverId });
    return result.map(r => this.formatPeer(r.p));
  }

  /**
   * Calculate trust score based on network position
   * Uses PageRank-style algorithm on trust graph
   */
  async calculateTrustScore(serverId) {
    if (!await this.isNeo4jAvailable()) {
      return 0;
    }

    const neo4j = getNeo4jService();

    // Simple trust score: (trusters count * 0.3) + (health * 0.4) + (verified bonus * 0.3)
    const cypher = `
      MATCH (p:FederationPeer {serverId: $serverId})
      OPTIONAL MATCH (truster:FederationPeer)-[:TRUSTS]->(p)
      WITH p, count(truster) as trustersCount
      RETURN p.healthScore as health,
             p.trustLevel as trustLevel,
             trustersCount,
             (trustersCount * 0.3 + p.healthScore * 0.4 +
              CASE p.trustLevel
                WHEN 'trusted' THEN 0.3
                WHEN 'verified' THEN 0.2
                ELSE 0
              END) as trustScore
    `;

    const result = await neo4j.read(cypher, { serverId });
    return result[0]?.trustScore || 0;
  }

  /**
   * Get peer statistics
   */
  async getStats() {
    if (!await this.isNeo4jAvailable()) {
      return { total: 0, byTrustLevel: {}, avgHealth: 0 };
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (p:FederationPeer)
      WITH p.trustLevel as level, count(*) as count, avg(p.healthScore) as avgHealth
      RETURN collect({level: level, count: count, avgHealth: avgHealth}) as stats
    `;

    const result = await neo4j.read(cypher);
    const stats = result[0]?.stats || [];

    const byTrustLevel = {};
    let total = 0;
    let totalHealth = 0;

    for (const s of stats) {
      byTrustLevel[s.level] = { count: s.count, avgHealth: s.avgHealth };
      total += s.count;
      totalHealth += s.avgHealth * s.count;
    }

    return {
      total,
      byTrustLevel,
      avgHealth: total > 0 ? totalHealth / total : 0
    };
  }

  /**
   * Get trust graph for visualization
   */
  async getTrustGraph() {
    if (!await this.isNeo4jAvailable()) {
      return { nodes: [], edges: [] };
    }

    const neo4j = getNeo4jService();

    const cypher = `
      MATCH (p:FederationPeer)
      OPTIONAL MATCH (p)-[r:TRUSTS]->(target:FederationPeer)
      RETURN p, collect({target: target.serverId, type: type(r)}) as relationships
    `;

    const result = await neo4j.read(cypher);

    const nodes = [];
    const edges = [];

    for (const row of result) {
      const peer = this.formatPeer(row.p);
      nodes.push({
        id: peer.serverId,
        label: peer.serverId,
        trustLevel: peer.trustLevel,
        healthScore: peer.healthScore
      });

      for (const rel of row.relationships) {
        if (rel.target) {
          edges.push({
            from: peer.serverId,
            to: rel.target,
            type: rel.type
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Format Neo4j peer node to plain object
   */
  formatPeer(node) {
    if (!node) return null;

    const props = node.properties || node;

    return {
      serverId: props.serverId,
      publicKey: props.publicKey,
      nodeId: props.nodeId,
      endpoint: props.endpoint,
      version: props.version,
      capabilities: props.capabilities || [],
      plugins: props.plugins ? JSON.parse(props.plugins) : [],
      trustLevel: props.trustLevel || 'unknown',
      isProtected: props.isProtected || false,
      healthScore: typeof props.healthScore === 'number' ? props.healthScore : 1.0,
      failedChecks: props.failedChecks || 0,
      lastSeen: props.lastSeen?.toString() || null,
      addedAt: props.addedAt?.toString() || null,
      verifiedAt: props.verifiedAt?.toString() || null,
      lastResponseTime: props.lastResponseTime || null
    };
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.runHealthChecks().catch(console.error);
    }, HEALTH_CHECK_INTERVAL);

    console.log('🌐 Peer health checks started');
  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Run health checks on all peers
   */
  async runHealthChecks() {
    const peers = await this.getAllPeers({ excludeBlocked: true });

    if (peers.length === 0) return;

    console.log(`🌐 Running health checks on ${peers.length} peers...`);

    let healthy = 0;
    let unhealthy = 0;

    for (const peer of peers) {
      const startTime = Date.now();

      const isHealthy = await this.pingPeer(peer.endpoint).catch(() => false);
      const responseTime = Date.now() - startTime;

      await this.updateHealth(peer.serverId, isHealthy, isHealthy ? responseTime : null);

      if (isHealthy) {
        healthy++;
      } else {
        unhealthy++;

        // Check if peer should be marked as down
        if (peer.failedChecks >= MAX_FAILED_CHECKS) {
          console.log(`⚠️ Peer ${peer.serverId} has failed ${MAX_FAILED_CHECKS} checks`);
        }
      }
    }

    console.log(`🌐 Health checks complete: ${healthy} healthy, ${unhealthy} unhealthy`);
  }

  /**
   * Ping a peer to check health
   */
  async pingPeer(endpoint) {
    const url = `${endpoint.replace(/\/$/, '')}/api/federation/ping`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromServerId: this.federationService?.identity?.serverId
      }),
      signal: AbortSignal.timeout(10000)
    });

    return response.ok;
  }

  /**
   * Sync peers from federation service to Neo4j
   */
  async syncFromFederationService() {
    if (!this.federationService) return;

    const memoryPeers = this.federationService.getAllPeers();

    for (const peer of memoryPeers) {
      await this.upsertPeer(peer);
    }

    console.log(`🌐 Synced ${memoryPeers.length} peers to Neo4j`);
  }
}

// Singleton instance
let instance = null;

function getPeerService() {
  if (!instance) {
    instance = new PeerService();
  }
  return instance;
}

module.exports = {
  PeerService,
  getPeerService,
  TRUST_LEVELS
};
