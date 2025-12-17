/**
 * Neo4j Mock for unit tests
 * Provides in-memory graph operations when Neo4j container unavailable
 */

const memories = new Map();
const relationships = [];

const neo4jMock = {
  connected: true,
  connectionError: null,

  async connect() {
    this.connected = true;
    return true;
  },

  async isAvailable() {
    return true;
  },

  async tryConnect() {
    this.connected = true;
    return { connected: true };
  },

  getStatus() {
    return {
      connected: this.connected,
      uri: 'bolt://mock:7687',
      database: 'neo4j',
      error: null,
    };
  },

  async upsertMemory(memory) {
    memories.set(memory.id, { ...memory, _type: 'Memory' });
    return memory;
  },

  async deleteMemory(memoryId) {
    const existed = memories.has(memoryId);
    memories.delete(memoryId);
    return existed;
  },

  async getMemory(memoryId) {
    return memories.get(memoryId) || null;
  },

  async getAllMemories(limit = 100) {
    return Array.from(memories.values())
      .slice(0, limit)
      .map((m) => ({ m }));
  },

  async searchMemories(query, filters = {}) {
    const results = Array.from(memories.values()).filter((m) => {
      const content = m.content?.text || m.content || '';
      return content.toLowerCase().includes(query.toLowerCase());
    });
    return results.slice(0, filters.limit || 10).map((m) => ({ m }));
  },

  async getRelatedMemories(memoryId, limit = 5) {
    const related = relationships
      .filter((r) => r.from === memoryId || r.to === memoryId)
      .map((r) => (r.from === memoryId ? r.to : r.from))
      .slice(0, limit)
      .map((id) => ({ related: memories.get(id) }))
      .filter((r) => r.related);
    return related;
  },

  async linkMemories(fromId, toId, type = 'RELATES_TO') {
    relationships.push({ from: fromId, to: toId, type });
    return [{ m1: memories.get(fromId), m2: memories.get(toId) }];
  },

  async getStatistics() {
    const byCategory = {};
    memories.forEach((m) => {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    });
    return Object.entries(byCategory).map(([category, count]) => ({ category, count }));
  },

  async getGraphData() {
    return Array.from(memories.values()).map((m) => ({
      m,
      relationships: relationships
        .filter((r) => r.from === m.id)
        .map((r) => ({ type: r.type, target: r.to })),
    }));
  },

  reset() {
    memories.clear();
    relationships.length = 0;
  },
};

module.exports = neo4jMock;
