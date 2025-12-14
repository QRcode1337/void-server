/**
 * Gemini API Provider
 * Direct API access to Google's Gemini models
 */

const BaseProvider = require('./base-provider');
const http = require('../../lib/http-client');

class GeminiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.endpoint = config.endpoint || 'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = config.apiKey || '';
    this.settings = config.settings || {};
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      // Gemini uses query param for key usually, but let's check if header works or just append to URL
      // Actually standard is query param ?key=API_KEY for simpler calls, but let's see if x-goog-api-key works.
      // Yes, x-goog-api-key is supported for REST.
      'x-goog-api-key': this.apiKey
    };
  }

  async generate(prompt, options = {}) {
    const modelType = options.modelType || 'default';
    let model = this.getModel(modelType);
    
    // Ensure model name doesn't have 'models/' prefix if we are adding it in URL
    if (model.startsWith('models/')) {
        model = model.replace('models/', '');
    }

    const messages = options.messages || [
      { role: 'user', content: prompt }
    ];
    
    // Convert messages to Gemini format
    // Gemini uses "user" and "model" roles
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: options.max_tokens ?? this.settings.max_tokens ?? 2048,
        temperature: this.settings.temperature ?? 0.7,
        ...(this.settings.topP && { topP: this.settings.topP }),
        ...(this.settings.topK && { topK: this.settings.topK })
      }
    };
    
    // System prompt is handled differently in newer Gemini versions (systemInstruction)
    if (options.systemPrompt) {
        body.systemInstruction = {
            parts: [{ text: options.systemPrompt }]
        };
    }

    const startTime = Date.now();
    
    // Construct URL: endpoint + /models/{model}:generateContent
    const url = `${this.endpoint}/models/${model}:generateContent`;

    const result = await http.post(url, {
      headers: this.getHeaders(),
      body,
      timeout: this.timeout
    });

    const duration = Date.now() - startTime;

    if (!result.ok) {
      return {
        success: false,
        error: result.data?.error?.message || `API error: ${result.status}`,
        duration
      };
    }

    const candidate = result.data?.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text;

    if (!content) {
      // Check for safety blocks
      if (candidate?.finishReason === 'SAFETY') {
          return {
              success: false,
              error: 'Generation blocked by safety settings',
              duration
          };
      }
      
      return {
        success: false,
        error: 'No content in response',
        duration
      };
    }

    return {
      success: true,
      content,
      model,
      duration,
      usage: result.data?.usageMetadata, // Gemini returns usageMetadata
      stopReason: candidate?.finishReason
    };
  }

  async testConnection() {
    // Test with a simple generation
    const result = await this.generate('Hello', {
      modelType: 'light', 
      max_tokens: 10
    });

    if (result.success) {
      return {
        success: true,
        message: `Connected to Gemini API (${result.duration}ms response time)`
      };
    }

    return {
      success: false,
      error: result.error || 'Connection test failed'
    };
  }

  validateConfig() {
    const base = super.validateConfig();
    const errors = base.errors || [];

    if (!this.apiKey) {
      errors.push('Gemini API key is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

module.exports = GeminiProvider;
