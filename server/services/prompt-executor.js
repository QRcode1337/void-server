/**
 * Prompt Executor Service
 * Orchestrates prompt execution with provider resolution
 */

const promptService = require('./prompt-service');
const chatService = require('./chat-service');
const aiProvider = require('./ai-provider');
const memoryQueryService = require('./memory-query-service');
const memoryExtractor = require('./memory-extractor');
const { getNeo4jService } = require('./neo4j-service');

/**
 * Resolve which provider to use based on priority:
 * 1. options.providerOverride (caller override)
 * 2. template.provider (per-template config)
 * 3. global active provider
 */
function resolveProvider(template, options = {}) {
  // Priority 1: Caller override
  if (options.providerOverride) {
    const provider = aiProvider.getProvider(options.providerOverride);
    if (provider) {
      return {
        provider,
        key: options.providerOverride,
        source: 'override'
      };
    }
    console.log(`⚠️ Provider override "${options.providerOverride}" not available, falling back`);
  }

  // Priority 2: Template-configured provider
  if (template?.provider?.key) {
    const provider = aiProvider.getProvider(template.provider.key);
    if (provider) {
      return {
        provider,
        key: template.provider.key,
        modelType: template.provider.modelType,
        source: 'template'
      };
    }
    console.log(`⚠️ Template provider "${template.provider.key}" not available, falling back`);
  }

  // Priority 3: Global active provider
  const activeConfig = aiProvider.getActiveProvider();
  const provider = aiProvider.getProvider(activeConfig.key);

  return {
    provider,
    key: activeConfig.key,
    source: 'active'
  };
}

/**
 * Execute a prompt template with variable substitution
 */
async function executePrompt(templateId, variableValues = {}, options = {}) {
  // Build the prompt from template
  const buildResult = promptService.buildPrompt(templateId, variableValues);
  if (!buildResult.success) {
    return buildResult;
  }

  const { prompt, template } = buildResult;

  // Resolve provider
  const { provider, key, modelType, source } = resolveProvider(template, options);

  if (!provider) {
    return {
      success: false,
      error: 'No provider available'
    };
  }

  // Merge settings from template with options
  const settings = {
    ...template.settings,
    ...options.settings
  };

  // Determine model type
  const finalModelType = options.modelType || modelType || 'medium';

  console.log(`🤖 Executing prompt "${template.name}" with ${key} (${source})`);

  const startTime = Date.now();

  // Execute generation
  const result = await provider.generate(prompt, {
    modelType: finalModelType,
    temperature: settings.temperature,
    max_tokens: settings.max_tokens,
    ...options.generationOptions
  });

  const duration = Date.now() - startTime;

  if (!result.success) {
    console.log(`❌ Prompt execution failed: ${result.error}`);
    return {
      success: false,
      error: result.error,
      provider: key,
      duration
    };
  }

  console.log(`✅ Prompt executed in ${duration}ms`);

  return {
    success: true,
    content: result.content,
    provider: key,
    model: result.model,
    duration: result.duration || duration,
    usage: result.usage,
    template: {
      id: template.id,
      name: template.name
    }
  };
}

/**
 * Execute a chat message within a chat session
 */
async function executeChat(chatId, userMessage, options = {}) {
  // Get chat session
  const chat = chatService.getChat(chatId);
  if (!chat) {
    return { success: false, error: `Chat "${chatId}" not found` };
  }

  // Get template
  const template = promptService.getTemplate(chat.templateId);
  if (!template) {
    return { success: false, error: `Template "${chat.templateId}" not found` };
  }

  // Add user message to chat
  chatService.addMessage(chatId, {
    role: 'user',
    content: userMessage
  });

  // Get chat history for context
  const chatHistory = chatService.getChatHistory(chatId, options.maxHistory || 20);

  // Query relevant memories if Neo4j is available
  let memoryContext = '';
  let relevantMemories = [];

  const neo4j = getNeo4jService();
  if (await neo4j.isAvailable()) {
    relevantMemories = await memoryQueryService.getRelevantMemories({
      message: userMessage,
      userHandle: options.userHandle,
      category: template.category || options.category,
      limit: 5
    });

    if (relevantMemories.length > 0) {
      memoryContext = memoryQueryService.formatMemoriesForPrompt(relevantMemories);
      console.log(`🧠 Retrieved ${relevantMemories.length} relevant memories for chat`);
    }
  }

  // Get memory instructions for LLM to tag memorable content
  const memoryInstructions = memoryExtractor.getMemoryInstructions();

  // Build variable values - include chat history and memory context
  const variableValues = {
    userMessage,
    chatHistory: chatHistory.slice(0, -1), // Exclude the message we just added
    memoryContext,
    memoryInstructions,
    ...options.variables
  };

  // Determine provider - chat provider override takes precedence
  const providerOverride = options.providerOverride || chat.providerOverride;

  // Execute the prompt
  const result = await executePrompt(chat.templateId, variableValues, {
    ...options,
    providerOverride
  });

  if (!result.success) {
    return result;
  }

  // Process response to extract memories and get cleaned content
  const { response: cleanedContent, memoriesExtracted } = await memoryExtractor.processResponse(
    result.content,
    {
      chatId,
      templateId: chat.templateId,
      userMessage
    }
  );

  // Add assistant response to chat (with cleaned content)
  const messageResult = chatService.addMessage(chatId, {
    role: 'assistant',
    content: cleanedContent,
    metadata: {
      provider: result.provider,
      model: result.model,
      duration: result.duration,
      memoriesUsed: relevantMemories.length,
      memoriesCreated: memoriesExtracted
    }
  });

  return {
    success: true,
    content: cleanedContent,
    provider: result.provider,
    model: result.model,
    duration: result.duration,
    memoriesUsed: relevantMemories.length,
    memoriesCreated: memoriesExtracted,
    chat: messageResult.chat
  };
}

/**
 * Test a template with sample values (dry run)
 */
async function testTemplate(templateId, sampleValues = {}, options = {}) {
  const template = promptService.getTemplate(templateId);
  if (!template) {
    return { success: false, error: `Template "${templateId}" not found` };
  }

  // Build the prompt without executing
  const buildResult = promptService.buildPrompt(templateId, sampleValues);
  if (!buildResult.success) {
    return buildResult;
  }

  // Optionally execute if requested
  if (options.execute) {
    return executePrompt(templateId, sampleValues, options);
  }

  // Just return the built prompt
  return {
    success: true,
    prompt: buildResult.prompt,
    template: {
      id: template.id,
      name: template.name
    },
    resolvedValues: buildResult.resolvedValues
  };
}

/**
 * Get available providers for UI dropdown
 */
function getAvailableProviders() {
  const { providers, activeProvider } = aiProvider.getProviders();

  const available = [];
  for (const [key, config] of Object.entries(providers)) {
    if (config.enabled) {
      available.push({
        key,
        name: config.name,
        active: key === activeProvider,
        models: config.models
      });
    }
  }

  return available;
}

/**
 * Initialize prompt executor
 */
function initialize() {
  promptService.initialize();
  chatService.initialize();
  console.log(`🎯 Prompt executor initialized`);
}

module.exports = {
  initialize,
  executePrompt,
  executeChat,
  testTemplate,
  resolveProvider,
  getAvailableProviders
};
