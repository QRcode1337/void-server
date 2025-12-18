/**
 * Ollama Service
 *
 * Manages Ollama-specific operations like model pulling and listing.
 * Uses Ollama's native API (/api/*) for management, while chat/embeddings
 * use the OpenAI-compatible endpoint (/v1/*).
 */

const OLLAMA_API_URL = (process.env.OLLAMA_URL || 'http://localhost:11434/v1').replace('/v1', '');

/**
 * List available models from Ollama
 */
async function listModels() {
  const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
  if (!response.ok) {
    return { success: false, error: response.statusText };
  }
  const data = await response.json();
  return { success: true, models: data.models || [] };
}

/**
 * Pull a model from the Ollama registry
 * @param {string} modelName - Model name (e.g., 'llama3.2:3b')
 * @param {Function} onProgress - Callback for progress updates
 */
async function pullModel(modelName, onProgress) {
  const response = await fetch(`${OLLAMA_API_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true })
  });

  if (!response.ok) {
    return { success: false, error: response.statusText };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n').filter(Boolean);
    for (const line of lines) {
      const progress = JSON.parse(line);
      if (onProgress) onProgress(progress);
    }
  }

  return { success: true };
}

/**
 * Check if a model is available locally
 * @param {string} modelName - Model name to check
 */
async function hasModel(modelName) {
  const result = await listModels();
  if (!result.success) return false;
  return result.models.some(m => m.name === modelName || m.name.startsWith(modelName));
}

/**
 * Get Ollama service status
 */
async function getStatus() {
  const response = await fetch(`${OLLAMA_API_URL}/api/tags`, {
    signal: AbortSignal.timeout(3000)
  }).catch(() => null);

  if (!response?.ok) {
    return { available: false };
  }

  const data = await response.json();
  return {
    available: true,
    models: data.models || [],
    url: OLLAMA_API_URL
  };
}

/**
 * Pull models specified in OLLAMA_MODELS environment variable
 * Called on server startup
 */
async function pullConfiguredModels() {
  const modelsEnv = process.env.OLLAMA_MODELS;
  if (!modelsEnv) return [];

  const models = modelsEnv.split(',').map(m => m.trim()).filter(Boolean);
  const results = [];

  for (const model of models) {
    console.log(`🦙 Pulling Ollama model: ${model}`);
    const result = await pullModel(model, (p) => {
      if (p.status) console.log(`   ${p.status}`);
    });
    results.push({ model, ...result });
  }

  return results;
}

/**
 * Delete a model from Ollama
 * @param {string} modelName - Model name to delete
 */
async function deleteModel(modelName) {
  const response = await fetch(`${OLLAMA_API_URL}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName })
  });

  if (!response.ok) {
    return { success: false, error: response.statusText };
  }

  return { success: true };
}

module.exports = {
  listModels,
  pullModel,
  hasModel,
  getStatus,
  pullConfiguredModels,
  deleteModel,
  OLLAMA_API_URL
};
