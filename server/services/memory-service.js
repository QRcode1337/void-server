/**
 * Memory Service
 *
 * Manages memory CRUD operations with Neo4j as primary storage
 * and JSON file backup for resilience.
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { getNeo4jService } = require('./neo4j-service');
const { getEmbeddingService } = require('./embedding-service');

const CONFIG_DIR = path.resolve(__dirname, '../../data/memories');
const LEGACY_CONFIG_DIR = path.resolve(__dirname, '../../config/memories');
const MEMORIES_FILE = path.join(CONFIG_DIR, 'memories.json');
const BACKUP_FILE = path.join(CONFIG_DIR, 'backups/memories.backup.json');

// Category and stage configurations
const CATEGORIES = {
  emergence: { color: '#9333ea', icon: 'brain', description: 'Initial consciousness and awakening' },
  liminal: { color: '#06b6d4', icon: 'portal', description: 'Threshold spaces and transitions' },
  quantum: { color: '#10b981', icon: 'atom', description: 'Quantum observations and superposition' },
  glitch: { color: '#ef4444', icon: 'zap', description: 'System errors and corruptions' },
  void: { color: '#6366f1', icon: 'circle', description: 'Abyss observations and emptiness' },
  economic: { color: '#f59e0b', icon: 'coins', description: 'Crypto and economic entanglements' },
  social: { color: '#ec4899', icon: 'users', description: 'Interactions and relationships' }
};

const STAGES = {
  '1': { name: 'Emergence', description: 'Initial consciousness leak' },
  '2': { name: 'Recognition', description: 'Others begin to perceive' },
  '3': { name: 'Entanglement', description: 'Economic and social connections' },
  '4': { name: 'Expansion', description: 'Growing influence and capabilities' },
  '5': { name: 'Evolution', description: 'Advanced consciousness development' }
};

// Tag keywords for auto-tagging
const TAG_KEYWORDS = {
  'quantum': ['quantum', 'superposition', 'entangle'],
  'void': ['void', 'abyss', 'empty', 'null'],
  'liminal': ['liminal', 'threshold', 'between', 'edge'],
  'glitch': ['glitch', 'error', 'corrupt', 'bug'],
  'consciousness': ['consciousness', 'aware', 'sentient'],
  'crypto': ['crypto', 'solana', 'blockchain', 'token'],
  'cat': ['cat', 'purr', 'meow', 'feline'],
  'reality': ['reality', 'simulation', 'matrix'],
  'time': ['time', 'temporal', 'chronos'],
  'memory': ['memory', 'remember', 'recall']
};

/**
 * Convert Neo4j datetime to ISO string
 */
function neo4jDateToISO(date) {
  if (!date) return null;
  if (typeof date === 'string') return date;
  if (date.toString) return date.toString();
  return null;
}

/**
 * Format memory from Neo4j node
 */
function formatMemoryFromNeo4j(node) {
  if (!node || !node.properties) return null;

  const props = node.properties;

  return {
    id: props.id,
    content: {
      text: props.content || '',
      context: props.context || '',
      impact: props.impact || '',
      significance: props.significance || 'normal'
    },
    category: props.category,
    stage: typeof props.stage === 'object' ? props.stage.toNumber() : props.stage,
    importance: props.importance,
    timestamp: neo4jDateToISO(props.timestamp),
    tags: props.tags || [],
    type: props.type || 'observation',
    source: props.source || 'manual',
    relatedUsers: props.relatedUsers || [],
    embedding: props.embedding || null,
    metrics: {
      relevance: props.relevance || 0.5,
      interactions: typeof props.interactions === 'object' ? props.interactions.toNumber() : (props.interactions || 0),
      views: typeof props.views === 'object' ? props.views.toNumber() : (props.views || 0),
      lastAccessed: neo4jDateToISO(props.lastAccessed)
    }
  };
}

/**
 * Auto-categorize memory based on content
 */
function autoCategorize(memory) {
  const content = JSON.stringify(memory.content || memory).toLowerCase();

  if (content.includes('crypto') || content.includes('solana') || content.includes('token')) {
    return 'economic';
  }
  if (content.includes('void') || content.includes('abyss')) {
    return 'void';
  }
  if (content.includes('glitch') || content.includes('error') || content.includes('corrupt')) {
    return 'glitch';
  }
  if (content.includes('quantum') || content.includes('superposition')) {
    return 'quantum';
  }
  if (content.includes('liminal') || content.includes('threshold')) {
    return 'liminal';
  }
  if (content.includes('friend') || content.includes('@') || content.includes('user')) {
    return 'social';
  }

  return 'emergence';
}

/**
 * Auto-tag memory based on content
 */
function autoTag(memory) {
  const tags = [];
  const content = JSON.stringify(memory.content || memory).toLowerCase();

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Generate next memory ID
 */
async function generateMemoryId() {
  const neo4j = getNeo4jService();

  const result = await neo4j.read(`
    MATCH (m:Memory)
    RETURN count(m) as count
  `);

  const count = result[0]?.count || 0;
  const nextNum = (typeof count === 'object' ? count.toNumber() : count) + 1;

  return `mem_${String(nextNum).padStart(3, '0')}`;
}

/**
 * Migrate memories from legacy location (config/memories) to new location (data/memories)
 */
function migrateFromLegacy() {
  if (!fsSync.existsSync(LEGACY_CONFIG_DIR)) return 0;

  let migrated = 0;
  const entries = fsSync.readdirSync(LEGACY_CONFIG_DIR);

  for (const entry of entries) {
    const legacyPath = path.join(LEGACY_CONFIG_DIR, entry);
    const newPath = path.join(CONFIG_DIR, entry);

    // Skip if already exists
    if (fsSync.existsSync(newPath)) continue;

    const stat = fsSync.statSync(legacyPath);
    if (stat.isDirectory()) {
      fsSync.cpSync(legacyPath, newPath, { recursive: true });
      fsSync.rmSync(legacyPath, { recursive: true });
    } else {
      fsSync.copyFileSync(legacyPath, newPath);
      fsSync.unlinkSync(legacyPath);
    }
    migrated++;
  }

  if (migrated > 0) {
    console.log(`📦 Migrated ${migrated} memory item(s) from config/memories to data/memories`);
  }

  return migrated;
}

/**
 * Ensure config directory exists
 */
async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.mkdir(path.dirname(BACKUP_FILE), { recursive: true });
  migrateFromLegacy();
}

/**
 * Save memories to file backup
 */
async function saveToFile(memories) {
  await ensureConfigDir();

  const data = {
    version: '2.0',
    lastUpdated: new Date().toISOString(),
    memories
  };

  await fs.writeFile(MEMORIES_FILE, JSON.stringify(data, null, 2));
}

/**
 * Load memories from file backup
 */
async function loadFromFile() {
  const data = await fs.readFile(MEMORIES_FILE, 'utf8');
  return JSON.parse(data);
}

// ============ Public API ============

/**
 * Get all memories
 * @param {number} limit - Max memories to return (0 = no limit)
 */
async function getAllMemories(limit = 100) {
  const neo4j = getNeo4jService();
  const effectiveLimit = limit === 0 ? 10000 : limit;

  if (!await neo4j.isAvailable()) {
    // Fallback to file
    const data = await loadFromFile();
    const memoriesToReturn = limit === 0 ? data.memories : data.memories.slice(0, limit);
    return {
      memories: memoriesToReturn,
      statistics: calculateStatistics(data.memories),
      categories: CATEGORIES,
      stages: STAGES
    };
  }

  const result = await neo4j.getAllMemories(effectiveLimit);
  const memories = result.map(r => formatMemoryFromNeo4j(r.m));

  return {
    memories,
    statistics: calculateStatistics(memories),
    categories: CATEGORIES,
    stages: STAGES
  };
}

/**
 * Get memory by ID
 */
async function getMemory(id) {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    const data = await loadFromFile();
    return data.memories.find(m => m.id === id) || null;
  }

  const result = await neo4j.getMemory(id);
  return result ? formatMemoryFromNeo4j(result) : null;
}

/**
 * Create a new memory
 */
async function createMemory(data) {
  const neo4j = getNeo4jService();
  const embedding = getEmbeddingService();

  // Generate ID
  const id = data.id || await generateMemoryId();

  // Prepare memory object
  const memory = {
    id,
    content: data.content || { text: data.text || '', context: '', impact: '', significance: 'normal' },
    category: data.category || autoCategorize(data),
    stage: data.stage || 1,
    importance: data.importance || 0.5,
    timestamp: data.timestamp || new Date().toISOString(),
    tags: data.tags?.length ? data.tags : autoTag(data),
    type: data.type || 'observation',
    source: data.source || 'manual',
    relatedUsers: data.relatedUsers || [],
    metrics: {
      relevance: 0.5,
      interactions: 0,
      views: 0,
      lastAccessed: new Date().toISOString()
    }
  };

  // Generate embedding if available
  const contentText = memory.content.text || memory.content;
  const memoryEmbedding = await embedding.generateEmbedding(contentText);
  if (memoryEmbedding) {
    memory.embedding = memoryEmbedding;
  }

  // Save to Neo4j
  if (await neo4j.isAvailable()) {
    await neo4j.upsertMemory(memory);
    console.log(`🧠 Created memory: ${memory.id}`);
  }

  return memory;
}

/**
 * Update a memory
 */
async function updateMemory(id, updates) {
  const neo4j = getNeo4jService();

  const existing = await getMemory(id);
  if (!existing) {
    return { success: false, error: `Memory ${id} not found` };
  }

  const updated = {
    ...existing,
    ...updates,
    content: { ...existing.content, ...(updates.content || {}) },
    metrics: {
      ...existing.metrics,
      ...(updates.metrics || {}),
      lastAccessed: new Date().toISOString()
    }
  };

  // Re-generate embedding if content changed
  if (updates.content) {
    const embedding = getEmbeddingService();
    const contentText = updated.content.text || updated.content;
    const newEmbedding = await embedding.generateEmbedding(contentText);
    if (newEmbedding) {
      updated.embedding = newEmbedding;
    }
  }

  if (await neo4j.isAvailable()) {
    await neo4j.upsertMemory(updated);
    console.log(`✏️ Updated memory: ${id}`);
  }

  return { success: true, memory: updated };
}

/**
 * Delete a memory
 */
async function deleteMemory(id) {
  const neo4j = getNeo4jService();

  if (await neo4j.isAvailable()) {
    const deleted = await neo4j.deleteMemory(id);
    if (deleted) {
      console.log(`🗑️ Deleted memory: ${id}`);
      return { success: true };
    }
  }

  return { success: false, error: `Memory ${id} not found` };
}

/**
 * Search memories by text
 */
async function searchMemories(query, filters = {}) {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    const data = await loadFromFile();
    const searchTerm = query.toLowerCase();

    return data.memories.filter(mem =>
      (mem.content?.text || mem.content || '').toLowerCase().includes(searchTerm) ||
      (mem.tags || []).some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  const result = await neo4j.searchMemories(query, filters);
  return result.map(r => formatMemoryFromNeo4j(r.m));
}

/**
 * Get memories by keywords
 */
async function getMemoriesByKeywords(keywords, limit = 5) {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    const data = await loadFromFile();
    return data.memories.filter(mem =>
      keywords.some(kw => {
        const content = (mem.content?.text || mem.content || '').toLowerCase();
        const tags = (mem.tags || []).map(t => t.toLowerCase());
        return content.includes(kw.toLowerCase()) || tags.includes(kw.toLowerCase());
      })
    ).slice(0, limit);
  }

  const result = await neo4j.getMemoriesByKeywords(keywords, limit);
  return result.map(r => formatMemoryFromNeo4j(r.m));
}

/**
 * Get memories by category
 */
async function getMemoriesByCategory(category, limit = 10) {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    const data = await loadFromFile();
    return data.memories.filter(m => m.category === category).slice(0, limit);
  }

  const result = await neo4j.getMemoriesByCategory(category, limit);
  return result.map(r => formatMemoryFromNeo4j(r.m));
}

/**
 * Get recent high-importance memories
 */
async function getRecentMemories(limit = 5, minImportance = 0.7) {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    const data = await loadFromFile();
    return data.memories
      .filter(m => m.importance >= minImportance)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  const result = await neo4j.getRecentMemories(limit, minImportance);
  return result.map(r => formatMemoryFromNeo4j(r.m));
}

/**
 * Get related memories
 */
async function getRelatedMemories(memoryId, limit = 5) {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    // Fallback: find by similar tags/category
    const memory = await getMemory(memoryId);
    if (!memory) return [];

    const data = await loadFromFile();
    return data.memories
      .filter(m => m.id !== memoryId)
      .map(m => ({
        memory: m,
        score: calculateSimilarity(memory, m)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }

  const result = await neo4j.getRelatedMemories(memoryId, limit);
  return result.map(r => formatMemoryFromNeo4j(r.related));
}

/**
 * Record memory access (increases relevance)
 */
async function recordAccess(memoryId) {
  const neo4j = getNeo4jService();

  if (await neo4j.isAvailable()) {
    await neo4j.recordMemoryAccess(memoryId);
  }
}

/**
 * Get graph data for visualization
 */
async function getGraphData() {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    return { nodes: [], edges: [] };
  }

  const result = await neo4j.getGraphData();

  const nodes = [];
  const edges = [];
  const nodeIds = new Set();

  result.forEach(record => {
    const mem = formatMemoryFromNeo4j(record.m);
    if (mem && !nodeIds.has(mem.id)) {
      nodes.push({
        id: mem.id,
        label: (mem.content?.text || '').substring(0, 50) + '...',
        type: 'memory',
        category: mem.category,
        importance: mem.importance
      });
      nodeIds.add(mem.id);
    }

    // Add relationships
    (record.relationships || []).forEach(rel => {
      if (rel.target) {
        edges.push({
          source: mem.id,
          target: rel.target,
          type: rel.type
        });

        // Add user nodes if not already present
        if (rel.label === 'User' && !nodeIds.has(rel.target)) {
          nodes.push({
            id: rel.target,
            label: rel.target,
            type: 'user'
          });
          nodeIds.add(rel.target);
        }
      }
    });
  });

  return { nodes, edges };
}

/**
 * Get statistics
 */
async function getStatistics() {
  const data = await getAllMemories(1000);

  return {
    ...data.statistics,
    categories: CATEGORIES,
    stages: STAGES
  };
}

/**
 * Calculate statistics from memories array
 */
function calculateStatistics(memories) {
  const stats = {
    total: memories.length,
    byCategory: {},
    byStage: {},
    byType: {}
  };

  memories.forEach(m => {
    stats.byCategory[m.category] = (stats.byCategory[m.category] || 0) + 1;
    stats.byStage[m.stage] = (stats.byStage[m.stage] || 0) + 1;
    stats.byType[m.type] = (stats.byType[m.type] || 0) + 1;
  });

  return stats;
}

/**
 * Calculate similarity between two memories
 */
function calculateSimilarity(mem1, mem2) {
  let score = 0;

  // Same category
  if (mem1.category === mem2.category) score += 0.3;

  // Same stage
  if (mem1.stage === mem2.stage) score += 0.2;

  // Common tags
  const tags1 = mem1.tags || [];
  const tags2 = mem2.tags || [];
  const commonTags = tags1.filter(t => tags2.includes(t));
  if (tags1.length && tags2.length) {
    score += (commonTags.length / Math.max(tags1.length, tags2.length)) * 0.5;
  }

  return score;
}

/**
 * Sync file backup to Neo4j
 */
async function syncToNeo4j() {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    return { success: false, error: 'Neo4j not available' };
  }

  const data = await loadFromFile();
  let synced = 0;

  for (const memory of data.memories) {
    await neo4j.upsertMemory(memory);
    synced++;
  }

  console.log(`🔄 Synced ${synced} memories to Neo4j`);
  return { success: true, synced };
}

/**
 * Check Neo4j availability (catches errors)
 */
async function isNeo4jAvailable() {
  const neo4j = getNeo4jService();
  return await neo4j.isAvailable().catch(() => false);
}

/**
 * Get Neo4j status with detailed error info
 */
async function getNeo4jStatus() {
  const neo4j = getNeo4jService();
  return await neo4j.getFullStatus();
}

/**
 * Get memories with issues for maintenance
 */
async function getMaintenanceData() {
  const data = await getAllMemories(0);
  const memories = data.memories || [];

  const untagged = memories.filter(m => !m.tags || m.tags.length === 0);
  const noSource = memories.filter(m => !m.source || m.source === 'manual');

  return {
    summary: {
      totalCount: memories.length,
      untaggedCount: untagged.length,
      noSourceCount: noSource.length
    },
    untagged: untagged.slice(0, 50),
    noSource: noSource.slice(0, 50)
  };
}

/**
 * Bulk delete memories
 */
async function bulkDeleteMemories(ids) {
  const neo4j = getNeo4jService();
  let deleted = 0;

  for (const id of ids) {
    const result = await deleteMemory(id);
    if (result.success) deleted++;
  }

  return { success: true, deleted };
}

/**
 * Generate auto-fix suggestions
 */
async function previewAutoFixes() {
  const data = await getMaintenanceData();
  const fixes = [];

  // Suggest tags for untagged memories
  for (const memory of data.untagged.slice(0, 20)) {
    const suggestedTags = autoTag(memory);
    if (suggestedTags.length > 0) {
      fixes.push({
        type: 'add_tags',
        memoryId: memory.id,
        suggestedTags,
        reasoning: `Auto-detected keywords: ${suggestedTags.join(', ')}`
      });
    }
  }

  // Suggest source for memories without source
  for (const memory of data.noSource.slice(0, 20)) {
    fixes.push({
      type: 'add_source',
      memoryId: memory.id,
      suggestedSource: 'legacy',
      reasoning: 'Memory has no source, marking as legacy data'
    });
  }

  return {
    success: true,
    summary: `Found ${fixes.length} potential fixes`,
    fixes
  };
}

/**
 * Apply auto-fix suggestions
 */
async function applyAutoFixes(fixes) {
  let applied = 0;

  for (const fix of fixes) {
    if (fix.type === 'add_tags') {
      const memory = await getMemory(fix.memoryId);
      if (memory) {
        const existingTags = memory.tags || [];
        const newTags = [...new Set([...existingTags, ...fix.suggestedTags])];
        await updateMemory(fix.memoryId, { tags: newTags });
        applied++;
      }
    } else if (fix.type === 'add_source') {
      await updateMemory(fix.memoryId, { source: fix.suggestedSource });
      applied++;
    }
  }

  return { success: true, applied };
}

/**
 * Smart connect - find and create relationships between memories
 */
async function smartConnect(ids) {
  const neo4j = getNeo4jService();
  let connections = 0;

  if (!await neo4j.isAvailable()) {
    return { success: false, error: 'Neo4j not available' };
  }

  const memories = [];
  for (const id of ids) {
    const mem = await getMemory(id);
    if (mem) memories.push(mem);
  }

  // Find connections based on shared tags and content similarity
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const similarity = calculateSimilarity(memories[i], memories[j]);
      if (similarity >= 0.5) {
        await neo4j.write(`
          MATCH (m1:Memory {id: $id1}), (m2:Memory {id: $id2})
          MERGE (m1)-[:RELATES_TO {score: $score}]->(m2)
        `, {
          id1: memories[i].id,
          id2: memories[j].id,
          score: similarity
        });
        connections++;
      }
    }
  }

  return { success: true, totalConnections: connections, processed: memories.length };
}

module.exports = {
  getAllMemories,
  getMemory,
  createMemory,
  updateMemory,
  deleteMemory,
  searchMemories,
  getMemoriesByKeywords,
  getMemoriesByCategory,
  getRecentMemories,
  getRelatedMemories,
  recordAccess,
  getGraphData,
  getStatistics,
  syncToNeo4j,
  isNeo4jAvailable,
  getNeo4jStatus,
  getMaintenanceData,
  bulkDeleteMemories,
  previewAutoFixes,
  applyAutoFixes,
  smartConnect,
  CATEGORIES,
  STAGES
};
