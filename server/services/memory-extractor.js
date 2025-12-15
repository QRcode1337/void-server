/**
 * Memory Extractor Service
 *
 * Parses LLM responses for memory tags and extracts structured memory data.
 *
 * Format:
 * <memory category="emergence" importance="0.8">
 * Content to remember
 * </memory>
 */

const { getNeo4jService } = require('./neo4j-service');

/**
 * Parse memory tags from LLM response
 * Returns array of extracted memories and cleaned response
 */
function extractMemories(response) {
  if (!response || typeof response !== 'string') {
    return { memories: [], cleanedResponse: response || '' };
  }

  const memories = [];

  // Regex to match <memory> tags with attributes
  const memoryRegex = /<memory\s+([^>]*)>([\s\S]*?)<\/memory>/gi;

  let match;
  while ((match = memoryRegex.exec(response)) !== null) {
    const attributesStr = match[1];
    const content = match[2].trim();

    // Parse attributes
    const attributes = parseAttributes(attributesStr);

    memories.push({
      content: content,
      category: attributes.category || 'emergence',
      importance: parseFloat(attributes.importance) || 0.6,
      tags: attributes.tags ? attributes.tags.split(',').map(t => t.trim()) : [],
      source: 'llm-extracted'
    });
  }

  // Remove memory tags from response for display
  const cleanedResponse = response.replace(memoryRegex, '').trim();

  // Clean up any double newlines left behind
  const finalResponse = cleanedResponse.replace(/\n{3,}/g, '\n\n');

  return { memories, cleanedResponse: finalResponse };
}

/**
 * Parse HTML-like attributes from string
 */
function parseAttributes(str) {
  const attrs = {};
  const attrRegex = /(\w+)=["']([^"']*)["']/g;

  let match;
  while ((match = attrRegex.exec(str)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }

  return attrs;
}

/**
 * Save extracted memories to Neo4j
 */
async function saveExtractedMemories(memories, metadata = {}) {
  const neo4j = getNeo4jService();

  if (!await neo4j.isAvailable()) {
    console.log('⚠️ Neo4j not available, skipping memory save');
    return { saved: 0, memories: [] };
  }

  const memoryService = require('./memory-service');
  const savedMemories = [];

  for (const memory of memories) {
    const memoryData = {
      content: memory.content,
      category: memory.category,
      importance: memory.importance,
      tags: memory.tags,
      source: 'llm-extracted',
      stage: 1,
      metadata: {
        chatId: metadata.chatId,
        templateId: metadata.templateId,
        extractedAt: new Date().toISOString()
      }
    };

    const result = await memoryService.createMemory(memoryData).catch(err => {
      console.log(`❌ Failed to save memory: ${err.message}`);
      return null;
    });

    if (result) {
      savedMemories.push(result);
      const hasEmbedding = result.embedding ? '(with embedding)' : '(no embedding)';
      console.log(`💾 Saved extracted memory ${hasEmbedding}: ${memory.content.substring(0, 50)}...`);
    }
  }

  return { saved: savedMemories.length, memories: savedMemories };
}

/**
 * Process LLM response - extract memories and return cleaned response
 */
async function processResponse(response, metadata = {}) {
  const { memories, cleanedResponse } = extractMemories(response);

  if (memories.length > 0) {
    console.log(`🧠 Extracted ${memories.length} memories from response`);
    await saveExtractedMemories(memories, metadata);
  }

  return {
    response: cleanedResponse,
    memoriesExtracted: memories.length
  };
}

/**
 * Get the memory instruction block to add to prompts
 */
function getMemoryInstructions() {
  return `
## Memory Storage

When you encounter information worth remembering for future conversations, wrap it in a memory tag:

<memory category="CATEGORY" importance="0.0-1.0">
Brief, factual summary of what to remember
</memory>

Categories: emergence (insights), social (relationships), technical (facts), economic (value), void (mysteries)
Importance: 0.3 (minor), 0.5 (normal), 0.7 (significant), 0.9 (critical)

Only create memories for:
- User preferences, goals, or personal details they share
- Important facts or decisions discussed
- Significant insights or realizations
- Technical details worth recalling later

Do NOT create memories for:
- Casual greetings or small talk
- Information already in your context
- Temporary or time-sensitive data
`;
}

module.exports = {
  extractMemories,
  saveExtractedMemories,
  processResponse,
  getMemoryInstructions
};
