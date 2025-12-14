/**
 * Gemini CLI Provider
 * Uses a local Gemini CLI tool for generation
 */

const { spawn } = require('child_process');
const BaseProvider = require('./base-provider');

class GeminiCliProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.command = config.command || 'gemini';
  }

  async generate(prompt, options = {}) {
    const modelType = options.modelType || 'default';
    const model = this.getModel(modelType);

    return new Promise((resolve) => {
      // Basic args: just the prompt. 
      // If the specific CLI tool needs flags (e.g. -p), they can be added here.
      // Assuming 'gemini "prompt"' pattern for now.
      const args = [];

      if (model && model !== 'default') {
        args.push('--model', model);
      }
      
      // Add prompt as the last argument
      args.push(prompt);

      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const proc = spawn(this.command, args, {
        timeout: this.timeout,
        env: { ...process.env }
      });

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to spawn Gemini CLI: ${error.message}`
        });
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code !== 0) {
          resolve({
            success: false,
            error: stderr || `Gemini CLI exited with code ${code}`,
            duration
          });
          return;
        }

        resolve({
          success: true,
          content: stdout.trim(),
          model,
          duration
        });
      });
    });
  }

  async testConnection() {
    return new Promise((resolve) => {
      const proc = spawn(this.command, ['--version'], {
        timeout: 10000
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: `Gemini CLI not found: ${error.message}`
        });
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: stderr || 'Gemini CLI test failed'
          });
          return;
        }

        resolve({
          success: true,
          message: `Gemini CLI available: ${stdout.trim()}`
        });
      });
    });
  }

  validateConfig() {
    const base = super.validateConfig();
    const errors = base.errors || [];

    if (!this.command) {
      errors.push('CLI command is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

module.exports = GeminiCliProvider;
