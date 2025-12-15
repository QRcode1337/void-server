/**
 * Neo4j Service
 *
 * Manages connections to Neo4j graph database and provides
 * query builders for memory and relationship management.
 */

const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '../../config');
const NEO4J_CONFIG_PATH = path.join(CONFIG_DIR, 'neo4j.json');

const DEFAULT_CONFIG = {
  uri: 'bolt://localhost:7687',
  user: 'neo4j',
  password: 'clawedcode',
  database: 'neo4j'
};

/**
 * Load Neo4j configuration from file
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (!fs.existsSync(NEO4J_CONFIG_PATH)) {
    fs.writeFileSync(NEO4J_CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }

  const saved = JSON.parse(fs.readFileSync(NEO4J_CONFIG_PATH, 'utf8'));
  return { ...DEFAULT_CONFIG, ...saved };
}

/**
 * Save Neo4j configuration to file
 */
function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(NEO4J_CONFIG_PATH, JSON.stringify(config, null, 2));
}

class Neo4jService {
  constructor(options = {}) {
    // Load config from file first
    const fileConfig = loadConfig();

    // Priority: options > env vars > file config > defaults
    this.uri = options.uri || process.env.NEO4J_URI || fileConfig.uri;
    this.user = options.user || process.env.NEO4J_USER || fileConfig.user;
    this.password = options.password || process.env.NEO4J_PASSWORD || fileConfig.password;
    this.database = options.database || process.env.NEO4J_DATABASE || fileConfig.database;

    this.driver = null;
    this.connected = false;
    this.connectionError = null;
    this.lastErrorCode = null;

    // Log if using environment variable overrides
    if (process.env.NEO4J_URI) {
      console.log(`🔧 Neo4j URI from environment: ${this.uri}`);
    }
  }

  /**
   * Get current configuration (without password)
   */
  getConfig() {
    return {
      uri: this.uri,
      user: this.user,
      database: this.database,
      hasPassword: !!this.password
    };
  }

  /**
   * Update configuration and reconnect
   */
  async updateConfig(newConfig) {
    // Update instance properties
    if (newConfig.uri) this.uri = newConfig.uri;
    if (newConfig.user) this.user = newConfig.user;
    if (newConfig.password && newConfig.password !== '••••••••') {
      this.password = newConfig.password;
    }
    if (newConfig.database) this.database = newConfig.database;

    // Save to file (don't save env var overrides)
    if (!process.env.NEO4J_URI) {
      const configToSave = {
        uri: this.uri,
        user: this.user,
        password: this.password,
        database: this.database
      };
      saveConfig(configToSave);
    }

    // Disconnect existing connection
    await this.disconnect();

    // Try to reconnect with new settings
    return await this.tryConnect();
  }

  /**
   * Parse Neo4j error into user-friendly message
   */
  parseConnectionError(error) {
    const code = error.code || '';
    const message = error.message || '';

    // Connection refused - Neo4j not running
    if (code === 'ServiceUnavailable' || message.includes('Failed to connect')) {
      return {
        code: 'NOT_RUNNING',
        message: 'Neo4j is not running',
        details: 'Please start Neo4j to enable the memory system.',
        help: [
          'If using Neo4j Desktop: Open the app and start your database',
          'If using Homebrew: Run "neo4j start"',
          'If using Docker: Run "docker start neo4j-void"',
          'See docs/CHAT.md for setup instructions'
        ]
      };
    }

    // Authentication failed
    if (code === 'Neo.ClientError.Security.Unauthorized' || message.includes('authentication')) {
      return {
        code: 'AUTH_FAILED',
        message: 'Neo4j authentication failed',
        details: 'Check your Neo4j username and password.',
        help: [
          'Default credentials: neo4j / clawedcode',
          'Set NEO4J_USER and NEO4J_PASSWORD in .env file',
          'Or update password in Neo4j Browser at http://localhost:7474'
        ]
      };
    }

    // Database not found
    if (message.includes('database') && message.includes('not found')) {
      return {
        code: 'DB_NOT_FOUND',
        message: 'Neo4j database not found',
        details: `Database "${this.database}" does not exist.`,
        help: [
          'Create the database in Neo4j Browser',
          'Or set NEO4J_DATABASE=neo4j in .env file'
        ]
      };
    }

    // Generic error
    return {
      code: 'CONNECTION_ERROR',
      message: 'Cannot connect to Neo4j',
      details: message,
      help: [
        'Ensure Neo4j is installed and running',
        'Check the connection URI: ' + this.uri,
        'See docs/CHAT.md for setup instructions'
      ]
    };
  }

  /**
   * Initialize connection to Neo4j
   */
  async connect() {
    if (this.connected) return true;

    this.driver = neo4j.driver(
      this.uri,
      neo4j.auth.basic(this.user, this.password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000
      }
    );

    // Verify connectivity
    await this.driver.verifyConnectivity();
    this.connected = true;
    this.connectionError = null;
    this.lastErrorCode = null;
    console.log(`🧠 Connected to Neo4j at ${this.uri}`);
    return true;
  }

  /**
   * Check if Neo4j is available (non-throwing)
   */
  async isAvailable() {
    if (this.connected) return true;

    this.driver = neo4j.driver(
      this.uri,
      neo4j.auth.basic(this.user, this.password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 5000
      }
    );

    await this.driver.verifyConnectivity();
    this.connected = true;
    this.connectionError = null;
    this.lastErrorCode = null;
    return true;
  }

  /**
   * Try to connect, capturing errors for status reporting
   */
  async tryConnect() {
    if (this.connected) return { success: true };

    this.driver = neo4j.driver(
      this.uri,
      neo4j.auth.basic(this.user, this.password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 5000
      }
    );

    await this.driver.verifyConnectivity();
    this.connected = true;
    this.connectionError = null;
    this.lastErrorCode = null;
    console.log('🧠 Connected to Neo4j');
    return { success: true };
  }

  /**
   * Get connection status with detailed error info
   */
  getStatus() {
    return {
      connected: this.connected,
      uri: this.uri,
      database: this.database,
      error: this.connectionError,
      errorCode: this.lastErrorCode
    };
  }

  /**
   * Get full status including connection attempt
   */
  async getFullStatus() {
    // Try to connect if not connected
    if (!this.connected) {
      await this.tryConnect().catch(err => {
        const parsed = this.parseConnectionError(err);
        this.connectionError = parsed;
        this.lastErrorCode = parsed.code;
        console.log(`⚠️ Neo4j: ${parsed.message} - ${parsed.details}`);
      });
    }

    return {
      connected: this.connected,
      uri: this.uri,
      database: this.database,
      error: this.connectionError,
      errorCode: this.lastErrorCode
    };
  }

  /**
   * Close connection to Neo4j
   */
  async close() {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.connected = false;
      console.log('🧠 Disconnected from Neo4j');
    }
  }

  /**
   * Disconnect and reset for reconnection with new settings
   */
  async disconnect() {
    await this.close();
    this.connectionError = null;
    this.lastErrorCode = null;
  }

  /**
   * Execute a read query
   */
  async read(cypher, params = {}) {
    await this.connect();

    const session = this.driver.session({ database: this.database });

    const result = await session.run(cypher, params);
    await session.close();

    return result.records.map(record => record.toObject());
  }

  /**
   * Execute a write query
   */
  async write(cypher, params = {}) {
    await this.connect();

    const session = this.driver.session({ database: this.database });

    const result = await session.run(cypher, params);
    await session.close();

    return result.records.map(record => record.toObject());
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries) {
    await this.connect();

    const session = this.driver.session({ database: this.database });
    const tx = session.beginTransaction();

    const results = [];
    for (const { cypher, params } of queries) {
      const result = await tx.run(cypher, params);
      results.push(result.records.map(record => record.toObject()));
    }

    await tx.commit();
    await session.close();

    return results;
  }

  /**
   * Create or update a Memory node
   */
  async upsertMemory(memory) {
    const cypher = `
      MERGE (m:Memory {id: $id})
      SET m.content = $content,
          m.category = $category,
          m.stage = $stage,
          m.importance = $importance,
          m.timestamp = datetime($timestamp),
          m.tags = $tags,
          m.type = $type,
          m.context = $context,
          m.impact = $impact,
          m.significance = $significance,
          m.embedding = $embedding,
          m.relevance = $relevance,
          m.interactions = $interactions,
          m.views = $views,
          m.lastAccessed = datetime($lastAccessed),
          m.source = $source,
          m.relatedUsers = $relatedUsers
      RETURN m
    `;

    const params = {
      id: memory.id,
      content: memory.content?.text || memory.content || '',
      category: memory.category || 'emergence',
      stage: memory.stage || 1,
      importance: memory.importance || 0.5,
      timestamp: memory.timestamp || new Date().toISOString(),
      tags: memory.tags || [],
      type: memory.type || 'observation',
      context: memory.content?.context || '',
      impact: memory.content?.impact || '',
      significance: memory.content?.significance || 'normal',
      embedding: memory.embedding || null,
      relevance: memory.metrics?.relevance || 0.5,
      interactions: memory.metrics?.interactions || 0,
      views: memory.metrics?.views || 0,
      lastAccessed: memory.metrics?.lastAccessed || new Date().toISOString(),
      source: memory.source || null,
      relatedUsers: memory.relatedUsers || []
    };

    const result = await this.write(cypher, params);
    return result[0]?.m;
  }

  /**
   * Delete a Memory node
   */
  async deleteMemory(memoryId) {
    const cypher = `
      MATCH (m:Memory {id: $memoryId})
      DETACH DELETE m
      RETURN count(m) as deleted
    `;

    const result = await this.write(cypher, { memoryId });
    return result[0]?.deleted > 0;
  }

  /**
   * Create or update a User node
   */
  async upsertUser(user) {
    const cypher = `
      MERGE (u:User {handle: $handle})
      SET u.id = $id,
          u.status = $status,
          u.joined = datetime($joined),
          u.lastSeen = datetime($lastSeen),
          u.totalInteractions = $totalInteractions
      RETURN u
    `;

    const params = {
      handle: user.handle,
      id: user.id || user.handle,
      status: user.status || 'active',
      joined: user.joined || new Date().toISOString(),
      lastSeen: user.lastSeen || new Date().toISOString(),
      totalInteractions: user.totalInteractions || 0
    };

    const result = await this.write(cypher, params);
    return result[0]?.u;
  }

  /**
   * Create relationship between memory and user (MENTIONS)
   */
  async linkMemoryToUser(memoryId, userHandle) {
    const cypher = `
      MATCH (m:Memory {id: $memoryId})
      MERGE (u:User {handle: $userHandle})
      MERGE (m)-[r:MENTIONS]->(u)
      SET r.timestamp = datetime()
      RETURN m, u
    `;

    return await this.write(cypher, { memoryId, userHandle });
  }

  /**
   * Create relationship between memories (RELATES_TO)
   */
  async linkMemories(fromMemoryId, toMemoryId, relationshipType = 'RELATES_TO') {
    const cypher = `
      MATCH (m1:Memory {id: $fromId})
      MATCH (m2:Memory {id: $toId})
      MERGE (m1)-[r:${relationshipType}]->(m2)
      SET r.timestamp = datetime()
      RETURN m1, m2
    `;

    return await this.write(cypher, { fromId: fromMemoryId, toId: toMemoryId });
  }

  /**
   * Search memories by text
   */
  async searchMemories(query, filters = {}) {
    let cypher = `
      MATCH (m:Memory)
      WHERE toLower(m.content) CONTAINS toLower($query)
        OR any(tag IN m.tags WHERE toLower(tag) CONTAINS toLower($query))
    `;

    const params = { query };

    if (filters.category) {
      cypher += ` AND m.category = $category`;
      params.category = filters.category;
    }

    if (filters.stage) {
      cypher += ` AND m.stage = $stage`;
      params.stage = neo4j.int(filters.stage);
    }

    if (filters.minImportance) {
      cypher += ` AND m.importance >= $minImportance`;
      params.minImportance = filters.minImportance;
    }

    cypher += `
      RETURN m
      ORDER BY m.importance DESC, m.timestamp DESC
      LIMIT $limit
    `;
    params.limit = neo4j.int(filters.limit || 10);

    return await this.read(cypher, params);
  }

  /**
   * Get all memories
   */
  async getAllMemories(limit = 100) {
    const cypher = `
      MATCH (m:Memory)
      RETURN m
      ORDER BY m.timestamp DESC
      LIMIT $limit
    `;

    return await this.read(cypher, { limit: neo4j.int(limit) });
  }

  /**
   * Get memory by ID
   */
  async getMemory(memoryId) {
    const cypher = `
      MATCH (m:Memory {id: $memoryId})
      RETURN m
    `;

    const result = await this.read(cypher, { memoryId });
    return result[0]?.m || null;
  }

  /**
   * Get related memories using graph traversal
   */
  async getRelatedMemories(memoryId, limit = 5) {
    const cypher = `
      MATCH (m:Memory {id: $memoryId})
      MATCH (m)-[:RELATES_TO*1..2]-(related:Memory)
      WHERE related.id <> $memoryId
      RETURN DISTINCT related
      ORDER BY related.importance DESC
      LIMIT $limit
    `;

    return await this.read(cypher, { memoryId, limit: neo4j.int(limit) });
  }

  /**
   * Record an interaction with a memory (increases relevance)
   */
  async recordMemoryAccess(memoryId) {
    const cypher = `
      MATCH (m:Memory {id: $memoryId})
      SET m.views = coalesce(m.views, 0) + 1,
          m.lastAccessed = datetime(),
          m.relevance = CASE
            WHEN m.relevance < 1.0 THEN m.relevance + 0.01
            ELSE 1.0
          END
      RETURN m
    `;

    return await this.write(cypher, { memoryId });
  }

  /**
   * Get memories by category
   */
  async getMemoriesByCategory(category, limit = 10) {
    const cypher = `
      MATCH (m:Memory {category: $category})
      RETURN m
      ORDER BY m.importance DESC, m.timestamp DESC
      LIMIT $limit
    `;

    return await this.read(cypher, { category, limit: neo4j.int(limit) });
  }

  /**
   * Get memories by keywords (content or tags)
   */
  async getMemoriesByKeywords(keywords, limit = 5) {
    if (!keywords || keywords.length === 0) return [];

    const cypher = `
      MATCH (m:Memory)
      WHERE any(keyword IN $keywords WHERE
        toLower(m.content) CONTAINS toLower(keyword)
        OR any(tag IN m.tags WHERE toLower(tag) CONTAINS toLower(keyword))
      )
      RETURN m
      ORDER BY m.importance DESC, m.timestamp DESC
      LIMIT $limit
    `;

    return await this.read(cypher, { keywords, limit: neo4j.int(limit) });
  }

  /**
   * Get recent high-importance memories
   */
  async getRecentMemories(limit = 5, minImportance = 0.7) {
    const cypher = `
      MATCH (m:Memory)
      WHERE m.importance >= $minImportance
      RETURN m
      ORDER BY m.timestamp DESC
      LIMIT $limit
    `;

    return await this.read(cypher, { limit: neo4j.int(limit), minImportance });
  }

  /**
   * Get statistics
   */
  async getStatistics() {
    const cypher = `
      MATCH (m:Memory)
      WITH m.category as category, count(m) as count
      RETURN collect({category: category, count: count}) as byCategory
    `;

    const result = await this.read(cypher);
    return result[0]?.byCategory || [];
  }

  /**
   * Get graph data for visualization
   */
  async getGraphData() {
    const cypher = `
      MATCH (m:Memory)
      OPTIONAL MATCH (m)-[r:RELATES_TO|MENTIONS]->(target)
      RETURN m,
             collect({
               type: type(r),
               target: CASE WHEN target:Memory THEN target.id WHEN target:User THEN target.handle ELSE null END,
               label: CASE WHEN target:User THEN 'User' ELSE null END
             }) as relationships
      ORDER BY m.timestamp DESC
    `;

    return await this.read(cypher);
  }
}

// Singleton instance
let instance = null;

function getNeo4jService() {
  if (!instance) {
    instance = new Neo4jService();
  }
  return instance;
}

module.exports = { Neo4jService, getNeo4jService };
