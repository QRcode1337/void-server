/**
 * Memory API Routes
 *
 * Provides REST endpoints for memory CRUD operations and graph visualization.
 */

const express = require('express');
const router = express.Router();
const memoryService = require('../services/memory-service');
const memoryQueryService = require('../services/memory-query-service');
const { getEmbeddingService } = require('../services/embedding-service');
const { getNeo4jService } = require('../services/neo4j-service');
const lmstudioCli = require('../services/lmstudio-cli');

// GET /api/memories - List all memories with stats
router.get('/', async (req, res) => {
  console.log(`📋 GET /api/memories`);

  // limit=0 means no limit (fetch all), undefined defaults to 100
  const limitParam = req.query.limit;
  const limit = limitParam !== undefined ? parseInt(limitParam) : 100;
  const data = await memoryService.getAllMemories(limit);

  res.json({
    success: true,
    ...data
  });
});

// GET /api/memories/search - Full-text search
router.get('/search', async (req, res) => {
  const { q } = req.query;
  console.log(`🔍 GET /api/memories/search q=${q}`);

  if (!q) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" required' });
  }

  const results = await memoryService.searchMemories(q);

  res.json({
    success: true,
    query: q,
    count: results.length,
    memories: results
  });
});

// GET /api/memories/filter - Advanced filtering
router.get('/filter', async (req, res) => {
  console.log(`🔍 GET /api/memories/filter`);

  const filters = {
    category: req.query.category,
    stage: req.query.stage ? parseInt(req.query.stage) : undefined,
    tags: req.query.tags ? req.query.tags.split(',') : undefined,
    minImportance: req.query.minImportance ? parseFloat(req.query.minImportance) : undefined
  };

  // Remove undefined values
  Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

  let results;

  if (filters.category) {
    results = await memoryService.getMemoriesByCategory(filters.category, 50);
  } else if (filters.tags) {
    results = await memoryService.getMemoriesByKeywords(filters.tags, 50);
  } else {
    const data = await memoryService.getAllMemories(100);
    results = data.memories;
  }

  // Apply additional filters
  if (filters.stage) {
    results = results.filter(m => m.stage === filters.stage);
  }
  if (filters.minImportance) {
    results = results.filter(m => m.importance >= filters.minImportance);
  }

  res.json({
    success: true,
    filters,
    count: results.length,
    memories: results
  });
});

// GET /api/memories/stats - Statistics
router.get('/stats', async (req, res) => {
  console.log(`📊 GET /api/memories/stats`);

  const stats = await memoryService.getStatistics();

  res.json({
    success: true,
    ...stats
  });
});

// GET /api/memories/graph - Graph data for visualization
router.get('/graph', async (req, res) => {
  console.log(`📊 GET /api/memories/graph`);

  const graphData = await memoryService.getGraphData();

  console.log(`✅ Graph data: ${graphData.nodes.length} nodes, ${graphData.edges.length} edges`);

  res.json({
    success: true,
    ...graphData
  });
});

// GET /api/memories/status - Neo4j connection status
router.get('/status', async (req, res) => {
  console.log(`📊 GET /api/memories/status`);

  const neo4jStatus = await memoryService.getNeo4jStatus();

  res.json({
    success: true,
    neo4j: neo4jStatus
  });
});

// GET /api/memories/config - Get Neo4j configuration
router.get('/config', (req, res) => {
  console.log(`⚙️ GET /api/memories/config`);

  const neo4j = getNeo4jService();
  const config = neo4j.getConfig();

  res.json({
    success: true,
    config
  });
});

// PUT /api/memories/config - Update Neo4j configuration
router.put('/config', async (req, res) => {
  console.log(`⚙️ PUT /api/memories/config`);

  const neo4j = getNeo4jService();
  const result = await neo4j.updateConfig(req.body);

  res.json({
    success: result.connected,
    message: result.connected ? 'Connected successfully' : result.error,
    config: neo4j.getConfig()
  });
});

// GET /api/memories/context - Get relevant memories for chat context
router.get('/context', async (req, res) => {
  const { message, user, category, limit } = req.query;
  console.log(`🧠 GET /api/memories/context message="${(message || '').substring(0, 50)}..."`);

  const memories = await memoryQueryService.getRelevantMemories({
    message,
    userHandle: user,
    category,
    limit: parseInt(limit) || 5
  });

  const formattedContext = memoryQueryService.formatMemoriesForPrompt(memories);

  res.json({
    success: true,
    count: memories.length,
    memories,
    context: formattedContext
  });
});

// GET /api/memories/:id - Get single memory
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`📋 GET /api/memories/${id}`);

  const memory = await memoryService.getMemory(id);

  if (!memory) {
    return res.status(404).json({ success: false, error: `Memory ${id} not found` });
  }

  res.json({
    success: true,
    memory
  });
});

// GET /api/memories/:id/related - Find related memories
router.get('/:id/related', async (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 5;
  console.log(`🔗 GET /api/memories/${id}/related limit=${limit}`);

  const related = await memoryService.getRelatedMemories(id, limit);

  res.json({
    success: true,
    memoryId: id,
    count: related.length,
    related
  });
});

// POST /api/memories - Create memory
router.post('/', async (req, res) => {
  console.log(`➕ POST /api/memories`);

  const memory = await memoryService.createMemory(req.body);

  res.status(201).json({
    success: true,
    memory
  });
});

// PUT /api/memories/:id - Update memory
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`✏️ PUT /api/memories/${id}`);

  const result = await memoryService.updateMemory(id, req.body);

  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
});

// DELETE /api/memories/:id - Delete memory
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`🗑️ DELETE /api/memories/${id}`);

  const result = await memoryService.deleteMemory(id);

  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
});

// POST /api/memories/:id/access - Track memory access
router.post('/:id/access', async (req, res) => {
  const { id } = req.params;
  console.log(`👁️ POST /api/memories/${id}/access`);

  await memoryService.recordAccess(id);

  res.json({ success: true });
});

// POST /api/memories/sync - Sync file backup to Neo4j
router.post('/sync', async (req, res) => {
  console.log(`🔄 POST /api/memories/sync`);

  const result = await memoryService.syncToNeo4j();

  res.json(result);
});

// ============ Maintenance Routes ============

// GET /api/memories/maintenance/all - Get maintenance data
router.get('/maintenance/all', async (req, res) => {
  console.log(`🔧 GET /api/memories/maintenance/all`);

  const data = await memoryService.getMaintenanceData();

  res.json({
    success: true,
    ...data
  });
});

// POST /api/memories/maintenance/bulk-delete - Bulk delete memories
router.post('/maintenance/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  console.log(`🗑️ POST /api/memories/maintenance/bulk-delete ids=${ids?.length}`);

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'ids array required' });
  }

  const result = await memoryService.bulkDeleteMemories(ids);

  res.json(result);
});

// POST /api/memories/maintenance/smart-connect - Create connections between memories
router.post('/maintenance/smart-connect', async (req, res) => {
  const { ids } = req.body;
  console.log(`🔗 POST /api/memories/maintenance/smart-connect ids=${ids?.length}`);

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, error: 'ids array required' });
  }

  const result = await memoryService.smartConnect(ids);

  res.json(result);
});

// POST /api/memories/maintenance/auto-fix/preview - Preview auto-fix suggestions
router.post('/maintenance/auto-fix/preview', async (req, res) => {
  console.log(`🔮 POST /api/memories/maintenance/auto-fix/preview`);

  const result = await memoryService.previewAutoFixes();

  res.json(result);
});

// POST /api/memories/maintenance/auto-fix/apply - Apply auto-fix suggestions
router.post('/maintenance/auto-fix/apply', async (req, res) => {
  const { fixes } = req.body;
  console.log(`✨ POST /api/memories/maintenance/auto-fix/apply fixes=${fixes?.length}`);

  if (!fixes || !Array.isArray(fixes)) {
    return res.status(400).json({ success: false, error: 'fixes array required' });
  }

  const result = await memoryService.applyAutoFixes(fixes);

  res.json(result);
});

// ============================================================================
// Embedding / LM Studio Status
// ============================================================================

// GET /api/memories/embedding/status - Get embedding service status
router.get('/embedding/status', async (req, res) => {
  console.log(`📊 GET /api/memories/embedding/status`);

  const embeddingService = getEmbeddingService();
  const status = embeddingService.getFullStatus();

  // Test actual API connection
  const connectionTest = await embeddingService.testConnection().catch(err => ({
    connected: false,
    error: err.message
  }));

  res.json({
    success: true,
    ...status,
    api: connectionTest
  });
});

// GET /api/memories/embedding/models - List available embedding models
router.get('/embedding/models', (req, res) => {
  console.log(`📊 GET /api/memories/embedding/models`);

  const embeddingService = getEmbeddingService();
  const models = embeddingService.getAvailableModels();

  res.json({
    success: true,
    ...models
  });
});

// PUT /api/memories/embedding/provider - Switch embedding provider
router.put('/embedding/provider', async (req, res) => {
  const { provider } = req.body;
  console.log(`🔄 PUT /api/memories/embedding/provider provider=${provider}`);

  if (!['ollama', 'lmstudio', 'auto'].includes(provider)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid provider. Use "ollama", "lmstudio", or "auto"'
    });
  }

  const embeddingService = getEmbeddingService();

  if (provider === 'auto') {
    await embeddingService.initialize();
  } else {
    embeddingService.setProvider(provider);
  }

  const available = await embeddingService.isAvailable();

  res.json({
    success: true,
    provider: embeddingService.activeProvider,
    available,
    message: available
      ? `Switched to ${embeddingService.activeProvider}`
      : `Switched to ${embeddingService.activeProvider} but service not available`
  });
});

// GET /api/memories/lmstudio/models - List all LM Studio models (LLM + embedding)
router.get('/lmstudio/models', (req, res) => {
  console.log(`📊 GET /api/memories/lmstudio/models`);

  const models = lmstudioCli.getAvailableModels(req.query.refresh === 'true');
  const loaded = lmstudioCli.getLoadedModels();

  res.json({
    success: models.available,
    error: models.error,
    downloaded: {
      llm: models.llm || [],
      embedding: models.embedding || []
    },
    loaded: loaded.models || []
  });
});

module.exports = router;
