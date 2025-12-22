/**
 * Memory Marketplace Service
 *
 * Handles federated memory quality and reputation:
 * - Memory quality scoring based on usage and citations
 * - Contributor reputation tracking
 * - Memory attribution chain (provenance)
 * - Usage analytics for shared memories
 */

const { getNeo4jService } = require('./neo4j-service');
const { getFederationService } = require('./federation-service');

// Quality scoring weights
const QUALITY_WEIGHTS = {
  views: 0.1,           // Each view adds 0.1 to score
  interactions: 0.5,    // Each interaction adds 0.5
  citations: 2.0,       // Each citation adds 2.0
  upvotes: 1.0,         // Each upvote adds 1.0
  downvotes: -1.5,      // Each downvote subtracts 1.5
  age_decay: 0.99       // Daily decay multiplier
};

// Reputation thresholds
const REPUTATION_TIERS = {
  NEWCOMER: 0,
  CONTRIBUTOR: 100,
  TRUSTED: 500,
  EXPERT: 1000,
  SAGE: 5000
};

class MemoryMarketplaceService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the marketplace (create Neo4j constraints/indexes)
   */
  async initialize() {
    if (this.initialized) return;

    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) {
      console.log('⚠️ Neo4j not available - marketplace features limited');
      return;
    }

    // Create indexes for marketplace queries
    await neo4j.write(`
      CREATE INDEX memory_quality_idx IF NOT EXISTS
      FOR (m:Memory) ON (m.qualityScore)
    `).catch(() => {});

    await neo4j.write(`
      CREATE INDEX contributor_rep_idx IF NOT EXISTS
      FOR (c:Contributor) ON (c.reputation)
    `).catch(() => {});

    this.initialized = true;
    console.log('🏪 Memory Marketplace initialized');
  }

  /**
   * Record a memory view/access
   * @param {string} memoryId - Memory ID
   * @param {string} viewerId - Server ID of viewer (optional)
   */
  async recordView(memoryId, viewerId = null) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return;

    await neo4j.write(`
      MATCH (m:Memory {id: $memoryId})
      SET m.viewCount = COALESCE(m.viewCount, 0) + 1,
          m.lastViewed = datetime()
    `, { memoryId });

    // Record view event for analytics
    if (viewerId) {
      await neo4j.write(`
        MATCH (m:Memory {id: $memoryId})
        CREATE (v:MemoryView {
          memoryId: $memoryId,
          viewerId: $viewerId,
          timestamp: datetime()
        })
      `, { memoryId, viewerId });
    }
  }

  /**
   * Record a memory interaction (used in chat, referenced, etc.)
   * @param {string} memoryId - Memory ID
   * @param {string} interactionType - Type of interaction
   * @param {Object} metadata - Additional metadata
   */
  async recordInteraction(memoryId, interactionType, metadata = {}) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return;

    await neo4j.write(`
      MATCH (m:Memory {id: $memoryId})
      SET m.interactionCount = COALESCE(m.interactionCount, 0) + 1,
          m.lastInteraction = datetime()
    `, { memoryId });

    // Record interaction for analytics
    await neo4j.write(`
      CREATE (i:MemoryInteraction {
        memoryId: $memoryId,
        type: $interactionType,
        metadata: $metadata,
        timestamp: datetime()
      })
    `, { memoryId, interactionType, metadata: JSON.stringify(metadata) });
  }

  /**
   * Record a memory citation (one memory references another)
   * @param {string} citingMemoryId - Memory doing the citing
   * @param {string} citedMemoryId - Memory being cited
   */
  async recordCitation(citingMemoryId, citedMemoryId) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return;

    // Create citation relationship
    await neo4j.write(`
      MATCH (citing:Memory {id: $citingMemoryId})
      MATCH (cited:Memory {id: $citedMemoryId})
      MERGE (citing)-[c:CITES]->(cited)
      ON CREATE SET c.createdAt = datetime()
      SET cited.citationCount = COALESCE(cited.citationCount, 0) + 1
    `, { citingMemoryId, citedMemoryId });
  }

  /**
   * Vote on a memory quality
   * @param {string} memoryId - Memory ID
   * @param {string} voterId - Server ID of voter
   * @param {number} vote - 1 for upvote, -1 for downvote
   */
  async vote(memoryId, voterId, vote) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return { success: false, error: 'Neo4j unavailable' };

    // Check for existing vote
    const existing = await neo4j.read(`
      MATCH (m:Memory {id: $memoryId})<-[v:VOTED]-(voter {serverId: $voterId})
      RETURN v.value as vote
    `, { memoryId, voterId });

    const previousVote = existing[0]?.vote || 0;

    // Update or create vote
    await neo4j.write(`
      MATCH (m:Memory {id: $memoryId})
      MERGE (voter:Voter {serverId: $voterId})
      MERGE (voter)-[v:VOTED]->(m)
      SET v.value = $vote,
          v.updatedAt = datetime()
      SET m.upvotes = COALESCE(m.upvotes, 0) + CASE WHEN $vote = 1 AND $previousVote != 1 THEN 1 ELSE 0 END
                                              - CASE WHEN $previousVote = 1 AND $vote != 1 THEN 1 ELSE 0 END,
          m.downvotes = COALESCE(m.downvotes, 0) + CASE WHEN $vote = -1 AND $previousVote != -1 THEN 1 ELSE 0 END
                                                  - CASE WHEN $previousVote = -1 AND $vote != -1 THEN 1 ELSE 0 END
    `, { memoryId, voterId, vote, previousVote });

    return { success: true, previousVote, newVote: vote };
  }

  /**
   * Calculate quality score for a memory
   * @param {string} memoryId - Memory ID
   * @returns {Promise<number>} Quality score
   */
  async calculateQualityScore(memoryId) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return 0;

    const result = await neo4j.read(`
      MATCH (m:Memory {id: $memoryId})
      RETURN
        COALESCE(m.viewCount, 0) as views,
        COALESCE(m.interactionCount, 0) as interactions,
        COALESCE(m.citationCount, 0) as citations,
        COALESCE(m.upvotes, 0) as upvotes,
        COALESCE(m.downvotes, 0) as downvotes,
        m.timestamp as createdAt
    `, { memoryId });

    if (!result[0]) return 0;

    const { views, interactions, citations, upvotes, downvotes, createdAt } = result[0];

    // Calculate base score
    let score = (views * QUALITY_WEIGHTS.views) +
                (interactions * QUALITY_WEIGHTS.interactions) +
                (citations * QUALITY_WEIGHTS.citations) +
                (upvotes * QUALITY_WEIGHTS.upvotes) +
                (downvotes * QUALITY_WEIGHTS.downvotes);

    // Apply age decay
    if (createdAt) {
      const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
      score *= Math.pow(QUALITY_WEIGHTS.age_decay, ageInDays);
    }

    // Update stored score
    await neo4j.write(`
      MATCH (m:Memory {id: $memoryId})
      SET m.qualityScore = $score,
          m.qualityUpdatedAt = datetime()
    `, { memoryId, score });

    return Math.max(0, score);
  }

  /**
   * Get top quality memories
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Top memories by quality
   */
  async getTopMemories(options = {}) {
    const { limit = 20, category = null, minScore = 0 } = options;

    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return [];

    const categoryFilter = category ? 'AND m.category = $category' : '';
    const neo4jInt = require('neo4j-driver').int;

    const result = await neo4j.read(`
      MATCH (m:Memory)
      WHERE COALESCE(m.qualityScore, 0) >= $minScore ${categoryFilter}
      RETURN m
      ORDER BY m.qualityScore DESC
      LIMIT $limit
    `, { limit: neo4jInt(limit), category, minScore });

    return result.map(r => r.m?.properties || null).filter(Boolean);
  }

  /**
   * Register or update a contributor
   * @param {string} serverId - Server ID of contributor
   * @param {Object} info - Contributor info
   */
  async registerContributor(serverId, info = {}) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return null;

    await neo4j.write(`
      MERGE (c:Contributor {serverId: $serverId})
      ON CREATE SET
        c.reputation = 0,
        c.memoriesShared = 0,
        c.totalCitations = 0,
        c.joinedAt = datetime()
      SET c.lastActive = datetime(),
          c.endpoint = $endpoint,
          c.publicKey = $publicKey
    `, {
      serverId,
      endpoint: info.endpoint || null,
      publicKey: info.publicKey || null
    });

    return this.getContributor(serverId);
  }

  /**
   * Get contributor profile
   * @param {string} serverId - Server ID
   */
  async getContributor(serverId) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return null;

    const result = await neo4j.read(`
      MATCH (c:Contributor {serverId: $serverId})
      OPTIONAL MATCH (c)-[:SHARED]->(m:Memory)
      WITH c, count(m) as sharedCount, sum(COALESCE(m.citationCount, 0)) as totalCitations
      RETURN c, sharedCount, totalCitations
    `, { serverId });

    if (!result[0]) return null;

    const contributor = result[0].c?.properties || {};
    const reputation = contributor.reputation || 0;

    return {
      ...contributor,
      sharedCount: result[0].sharedCount || 0,
      totalCitations: result[0].totalCitations || 0,
      tier: this.getReputationTier(reputation)
    };
  }

  /**
   * Get reputation tier for a score
   * @param {number} reputation - Reputation score
   * @returns {string} Tier name
   */
  getReputationTier(reputation) {
    if (reputation >= REPUTATION_TIERS.SAGE) return 'SAGE';
    if (reputation >= REPUTATION_TIERS.EXPERT) return 'EXPERT';
    if (reputation >= REPUTATION_TIERS.TRUSTED) return 'TRUSTED';
    if (reputation >= REPUTATION_TIERS.CONTRIBUTOR) return 'CONTRIBUTOR';
    return 'NEWCOMER';
  }

  /**
   * Update contributor reputation based on their shared memories
   * @param {string} serverId - Server ID
   */
  async updateContributorReputation(serverId) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return 0;

    // Calculate reputation based on shared memory quality
    const result = await neo4j.read(`
      MATCH (c:Contributor {serverId: $serverId})-[:SHARED]->(m:Memory)
      RETURN
        count(m) as memoryCount,
        sum(COALESCE(m.qualityScore, 0)) as totalQuality,
        sum(COALESCE(m.citationCount, 0)) as totalCitations,
        sum(COALESCE(m.upvotes, 0)) as totalUpvotes,
        sum(COALESCE(m.downvotes, 0)) as totalDownvotes
    `, { serverId });

    if (!result[0]) return 0;

    const { memoryCount, totalQuality, totalCitations, totalUpvotes, totalDownvotes } = result[0];

    // Reputation formula: quality + citations + upvotes - downvotes + base for sharing
    const reputation = (totalQuality || 0) +
                      (totalCitations || 0) * 5 +
                      (totalUpvotes || 0) * 2 -
                      (totalDownvotes || 0) * 3 +
                      (memoryCount || 0) * 1;

    await neo4j.write(`
      MATCH (c:Contributor {serverId: $serverId})
      SET c.reputation = $reputation,
          c.memoriesShared = $memoryCount,
          c.reputationUpdatedAt = datetime()
    `, { serverId, reputation, memoryCount });

    return reputation;
  }

  /**
   * Record memory attribution (who shared what)
   * @param {string} memoryId - Memory ID
   * @param {string} sourceServerId - Original contributor
   * @param {string} sharedBy - Who shared it to this server
   */
  async recordAttribution(memoryId, sourceServerId, sharedBy = null) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return;

    // Ensure contributor exists
    await this.registerContributor(sourceServerId);

    // Create SHARED relationship
    await neo4j.write(`
      MATCH (m:Memory {id: $memoryId})
      MATCH (c:Contributor {serverId: $sourceServerId})
      MERGE (c)-[s:SHARED]->(m)
      ON CREATE SET s.sharedAt = datetime()
      SET s.sharedBy = $sharedBy
    `, { memoryId, sourceServerId, sharedBy });
  }

  /**
   * Get memory attribution chain
   * @param {string} memoryId - Memory ID
   * @returns {Promise<Array>} Attribution chain
   */
  async getAttributionChain(memoryId) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return [];

    const result = await neo4j.read(`
      MATCH (m:Memory {id: $memoryId})
      OPTIONAL MATCH (c:Contributor)-[s:SHARED]->(m)
      RETURN c.serverId as serverId, s.sharedAt as sharedAt, s.sharedBy as sharedBy
      ORDER BY s.sharedAt ASC
    `, { memoryId });

    return result.filter(r => r.serverId).map(r => ({
      serverId: r.serverId,
      sharedAt: r.sharedAt,
      sharedBy: r.sharedBy
    }));
  }

  /**
   * Get top contributors
   * @param {Object} options - Query options
   */
  async getTopContributors(options = {}) {
    const { limit = 20 } = options;

    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return [];

    const neo4jInt = require('neo4j-driver').int;
    const result = await neo4j.read(`
      MATCH (c:Contributor)
      WHERE c.reputation > 0
      RETURN c
      ORDER BY c.reputation DESC
      LIMIT $limit
    `, { limit: neo4jInt(limit) });

    return result.map(r => {
      const contrib = r.c?.properties || {};
      return {
        ...contrib,
        tier: this.getReputationTier(contrib.reputation || 0)
      };
    });
  }

  /**
   * Get marketplace statistics
   */
  async getStats() {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) {
      return { available: false };
    }

    const result = await neo4j.read(`
      MATCH (m:Memory)
      WHERE m.federationSource IS NOT NULL
      WITH count(m) as federatedMemories,
           sum(COALESCE(m.viewCount, 0)) as totalViews,
           sum(COALESCE(m.citationCount, 0)) as totalCitations,
           avg(COALESCE(m.qualityScore, 0)) as avgQuality
      MATCH (c:Contributor)
      WITH federatedMemories, totalViews, totalCitations, avgQuality, count(c) as contributorCount
      RETURN federatedMemories, totalViews, totalCitations, avgQuality, contributorCount
    `);

    const stats = result[0] || {};

    return {
      available: true,
      federatedMemories: stats.federatedMemories || 0,
      totalViews: stats.totalViews || 0,
      totalCitations: stats.totalCitations || 0,
      averageQuality: stats.avgQuality || 0,
      contributorCount: stats.contributorCount || 0,
      tiers: REPUTATION_TIERS,
      qualityWeights: QUALITY_WEIGHTS
    };
  }
}

// Singleton instance
let instance = null;

function getMemoryMarketplaceService() {
  if (!instance) {
    instance = new MemoryMarketplaceService();
  }
  return instance;
}

module.exports = {
  MemoryMarketplaceService,
  getMemoryMarketplaceService,
  QUALITY_WEIGHTS,
  REPUTATION_TIERS
};
