/**
 * Embedding Service
 *
 * Generates semantic embeddings using local AI providers (Ollama or LM Studio)
 *
 * Supported providers:
 * - Ollama: http://localhost:11434/v1 (default)
 * - LM Studio: http://localhost:1234/v1
 *
 * Provider selection:
 * - EMBEDDING_PROVIDER=auto (default): Try Ollama first, then LM Studio
 * - EMBEDDING_PROVIDER=ollama: Use Ollama only
 * - EMBEDDING_PROVIDER=lmstudio: Use LM Studio only
 */

const lmstudioCli = require('./lmstudio-cli');

class EmbeddingService {
  constructor() {
    // Provider selection: auto, ollama, or lmstudio
    this.providerConfig = process.env.EMBEDDING_PROVIDER || 'auto';

    // LM Studio configuration
    this.lmstudioUrl = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
    this.lmstudioModel = process.env.LM_STUDIO_EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5';

    // Ollama configuration
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/v1';
    this.ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

    // Active provider state (set during initialization)
    this.activeProvider = null;
    this.apiUrl = null;
    this.model = null;
    this.dimensions = 768; // nomic-embed-text output dimension
    this.available = null;
    this.cliStatus = null;
  }

  /**
   * Initialize embedding service and auto-detect provider
   */
  async initialize() {
    if (this.providerConfig === 'auto') {
      // Try Ollama first (default), then LM Studio
      if (await this.checkProvider('ollama')) {
        this.setProvider('ollama');
        console.log('📊 Embedding service: using Ollama');
      } else if (await this.checkProvider('lmstudio')) {
        this.setProvider('lmstudio');
        console.log('📊 Embedding service: using LM Studio');
      } else {
        console.log('📊 Embedding service: no provider available');
      }
    } else {
      this.setProvider(this.providerConfig);
      console.log(`📊 Embedding service: configured for ${this.providerConfig}`);
    }
    return this.activeProvider;
  }

  /**
   * Set the active embedding provider
   */
  setProvider(provider) {
    this.activeProvider = provider;
    if (provider === 'ollama') {
      this.apiUrl = this.ollamaUrl;
      this.model = this.ollamaModel;
    } else {
      this.apiUrl = this.lmstudioUrl;
      this.model = this.lmstudioModel;
    }
    this.available = null; // Reset availability check
  }

  /**
   * Check if a specific provider is available
   */
  async checkProvider(provider) {
    const url = provider === 'ollama' ? this.ollamaUrl : this.lmstudioUrl;
    const response = await fetch(`${url}/models`, {
      signal: AbortSignal.timeout(3000)
    }).catch(() => null);
    return response?.ok || false;
  }

  /**
   * Check if embedding service is available (non-throwing)
   */
  async isAvailable() {
    if (!this.apiUrl) {
      await this.initialize();
    }

    if (!this.apiUrl) {
      this.available = false;
      return false;
    }

    const response = await fetch(`${this.apiUrl}/models`, {
      signal: AbortSignal.timeout(3000)
    }).catch(() => null);

    if (!response?.ok) {
      this.available = false;
      return false;
    }

    const data = await response.json();
    this.available = data.data?.some(model =>
      model.id.includes('nomic-embed') || model.id.includes('embed')
    ) || false;

    return this.available;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // Check availability if unknown
    if (this.available === null) {
      await this.isAvailable();
    }

    if (!this.available) {
      return null;
    }

    const response = await fetch(`${this.apiUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer not-needed'
      },
      body: JSON.stringify({
        model: this.model,
        input: text
      })
    });

    if (!response.ok) {
      console.log(`⚠️ Embedding generation failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddingsBatch(texts, options = {}) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    // Check availability if unknown
    if (this.available === null) {
      await this.isAvailable();
    }

    if (!this.available) {
      return [];
    }

    const batchSize = options.batchSize || 100;
    const allEmbeddings = [];

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      console.log(`📊 Generating embeddings ${i + 1}-${Math.min(i + batchSize, texts.length)} of ${texts.length}...`);

      const response = await fetch(`${this.apiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer not-needed'
        },
        body: JSON.stringify({
          model: this.model,
          input: batch
        })
      });

      if (!response.ok) {
        console.log(`⚠️ Batch embedding failed: ${response.status}`);
        // Return partial results with nulls for failed batch
        allEmbeddings.push(...batch.map(() => null));
        continue;
      }

      const data = await response.json();
      const embeddings = data.data.map(item => item.embedding);
      allEmbeddings.push(...embeddings);
    }

    return allEmbeddings;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   */
  cosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) return 0;
    if (embedding1.length !== embedding2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Find most similar embeddings to a query embedding
   */
  findMostSimilar(queryEmbedding, embeddings, limit = 5) {
    if (!queryEmbedding || !embeddings || embeddings.length === 0) {
      return [];
    }

    const similarities = embeddings
      .filter(e => e.vector)
      .map((embedding, index) => ({
        index,
        similarity: this.cosineSimilarity(queryEmbedding, embedding.vector),
        data: embedding.data
      }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      provider: this.activeProvider,
      apiUrl: this.apiUrl,
      model: this.model,
      dimensions: this.dimensions,
      available: this.available,
      cliStatus: this.cliStatus
    };
  }

  /**
   * Get comprehensive status including CLI detection and alternative providers
   */
  async getFullStatus() {
    // Get CLI-based detection for LM Studio
    this.cliStatus = lmstudioCli.getEmbeddingStatus();

    // Check both providers
    const ollamaAvailable = await this.checkProvider('ollama');
    const lmstudioAvailable = await this.checkProvider('lmstudio');

    return {
      provider: this.activeProvider,
      providerConfig: this.providerConfig,
      apiUrl: this.apiUrl,
      model: this.model,
      dimensions: this.dimensions,
      available: this.available,
      providers: {
        ollama: {
          available: ollamaAvailable,
          url: this.ollamaUrl,
          model: this.ollamaModel
        },
        lmstudio: {
          available: lmstudioAvailable,
          url: this.lmstudioUrl,
          model: this.lmstudioModel,
          cli: this.cliStatus
        }
      },
      recommendation: this.cliStatus?.recommendation
    };
  }

  /**
   * Get available embedding models from CLI (LM Studio only)
   */
  getAvailableModels() {
    const models = lmstudioCli.getAvailableModels();
    return {
      cliAvailable: models.available,
      embedding: models.embedding || [],
      error: models.error
    };
  }

  /**
   * Test connection to the active provider
   */
  async testConnection() {
    if (!this.apiUrl) {
      await this.initialize();
    }

    // Get CLI status for LM Studio
    this.cliStatus = lmstudioCli.getEmbeddingStatus();

    if (!this.apiUrl) {
      return {
        connected: false,
        provider: null,
        error: 'No embedding provider configured'
      };
    }

    const response = await fetch(`${this.apiUrl}/models`).catch(() => null);

    if (!response?.ok) {
      return {
        connected: false,
        provider: this.activeProvider,
        error: `Cannot connect to ${this.activeProvider}. Make sure it is running.`,
        cli: this.activeProvider === 'lmstudio' ? this.cliStatus : undefined
      };
    }

    const data = await response.json();
    const hasEmbeddingModel = data.data?.some(model =>
      model.id.includes('nomic-embed') || model.id.includes('embed')
    ) || false;

    this.available = hasEmbeddingModel;

    return {
      connected: true,
      provider: this.activeProvider,
      models: data.data?.map(m => m.id) || [],
      hasEmbeddingModel,
      cli: this.activeProvider === 'lmstudio' ? this.cliStatus : undefined
    };
  }

  /**
   * Set the embedding model to use
   */
  setModel(modelName) {
    this.model = modelName;
    this.available = null; // Reset availability check
  }
}

// Singleton instance
let instance = null;

function getEmbeddingService() {
  if (!instance) {
    instance = new EmbeddingService();
  }
  return instance;
}

module.exports = { EmbeddingService, getEmbeddingService };
