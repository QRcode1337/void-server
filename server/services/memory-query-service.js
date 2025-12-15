/**
 * Memory Query Service
 *
 * Provides intelligent memory retrieval for content generation context.
 * Uses Neo4j graph queries to find relevant memories based on:
 * - Users (who we're talking to)
 * - Keywords/concepts (what we're talking about)
 * - Temporal proximity (recent events)
 * - Graph connections (related memories)
 */

const { getNeo4jService } = require('./neo4j-service');
const { getEmbeddingService } = require('./embedding-service');

/**
 * Format memory from Neo4j result
 */
function formatMemory(memoryNode) {
  const props = memoryNode.properties || memoryNode;

  return {
    id: props.id,
    content: typeof props.content === 'string' ? props.content : props.content?.text || '',
    context: props.context || props.content?.context || '',
    category: props.category,
    importance: props.importance,
    timestamp: props.timestamp,
    tags: props.tags || [],
    source: props.source
  };
}

/**
 * Deduplicate memories by ID
 */
function deduplicateMemories(memories) {
  const seen = new Set();
  return memories.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * Rank memories by relevance score and importance
 */
function rankMemories(memories) {
  return memories.sort((a, b) => {
    // Primary sort: relevance score (from query source)
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    // Secondary sort: importance
    return (b.importance || 0) - (a.importance || 0);
  });
}

/**
 * Get memories about a specific user
 */
async function getMemoriesAboutUser(userHandle, limit = 3) {
  const neo4j = getNeo4jService();

  const normalizedHandle = userHandle.startsWith('@') ? userHandle : `@${userHandle}`;
  const limitInt = Math.floor(limit);

  const result = await neo4j.read(`
    MATCH (m:Memory)-[:MENTIONS]->(u:User {handle: $userHandle})
    RETURN m
    ORDER BY m.timestamp DESC
    LIMIT ${limitInt}
  `, { userHandle: normalizedHandle });

  return result.map(r => formatMemory(r.m));
}

/**
 * Get memories matching keywords (content or tags)
 */
async function getMemoriesByKeywords(keywords, limit = 5) {
  if (!keywords || keywords.length === 0) return [];

  const neo4j = getNeo4jService();
  const limitInt = Math.floor(limit);

  const result = await neo4j.read(`
    MATCH (m:Memory)
    WHERE any(keyword IN $keywords WHERE
      toLower(m.content) CONTAINS toLower(keyword)
      OR any(tag IN m.tags WHERE toLower(tag) CONTAINS toLower(keyword))
    )
    RETURN m, m.importance as importance
    ORDER BY importance DESC, m.timestamp DESC
    LIMIT ${limitInt}
  `, { keywords });

  return result.map(r => formatMemory(r.m));
}

/**
 * Get memories by category
 */
async function getMemoriesByCategory(category, limit = 3) {
  const neo4j = getNeo4jService();
  const limitInt = Math.floor(limit);

  const result = await neo4j.read(`
    MATCH (m:Memory {category: $category})
    RETURN m
    ORDER BY m.importance DESC, m.timestamp DESC
    LIMIT ${limitInt}
  `, { category });

  return result.map(r => formatMemory(r.m));
}

/**
 * Get recent high-importance memories
 */
async function getRecentMemories(limit = 3, minImportance = 0.7) {
  const neo4j = getNeo4jService();
  const limitInt = Math.floor(limit);

  const result = await neo4j.read(`
    MATCH (m:Memory)
    WHERE m.importance >= $minImportance
    RETURN m
    ORDER BY m.timestamp DESC
    LIMIT ${limitInt}
  `, { minImportance });

  return result.map(r => formatMemory(r.m));
}

/**
 * Search memories by semantic similarity (using embeddings)
 */
async function searchBySemantic(queryText, limit = 5) {
  const neo4j = getNeo4jService();
  const embedding = getEmbeddingService();

  // Check if embedding service is available
  if (!await embedding.isAvailable()) {
    return [];
  }

  // Generate embedding for query
  const queryEmbedding = await embedding.generateEmbedding(queryText);
  if (!queryEmbedding) return [];

  // Get all memories with embeddings from Neo4j
  const result = await neo4j.read(`
    MATCH (m:Memory)
    WHERE m.embedding IS NOT NULL
    RETURN m
  `);

  if (result.length === 0) return [];

  // Calculate similarity scores
  const similarities = result.map(r => {
    const memory = formatMemory(r.m);
    const memoryEmbedding = r.m.properties?.embedding;

    if (!memoryEmbedding) return { memory, similarity: 0 };

    const similarity = embedding.cosineSimilarity(queryEmbedding, memoryEmbedding);
    return { memory, similarity };
  });

  // Sort by similarity and return top N
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(item => ({
      ...item.memory,
      similarity: item.similarity
    }));
}

/**
 * Extract keywords from text for memory search
 */
function extractKeywords(text) {
  if (!text) return [];

  // Remove common words and extract significant terms
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
    'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
    'she', 'her', 'it', 'its', 'they', 'them', 'their', 'this', 'that',
    'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why'
  ]);

  // Extract words, filter out stop words and short words
  const words = text.toLowerCase()
    .replace(/[^\w\s@#]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Keep unique words
  return [...new Set(words)];
}

/**
 * Get relevant memories for content generation
 *
 * @param {Object} context
 * @param {string} context.userHandle - User being interacted with (e.g., "@username")
 * @param {string[]} context.keywords - Keywords from source content
 * @param {string} context.category - Content category (emergence, void, etc.)
 * @param {string} context.message - Original message (for keyword extraction)
 * @param {number} context.limit - Max memories to return (default: 5)
 * @returns {Array} Ranked list of relevant memories
 */
async function getRelevantMemories(context) {
  const neo4j = getNeo4jService();

  // Check if Neo4j is available
  if (!await neo4j.isAvailable()) {
    return [];
  }

  const {
    userHandle,
    keywords: providedKeywords = [],
    message,
    category,
    limit = 5
  } = context;

  const allMemories = [];

  // Extract keywords from message if not provided
  const keywords = providedKeywords.length > 0
    ? providedKeywords
    : extractKeywords(message);

  // 1. Semantic search using embeddings (highest relevance: 12)
  if (message) {
    const semanticMemories = await searchBySemantic(message, 5).catch(() => []);
    allMemories.push(...semanticMemories.map(m => ({
      ...m,
      relevanceScore: 12 * (m.similarity || 0.5), // Scale by similarity
      matchSource: 'semantic'
    })));
  }

  // 2. Get memories related to this user (relevance: 10)
  if (userHandle) {
    const userMemories = await getMemoriesAboutUser(userHandle, 3);
    allMemories.push(...userMemories.map(m => ({
      ...m,
      relevanceScore: 10,
      matchSource: 'user'
    })));
  }

  // 3. Get memories matching keywords (relevance: 8)
  if (keywords.length > 0) {
    const keywordMemories = await getMemoriesByKeywords(keywords, 5);
    allMemories.push(...keywordMemories.map(m => ({
      ...m,
      relevanceScore: 8,
      matchSource: 'keyword'
    })));
  }

  // 4. Get memories in same category (relevance: 6)
  if (category) {
    const categoryMemories = await getMemoriesByCategory(category, 3);
    allMemories.push(...categoryMemories.map(m => ({
      ...m,
      relevanceScore: 6,
      matchSource: 'category'
    })));
  }

  // 5. Get recent significant memories (relevance: 5)
  const recentMemories = await getRecentMemories(3);
  allMemories.push(...recentMemories.map(m => ({
    ...m,
    relevanceScore: 5,
    matchSource: 'recent'
  })));

  // Deduplicate and rank
  const uniqueMemories = deduplicateMemories(allMemories);
  const rankedMemories = rankMemories(uniqueMemories);

  return rankedMemories.slice(0, limit);
}

/**
 * Format memories for prompt injection
 * Returns a markdown string ready to add to prompts
 */
function formatMemoriesForPrompt(memories) {
  if (!memories || memories.length === 0) {
    return '';
  }

  let output = '\n## Relevant Context from Memory\n\n';

  memories.forEach(memory => {
    const date = memory.timestamp
      ? new Date(memory.timestamp).toISOString().split('T')[0]
      : 'unknown';

    output += `- [${memory.category || 'general'}] ${memory.content}`;
    if (memory.context) {
      output += ` (${memory.context})`;
    }
    output += ` [${date}]\n`;
  });

  return output;
}

/**
 * Create a new memory from a chat exchange
 */
async function createMemoryFromChat(userMessage, aiResponse, metadata = {}) {
  const memoryService = require('./memory-service');

  // Extract key information for the memory
  const contentText = `User said: "${userMessage.substring(0, 200)}..." | Response included: "${aiResponse.substring(0, 200)}..."`;

  const memory = {
    content: {
      text: contentText,
      context: metadata.template || 'chat',
      impact: 'conversation',
      significance: 'normal'
    },
    category: metadata.category || 'social',
    stage: 1,
    importance: metadata.importance || 0.5,
    type: 'interaction',
    source: 'chat',
    relatedUsers: metadata.userHandle ? [metadata.userHandle] : [],
    tags: extractKeywords(userMessage).slice(0, 5)
  };

  return await memoryService.createMemory(memory);
}

module.exports = {
  getRelevantMemories,
  formatMemoriesForPrompt,
  extractKeywords,
  searchBySemantic,
  createMemoryFromChat,
  getMemoriesAboutUser,
  getMemoriesByKeywords,
  getMemoriesByCategory,
  getRecentMemories
};
