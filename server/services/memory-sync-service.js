/**
 * Memory Sync Service
 *
 * Handles cross-instance memory sharing for federation:
 * - Standardized memory schema for compatibility
 * - Content hashing for deduplication
 * - Selective export by category, stage, or tag
 * - Delta sync support (only new/modified memories)
 * - Import with collision detection
 */

const crypto = require('crypto');
const { getNeo4jService } = require('./neo4j-service');
const { getFederationService } = require('./federation-service');
const memoryService = require('./memory-service');

// Sync metadata stored in Neo4j
const SYNC_NODE_LABEL = 'MemorySyncState';

/**
 * Generate content hash for deduplication
 * Uses SHA-256 of normalized content
 */
function generateContentHash(memory) {
  const content = {
    text: (memory.content?.text || memory.content || '').trim().toLowerCase(),
    category: memory.category,
    tags: (memory.tags || []).sort()
  };
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

/**
 * Normalize memory to federation schema
 * Strips internal fields and adds federation metadata
 */
function normalizeForExport(memory, sourceServerId) {
  return {
    // Core content
    id: memory.id,
    content: {
      text: memory.content?.text || memory.content || '',
      context: memory.content?.context || '',
      impact: memory.content?.impact || '',
      significance: memory.content?.significance || 'normal'
    },
    category: memory.category,
    stage: memory.stage,
    importance: memory.importance,
    tags: memory.tags || [],
    type: memory.type || 'observation',
    timestamp: memory.timestamp,

    // Federation metadata
    federation: {
      sourceServerId,
      contentHash: generateContentHash(memory),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
  };
}

/**
 * Prepare memory for import
 * Adds provenance tracking and checks for collisions
 */
function prepareForImport(federatedMemory, importedBy) {
  const localId = `fed_${federatedMemory.federation.sourceServerId.replace('void-', '')}_${federatedMemory.id.replace('mem_', '')}`;

  return {
    id: localId,
    content: federatedMemory.content,
    category: federatedMemory.category,
    stage: federatedMemory.stage,
    importance: federatedMemory.importance,
    tags: [...(federatedMemory.tags || []), 'federated'],
    type: federatedMemory.type,
    timestamp: federatedMemory.timestamp,
    source: 'federation',
    relatedUsers: [],
    metrics: {
      relevance: 0.5,
      interactions: 0,
      views: 0,
      lastAccessed: new Date().toISOString()
    },
    // Provenance tracking
    provenance: {
      sourceServerId: federatedMemory.federation.sourceServerId,
      originalId: federatedMemory.id,
      contentHash: federatedMemory.federation.contentHash,
      importedAt: new Date().toISOString(),
      importedBy
    }
  };
}

class MemorySyncService {
  constructor() {
    this.syncInProgress = false;
  }

  /**
   * Export memories for federation sharing
   * @param {Object} options - Export options
   * @param {string} options.category - Filter by category
   * @param {number} options.stage - Filter by stage
   * @param {string[]} options.tags - Filter by tags (any match)
   * @param {number} options.minImportance - Minimum importance threshold
   * @param {string} options.since - ISO timestamp for delta sync
   * @param {number} options.limit - Max memories to export
   */
  async exportMemories(options = {}) {
    const federation = getFederationService();
    const sourceServerId = federation.identity.serverId;

    // Get all memories with filters
    const data = await memoryService.getAllMemories(options.limit || 1000);
    let memories = data.memories || [];

    // Apply filters
    if (options.category) {
      memories = memories.filter(m => m.category === options.category);
    }

    if (options.stage) {
      memories = memories.filter(m => m.stage === options.stage);
    }

    if (options.tags?.length) {
      memories = memories.filter(m =>
        (m.tags || []).some(t => options.tags.includes(t))
      );
    }

    if (options.minImportance !== undefined) {
      memories = memories.filter(m => m.importance >= options.minImportance);
    }

    // Delta sync - only memories modified since timestamp
    if (options.since) {
      const sinceDate = new Date(options.since);
      memories = memories.filter(m =>
        new Date(m.timestamp) > sinceDate ||
        (m.metrics?.lastAccessed && new Date(m.metrics.lastAccessed) > sinceDate)
      );
    }

    // Normalize for export
    const exportedMemories = memories.map(m => normalizeForExport(m, sourceServerId));

    // Create export manifest
    const manifest = {
      version: '1.0',
      sourceServerId,
      sourcePublicKey: federation.identity.publicKey,
      exportedAt: new Date().toISOString(),
      filters: options,
      count: exportedMemories.length,
      contentHashes: exportedMemories.map(m => m.federation.contentHash)
    };

    // Sign the manifest
    const signature = federation.sign(manifest);

    return {
      manifest,
      signature,
      memories: exportedMemories
    };
  }

  /**
   * Import memories from another server
   * @param {Object} exportData - Data from exportMemories
   * @param {Object} options - Import options
   * @param {boolean} options.skipDuplicates - Skip memories with matching content hash
   * @param {boolean} options.dryRun - Don't actually import, just check
   */
  async importMemories(exportData, options = {}) {
    const federation = getFederationService();
    const { manifest, signature, memories } = exportData;

    // Allow self-import (for testing and local memory backup/restore)
    const isSelfImport = manifest.sourceServerId === federation.identity.serverId;

    if (!isSelfImport) {
      // Verify signature from source server
      const peer = federation.getPeer(manifest.sourceServerId);
      if (!peer) {
        return {
          success: false,
          error: `Unknown source server: ${manifest.sourceServerId}. Add as peer first.`
        };
      }

      const isValid = federation.verify(manifest, signature, peer.publicKey);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid signature - manifest may have been tampered with'
        };
      }
    } else {
      // For self-import, verify our own signature
      const isValid = federation.verify(manifest, signature, federation.identity.publicKey);
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid signature on self-import'
        };
      }
    }

    // Check for duplicates
    const existingHashes = await this.getExistingContentHashes();
    const results = {
      imported: 0,
      skipped: 0,
      duplicates: [],
      errors: []
    };

    for (const memory of memories) {
      const contentHash = memory.federation.contentHash;

      // Check for duplicate
      if (existingHashes.has(contentHash)) {
        results.skipped++;
        results.duplicates.push({
          id: memory.id,
          contentHash,
          reason: 'Content already exists'
        });
        continue;
      }

      if (options.dryRun) {
        results.imported++;
        continue;
      }

      // Prepare and import
      const localMemory = prepareForImport(memory, federation.identity.serverId);

      const created = await memoryService.createMemory(localMemory);
      if (created) {
        results.imported++;
        existingHashes.add(contentHash);

        // Store content hash mapping
        await this.storeContentHashMapping(contentHash, localMemory.id, manifest.sourceServerId);
      } else {
        results.errors.push({
          id: memory.id,
          error: 'Failed to create memory'
        });
      }
    }

    // Update sync state
    if (!options.dryRun && results.imported > 0) {
      await this.updateSyncState(manifest.sourceServerId, {
        lastSync: new Date().toISOString(),
        memoriesImported: results.imported,
        lastManifest: manifest
      });
    }

    return {
      success: true,
      dryRun: options.dryRun || false,
      source: manifest.sourceServerId,
      ...results
    };
  }

  /**
   * Get content hashes of all local memories for deduplication
   */
  async getExistingContentHashes() {
    const neo4j = getNeo4jService();
    const hashes = new Set();

    if (!await neo4j.isAvailable()) {
      // Fallback: compute from memories
      const data = await memoryService.getAllMemories(0);
      for (const memory of data.memories || []) {
        hashes.add(generateContentHash(memory));
      }
      return hashes;
    }

    // Get stored hashes from Neo4j
    const result = await neo4j.read(`
      MATCH (m:Memory)
      WHERE m.contentHash IS NOT NULL
      RETURN m.contentHash as hash
    `);

    for (const row of result) {
      if (row.hash) hashes.add(row.hash);
    }

    // Also compute for memories without stored hash
    const unhashed = await neo4j.read(`
      MATCH (m:Memory)
      WHERE m.contentHash IS NULL
      RETURN m
    `);

    for (const row of unhashed) {
      if (row.m) {
        const memory = memoryService.formatMemoryFromNeo4j
          ? memoryService.formatMemoryFromNeo4j(row.m)
          : row.m.properties;
        if (memory) {
          hashes.add(generateContentHash(memory));
        }
      }
    }

    return hashes;
  }

  /**
   * Store content hash to local ID mapping for tracking provenance
   */
  async storeContentHashMapping(contentHash, localId, sourceServerId) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return;

    await neo4j.write(`
      MATCH (m:Memory {id: $localId})
      SET m.contentHash = $contentHash,
          m.federationSource = $sourceServerId
    `, { localId, contentHash, sourceServerId });
  }

  /**
   * Get sync state for a peer
   */
  async getSyncState(peerId) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return null;

    const result = await neo4j.read(`
      MATCH (s:${SYNC_NODE_LABEL} {peerId: $peerId})
      RETURN s
    `, { peerId });

    return result[0]?.s?.properties || null;
  }

  /**
   * Update sync state for a peer
   */
  async updateSyncState(peerId, state) {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return;

    await neo4j.write(`
      MERGE (s:${SYNC_NODE_LABEL} {peerId: $peerId})
      SET s.lastSync = $lastSync,
          s.memoriesImported = COALESCE(s.memoriesImported, 0) + $memoriesImported,
          s.updatedAt = datetime()
    `, {
      peerId,
      lastSync: state.lastSync,
      memoriesImported: state.memoriesImported
    });
  }

  /**
   * Get all sync states
   */
  async getAllSyncStates() {
    const neo4j = getNeo4jService();
    if (!await neo4j.isAvailable()) return [];

    const result = await neo4j.read(`
      MATCH (s:${SYNC_NODE_LABEL})
      RETURN s
      ORDER BY s.lastSync DESC
    `);

    return result.map(r => r.s?.properties || null).filter(Boolean);
  }

  /**
   * Perform delta sync with a peer
   * Only fetches memories modified since last sync
   */
  async deltaSync(peerId) {
    const federation = getFederationService();
    const peer = federation.getPeer(peerId);

    if (!peer) {
      return { success: false, error: 'Peer not found' };
    }

    // Get last sync timestamp
    const syncState = await this.getSyncState(peerId);
    const since = syncState?.lastSync || null;

    // Request export from peer
    const url = `${peer.endpoint.replace(/\/$/, '')}/api/federation/memories/export`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        since,
        requesterId: federation.identity.serverId
      }),
      signal: AbortSignal.timeout(60000)
    }).catch(err => ({ ok: false, error: err.message }));

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to fetch from peer' };
    }

    const exportData = await response.json();

    if (!exportData.success) {
      return { success: false, error: exportData.error };
    }

    // Import the memories
    return this.importMemories(exportData.data, { skipDuplicates: true });
  }

  /**
   * Get sync statistics
   */
  async getStats() {
    const neo4j = getNeo4jService();

    const stats = {
      totalFederated: 0,
      bySource: {},
      syncStates: []
    };

    if (!await neo4j.isAvailable()) return stats;

    // Count federated memories
    const countResult = await neo4j.read(`
      MATCH (m:Memory)
      WHERE m.federationSource IS NOT NULL
      RETURN m.federationSource as source, count(m) as count
    `);

    for (const row of countResult) {
      if (row.source) {
        stats.bySource[row.source] = typeof row.count === 'object' ? row.count.toNumber() : row.count;
        stats.totalFederated += stats.bySource[row.source];
      }
    }

    // Get sync states
    stats.syncStates = await this.getAllSyncStates();

    return stats;
  }

  /**
   * Check what would be imported from a peer (dry run)
   */
  async previewImport(peerId, options = {}) {
    const federation = getFederationService();
    const peer = federation.getPeer(peerId);

    if (!peer) {
      return { success: false, error: 'Peer not found' };
    }

    // Request export from peer
    const url = `${peer.endpoint.replace(/\/$/, '')}/api/federation/memories/export`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...options,
        requesterId: federation.identity.serverId
      }),
      signal: AbortSignal.timeout(60000)
    }).catch(err => ({ ok: false, error: err.message }));

    if (!response.ok) {
      return { success: false, error: response.error || 'Failed to fetch from peer' };
    }

    const exportData = await response.json();

    if (!exportData.success) {
      return { success: false, error: exportData.error };
    }

    // Dry run import
    return this.importMemories(exportData.data, { dryRun: true });
  }
}

// Singleton instance
let instance = null;

function getMemorySyncService() {
  if (!instance) {
    instance = new MemorySyncService();
  }
  return instance;
}

module.exports = {
  MemorySyncService,
  getMemorySyncService,
  generateContentHash,
  normalizeForExport,
  prepareForImport
};
