/**
 * Ollama Routes
 *
 * REST endpoints for Ollama model management
 */

const express = require('express');
const router = express.Router();
const ollamaService = require('../services/ollama-service');

/**
 * GET /api/ollama/status
 * Get Ollama service status
 */
router.get('/status', async (req, res) => {
  const status = await ollamaService.getStatus();
  res.json(status);
});

/**
 * GET /api/ollama/models
 * List available models
 */
router.get('/models', async (req, res) => {
  const result = await ollamaService.listModels();
  res.json(result);
});

/**
 * POST /api/ollama/pull
 * Pull a model from the Ollama registry (streaming)
 */
router.post('/pull', async (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ error: 'Model name required' });
  }

  // Set up SSE for streaming progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  await ollamaService.pullModel(model, (progress) => {
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

/**
 * DELETE /api/ollama/models/:name
 * Delete a model
 */
router.delete('/models/:name', async (req, res) => {
  const modelName = req.params.name;
  const result = await ollamaService.deleteModel(modelName);
  res.json(result);
});

module.exports = router;
