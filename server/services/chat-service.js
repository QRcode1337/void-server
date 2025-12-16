/**
 * Chat Service
 * Manages chat sessions and message persistence
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CHATS_DIR = path.resolve(__dirname, '../../data/chats');
const LEGACY_CHATS_DIR = path.resolve(__dirname, '../../config/prompts/chats');

/**
 * Ensure chats directory exists
 */
function ensureChatsDir() {
  if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
  }
}

/**
 * Generate a unique chat ID
 */
function generateChatId() {
  return crypto.randomUUID();
}

/**
 * Get chat folder path (new structure)
 */
function getChatDir(chatId) {
  return path.join(CHATS_DIR, chatId);
}

/**
 * Get chat.json file path within chat folder
 */
function getChatPath(chatId) {
  return path.join(getChatDir(chatId), 'chat.json');
}

/**
 * Get turns directory for a chat
 */
function getTurnsDir(chatId) {
  return path.join(getChatDir(chatId), 'turns');
}

/**
 * Get turn directory path (padded number)
 */
function getTurnDir(chatId, turnNumber) {
  const padded = String(turnNumber).padStart(4, '0');
  return path.join(getTurnsDir(chatId), padded);
}

/**
 * Ensure chat folder structure exists
 */
function ensureChatDir(chatId) {
  const chatDir = getChatDir(chatId);
  if (!fs.existsSync(chatDir)) {
    fs.mkdirSync(chatDir, { recursive: true });
  }
  const turnsDir = getTurnsDir(chatId);
  if (!fs.existsSync(turnsDir)) {
    fs.mkdirSync(turnsDir, { recursive: true });
  }
}

/**
 * Check if chat exists (supports both old and new formats)
 */
function chatExists(chatId) {
  // New format: folder with chat.json
  if (fs.existsSync(getChatPath(chatId))) {
    return true;
  }
  // Old format: single JSON file
  const legacyPath = path.join(CHATS_DIR, `${chatId}.json`);
  return fs.existsSync(legacyPath);
}

/**
 * Migrate a single chat from old format to new format
 */
function migrateChatToFolder(chatId) {
  const legacyPath = path.join(CHATS_DIR, `${chatId}.json`);
  if (!fs.existsSync(legacyPath)) {
    return false;
  }

  // Read old format
  const data = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));

  // Create new folder structure
  ensureChatDir(chatId);

  // Write to new location
  fs.writeFileSync(getChatPath(chatId), JSON.stringify(data, null, 2));

  // Remove old file
  fs.unlinkSync(legacyPath);

  console.log(`📦 Migrated chat ${chatId} to folder format`);
  return true;
}

// ============================================================================
// Chat CRUD
// ============================================================================

/**
 * List all chat sessions (metadata only, no messages)
 */
function listChats() {
  ensureChatsDir();

  const entries = fs.readdirSync(CHATS_DIR, { withFileTypes: true });
  const chats = [];

  for (const entry of entries) {
    let data;

    if (entry.isDirectory()) {
      // New format: folder with chat.json
      const chatJsonPath = path.join(CHATS_DIR, entry.name, 'chat.json');
      if (!fs.existsSync(chatJsonPath)) continue;
      data = JSON.parse(fs.readFileSync(chatJsonPath, 'utf8'));
    } else if (entry.name.endsWith('.json') && entry.name !== '.gitkeep') {
      // Old format: single JSON file - migrate it
      const chatId = entry.name.replace('.json', '');
      migrateChatToFolder(chatId);
      data = JSON.parse(fs.readFileSync(getChatPath(chatId), 'utf8'));
    } else {
      continue;
    }

    chats.push({
      id: data.id,
      templateId: data.templateId,
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      messageCount: data.messages?.length || 0,
      providerOverride: data.providerOverride
    });
  }

  // Sort by updatedAt descending (most recent first)
  chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return chats;
}

/**
 * Get full chat with messages
 */
function getChat(chatId) {
  ensureChatsDir();

  // Check for old format and migrate if needed
  const legacyPath = path.join(CHATS_DIR, `${chatId}.json`);
  if (fs.existsSync(legacyPath) && !fs.existsSync(getChatPath(chatId))) {
    migrateChatToFolder(chatId);
  }

  const chatPath = getChatPath(chatId);
  if (!fs.existsSync(chatPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(chatPath, 'utf8'));
}

/**
 * Create a new chat session
 */
function createChat(templateId, title = null, providerOverride = null) {
  ensureChatsDir();

  const id = generateChatId();
  const now = new Date().toISOString();

  const chat = {
    id,
    templateId,
    title: title || `Chat ${new Date().toLocaleDateString()}`,
    createdAt: now,
    updatedAt: now,
    providerOverride,
    messages: []
  };

  // Create folder structure
  ensureChatDir(id);

  const chatPath = getChatPath(id);
  fs.writeFileSync(chatPath, JSON.stringify(chat, null, 2));

  console.log(`💬 Created chat: ${chat.title} (${id})`);
  return { success: true, chat };
}

/**
 * Update chat metadata
 */
function updateChat(chatId, updates) {
  const chat = getChat(chatId);
  if (!chat) {
    return { success: false, error: `Chat "${chatId}" not found` };
  }

  // Only allow updating certain fields
  const allowedUpdates = ['title', 'templateId', 'providerOverride'];
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      chat[key] = updates[key];
    }
  }

  chat.updatedAt = new Date().toISOString();

  const chatPath = getChatPath(chatId);
  fs.writeFileSync(chatPath, JSON.stringify(chat, null, 2));

  console.log(`✏️ Updated chat: ${chat.title}`);
  return { success: true, chat };
}

/**
 * Delete a chat session
 */
function deleteChat(chatId) {
  // Check for old format first
  const legacyPath = path.join(CHATS_DIR, `${chatId}.json`);
  if (fs.existsSync(legacyPath)) {
    const chat = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    fs.unlinkSync(legacyPath);
    console.log(`🗑️ Deleted chat: ${chat.title}`);
    return { success: true, message: `Deleted chat "${chat.title}"` };
  }

  // New format: folder
  const chatPath = getChatPath(chatId);
  if (!fs.existsSync(chatPath)) {
    return { success: false, error: `Chat "${chatId}" not found` };
  }

  const chat = JSON.parse(fs.readFileSync(chatPath, 'utf8'));
  const chatDir = getChatDir(chatId);

  // Remove folder recursively
  fs.rmSync(chatDir, { recursive: true, force: true });

  console.log(`🗑️ Deleted chat: ${chat.title}`);
  return { success: true, message: `Deleted chat "${chat.title}"` };
}

// ============================================================================
// Message Management
// ============================================================================

/**
 * Add a message to a chat
 */
function addMessage(chatId, message) {
  const chat = getChat(chatId);
  if (!chat) {
    return { success: false, error: `Chat "${chatId}" not found` };
  }

  const now = new Date().toISOString();

  const msg = {
    role: message.role, // 'user' or 'assistant'
    content: message.content,
    timestamp: now,
    ...message.metadata // provider, model, duration, etc.
  };

  chat.messages.push(msg);
  chat.updatedAt = now;

  // Auto-generate title from first user message if still default
  if (chat.messages.length === 1 && message.role === 'user') {
    const firstWords = message.content.split(/\s+/).slice(0, 5).join(' ');
    if (chat.title.startsWith('Chat ')) {
      chat.title = firstWords.length > 30 ? firstWords.slice(0, 30) + '...' : firstWords;
    }
  }

  const chatPath = getChatPath(chatId);
  fs.writeFileSync(chatPath, JSON.stringify(chat, null, 2));

  return { success: true, message: msg, chat };
}

/**
 * Get messages from a chat with optional pagination
 */
function getMessages(chatId, options = {}) {
  const chat = getChat(chatId);
  if (!chat) {
    return { success: false, error: `Chat "${chatId}" not found` };
  }

  const { limit, offset = 0 } = options;
  let messages = chat.messages;

  if (offset > 0) {
    messages = messages.slice(offset);
  }

  if (limit) {
    messages = messages.slice(0, limit);
  }

  return {
    success: true,
    messages,
    total: chat.messages.length
  };
}

/**
 * Clear all messages in a chat
 */
function clearMessages(chatId) {
  const chat = getChat(chatId);
  if (!chat) {
    return { success: false, error: `Chat "${chatId}" not found` };
  }

  chat.messages = [];
  chat.updatedAt = new Date().toISOString();

  const chatPath = getChatPath(chatId);
  fs.writeFileSync(chatPath, JSON.stringify(chat, null, 2));

  console.log(`🧹 Cleared messages in chat: ${chat.title}`);
  return { success: true, message: `Cleared messages in "${chat.title}"` };
}

/**
 * Get chat history formatted for prompt injection
 * Returns array of formatted messages
 */
function getChatHistory(chatId, maxMessages = 20) {
  const chat = getChat(chatId);
  if (!chat) {
    return [];
  }

  // Get last N messages
  const recentMessages = chat.messages.slice(-maxMessages);

  return recentMessages.map(msg => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    return `${role}: ${msg.content}`;
  });
}

/**
 * Export chat to different formats
 */
function exportChat(chatId, format = 'json') {
  const chat = getChat(chatId);
  if (!chat) {
    return { success: false, error: `Chat "${chatId}" not found` };
  }

  if (format === 'markdown') {
    let md = `# ${chat.title}\n\n`;
    md += `Template: ${chat.templateId}\n`;
    md += `Created: ${chat.createdAt}\n\n`;
    md += `---\n\n`;

    for (const msg of chat.messages) {
      const role = msg.role === 'user' ? '**User**' : '**Assistant**';
      md += `${role}:\n\n${msg.content}\n\n`;
    }

    return { success: true, format: 'markdown', content: md };
  }

  // Default: JSON
  return { success: true, format: 'json', content: JSON.stringify(chat, null, 2) };
}

// ============================================================================
// Turn Logging (Debug Info)
// ============================================================================

/**
 * Get the current turn number for a chat
 */
function getCurrentTurnNumber(chatId) {
  const chat = getChat(chatId);
  if (!chat) return 0;

  // Each user+assistant pair is one turn
  const userMessages = chat.messages.filter(m => m.role === 'user');
  return userMessages.length;
}

/**
 * Log turn request (what was sent to the AI)
 */
function logTurnRequest(chatId, turnNumber, data) {
  ensureChatDir(chatId);
  const turnDir = getTurnDir(chatId, turnNumber);

  if (!fs.existsSync(turnDir)) {
    fs.mkdirSync(turnDir, { recursive: true });
  }

  const requestPath = path.join(turnDir, 'request.json');
  fs.writeFileSync(requestPath, JSON.stringify(data, null, 2));
}

/**
 * Log turn response (what the AI returned)
 */
function logTurnResponse(chatId, turnNumber, data) {
  ensureChatDir(chatId);
  const turnDir = getTurnDir(chatId, turnNumber);

  if (!fs.existsSync(turnDir)) {
    fs.mkdirSync(turnDir, { recursive: true });
  }

  const responsePath = path.join(turnDir, 'response.json');
  fs.writeFileSync(responsePath, JSON.stringify(data, null, 2));
}

/**
 * Log turn memory info (memories used and created)
 */
function logTurnMemory(chatId, turnNumber, data) {
  ensureChatDir(chatId);
  const turnDir = getTurnDir(chatId, turnNumber);

  if (!fs.existsSync(turnDir)) {
    fs.mkdirSync(turnDir, { recursive: true });
  }

  const memoryPath = path.join(turnDir, 'memory.json');
  fs.writeFileSync(memoryPath, JSON.stringify(data, null, 2));
}

/**
 * Log a complete turn (convenience function)
 */
function logTurn(chatId, turnNumber, { request, response, memory }) {
  if (request) logTurnRequest(chatId, turnNumber, request);
  if (response) logTurnResponse(chatId, turnNumber, response);
  if (memory) logTurnMemory(chatId, turnNumber, memory);
}

/**
 * Get turn logs for a specific turn
 */
function getTurnLogs(chatId, turnNumber) {
  const turnDir = getTurnDir(chatId, turnNumber);

  if (!fs.existsSync(turnDir)) {
    return null;
  }

  const logs = {};

  const requestPath = path.join(turnDir, 'request.json');
  if (fs.existsSync(requestPath)) {
    logs.request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
  }

  const responsePath = path.join(turnDir, 'response.json');
  if (fs.existsSync(responsePath)) {
    logs.response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
  }

  const memoryPath = path.join(turnDir, 'memory.json');
  if (fs.existsSync(memoryPath)) {
    logs.memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  }

  return logs;
}

/**
 * List all turn numbers for a chat
 */
function listTurns(chatId) {
  const turnsDir = getTurnsDir(chatId);

  if (!fs.existsSync(turnsDir)) {
    return [];
  }

  return fs.readdirSync(turnsDir)
    .filter(f => fs.statSync(path.join(turnsDir, f)).isDirectory())
    .map(f => parseInt(f, 10))
    .sort((a, b) => a - b);
}

/**
 * Migrate chats from legacy location (config/prompts/chats) to new location (data/chats)
 */
function migrateFromLegacy() {
  if (!fs.existsSync(LEGACY_CHATS_DIR)) {
    return 0;
  }

  const legacyFiles = fs.readdirSync(LEGACY_CHATS_DIR).filter(f => f.endsWith('.json'));
  if (legacyFiles.length === 0) {
    return 0;
  }

  let migrated = 0;
  for (const file of legacyFiles) {
    const legacyPath = path.join(LEGACY_CHATS_DIR, file);
    const newPath = path.join(CHATS_DIR, file);

    // Skip if already exists in new location
    if (fs.existsSync(newPath)) {
      continue;
    }

    // Copy to new location
    const data = fs.readFileSync(legacyPath, 'utf8');
    fs.writeFileSync(newPath, data);
    migrated++;

    // Remove from legacy location
    fs.unlinkSync(legacyPath);
  }

  return migrated;
}

/**
 * Initialize chat service
 */
function initialize() {
  ensureChatsDir();

  // Migrate from legacy location if needed
  const migrated = migrateFromLegacy();
  if (migrated > 0) {
    console.log(`📦 Migrated ${migrated} chat(s) from config/prompts/chats to data/chats`);
  }

  const chats = listChats();
  console.log(`💬 Chat service initialized (${chats.length} chats)`);
}

module.exports = {
  initialize,
  listChats,
  getChat,
  createChat,
  updateChat,
  deleteChat,
  addMessage,
  getMessages,
  clearMessages,
  getChatHistory,
  exportChat,
  // Turn logging
  getCurrentTurnNumber,
  logTurnRequest,
  logTurnResponse,
  logTurnMemory,
  logTurn,
  getTurnLogs,
  listTurns
};
