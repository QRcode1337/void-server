/**
 * Chat REST API Routes
 * Manages chat sessions and messages
 */

const express = require('express');
const router = express.Router();
const chatService = require('../services/chat-service');
const promptExecutor = require('../services/prompt-executor');

// ============================================================================
// Chat Session Routes
// ============================================================================

/**
 * GET /api/chat
 * List all chat sessions
 */
router.get('/', (req, res) => {
  const chats = chatService.listChats();
  res.json({ success: true, chats });
});

/**
 * GET /api/chat/:id
 * Get a chat session with messages
 */
router.get('/:id', (req, res) => {
  const chat = chatService.getChat(req.params.id);

  if (!chat) {
    return res.status(404).json({ success: false, error: 'Chat not found' });
  }

  res.json({ success: true, chat });
});

/**
 * POST /api/chat
 * Create a new chat session
 */
router.post('/', (req, res) => {
  const { templateId, title, providerOverride } = req.body;

  if (!templateId) {
    return res.status(400).json({ success: false, error: 'templateId required' });
  }

  const result = chatService.createChat(templateId, title, providerOverride);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.status(201).json(result);
});

/**
 * PUT /api/chat/:id
 * Update chat metadata
 */
router.put('/:id', (req, res) => {
  const result = chatService.updateChat(req.params.id, req.body);

  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
});

/**
 * DELETE /api/chat/:id
 * Delete a chat session
 */
router.delete('/:id', (req, res) => {
  const result = chatService.deleteChat(req.params.id);

  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
});

// ============================================================================
// Message Routes
// ============================================================================

/**
 * POST /api/chat/:id/message
 * Send a message and get a response
 */
router.post('/:id/message', async (req, res) => {
  const { content, providerOverride, modelType, maxHistory, debug } = req.body;

  if (!content) {
    return res.status(400).json({ success: false, error: 'Message content required' });
  }

  const result = await promptExecutor.executeChat(req.params.id, content, {
    providerOverride,
    modelType,
    maxHistory,
    debug: debug === true
  });

  if (!result.success) {
    return res.status(result.error?.includes('not found') ? 404 : 500).json(result);
  }

  res.json(result);
});

/**
 * GET /api/chat/:id/messages
 * Get messages with optional pagination
 */
router.get('/:id/messages', (req, res) => {
  const { limit, offset } = req.query;

  const result = chatService.getMessages(req.params.id, {
    limit: limit ? parseInt(limit) : undefined,
    offset: offset ? parseInt(offset) : 0
  });

  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
});

/**
 * DELETE /api/chat/:id/messages
 * Clear all messages in a chat
 */
router.delete('/:id/messages', (req, res) => {
  const result = chatService.clearMessages(req.params.id);

  if (!result.success) {
    return res.status(404).json(result);
  }

  res.json(result);
});

// ============================================================================
// Export Routes
// ============================================================================

/**
 * GET /api/chat/:id/export
 * Export chat to different formats
 */
router.get('/:id/export', (req, res) => {
  const { format } = req.query;

  const result = chatService.exportChat(req.params.id, format || 'json');

  if (!result.success) {
    return res.status(404).json(result);
  }

  // Set appropriate content type
  if (result.format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="chat-${req.params.id}.md"`);
    return res.send(result.content);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="chat-${req.params.id}.json"`);
  res.send(result.content);
});

module.exports = router;
