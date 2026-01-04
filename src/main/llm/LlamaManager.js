import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import fs from 'fs/promises';
import { error, debug } from '../../systems/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class LlamaManager {
  constructor(configManager) {
    this.config = configManager;
    this.llama = null;
    this.model = null;
    this.context = null;
    this.contextSequence = null; // Cached context sequence (reused across sessions)
    this.session = null;
    this.isInitialized = false;
    this.grammarCache = new Map(); // Cache grammars by schema hash
    this.currentMode = null; // Current system prompt mode: 'levelIntro' | 'artifact' | null
    this.abortController = null; // For generation cancellation
  }

  async initialize() {
    try {
      this.llama = await getLlama();
      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      error('Failed to initialize llama.cpp:', error);
      return { success: false, error: error.message };
    }
  }

  async loadModel(modelPath, options = {}) {
    try {
      if (!this.llama) {
        await this.initialize();
      }

      const modelPathAbsolute = modelPath.startsWith('/') 
        ? modelPath 
        : join(this.config.getModelDir(), modelPath);

      if (!(await this.fileExists(modelPathAbsolute))) {
        throw new Error(`Model file not found: ${modelPathAbsolute}`);
      }

      const gpu = options.gpu !== false;
      const contextSize = options.contextSize || 4096;

      this.model = await this.llama.loadModel({
        modelPath: modelPathAbsolute,
        gpuLayers: gpu ? -1 : 0,
        gpu: gpu,
        threads: options.threads || 4,
      });

      this.context = await this.model.createContext({
        contextSize,
        batchSize: options.batchSize || 512,
      });

      // Store context sequence for reuse across session recreations
      this.contextSequence = this.context.getSequence();

      this.session = new LlamaChatSession({
        contextSequence: this.contextSequence
      });

      return {
        success: true,
        contextSize,
        gpu: gpu
      };
    } catch (err) {
      error('Failed to load model:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Set the generation mode, which determines the system prompt
   * Recreates the session with the new system prompt if mode changes
   * @param {string} mode - 'levelIntro' | 'artifact' | null
   */
  async setMode(mode) {
    if (this.currentMode === mode) {
      return; // No change needed
    }

    if (!this.contextSequence) {
      throw new Error('Cannot set mode: no context sequence available');
    }

    const systemPrompts = this.config.getSystemPrompts();
    const systemPrompt = mode ? systemPrompts[mode] : undefined;

    if (mode && !systemPrompt) {
      throw new Error(`Unknown mode: ${mode}`);
    }

    debug(`[LlamaManager] Switching mode from '${this.currentMode}' to '${mode}'`);

    // Recreate session with new system prompt, reusing the same context sequence
    this.session = new LlamaChatSession({
      contextSequence: this.contextSequence,
      systemPrompt
    });

    this.currentMode = mode;
  }

  /**
   * Get temperature for the current mode
   * Supports both legacy single-temperature config and new per-mode config
   * @param {string} mode - The generation mode ('levelIntro' | 'artifact')
   * @param {number} override - Optional override temperature
   * @returns {number} Temperature value
   */
  getTemperatureForMode(mode, override) {
    // If override provided, use it
    if (override !== undefined) return override;

    const tempConfig = this.config.get('llm.temperature');

    // Backward compatibility: if config is a number, use it directly
    if (typeof tempConfig === 'number') return tempConfig;

    // Per-mode temperature: use mode-specific or default
    if (typeof tempConfig === 'object') {
      return tempConfig[mode] || tempConfig.default || 0.7;
    }

    // Fallback if config is malformed
    return 0.7;
  }

  /**
   * Get or create a grammar from a JSON schema (cached)
   */
  async getGrammarForSchema(schema) {
    if (!this.llama) {
      throw new Error('Llama not initialized');
    }

    const schemaKey = JSON.stringify(schema);
    if (this.grammarCache.has(schemaKey)) {
      return this.grammarCache.get(schemaKey);
    }

    debug('[LlamaManager] Creating grammar for schema:', schema);
    const grammar = await this.llama.createGrammarForJsonSchema(schema);
    this.grammarCache.set(schemaKey, grammar);
    return grammar;
  }

  async generate(prompt, options = {}) {
    if (!this.model || !this.context || !this.session) {
      return { success: false, error: 'No model loaded' };
    }

    try {
      // Switch mode if specified (changes system prompt)
      if (options.mode !== undefined) {
        await this.setMode(options.mode);
      }

      const maxTokens = options.maxTokens ?? 500;
      const temperature = this.getTemperatureForMode(options.mode, options.temperature);
      const topP = options.topP ?? 0.95;
      const topK = options.topK ?? 40;

      const promptOptions = {
        maxTokens,
        temperature,
        topP,
        topK,
        seed: options.seed,
        repeatPenalty: options.repeatPenalty ?? this.config.get('llm.repeatPenalty'),
      };

      // Add grammar if JSON schema provided
      if (options.jsonSchema) {
        promptOptions.grammar = await this.getGrammarForSchema(options.jsonSchema);
      }

      const response = await this.session.prompt(prompt, promptOptions);

      // Parse JSON if schema was used
      let result = { success: true, text: response };
      if (options.jsonSchema && promptOptions.grammar) {
        try {
          result.parsed = promptOptions.grammar.parse(response);
        } catch (parseErr) {
          debug('[LlamaManager] JSON parse failed, returning raw:', parseErr.message);
        }
      }

      return result;
    } catch (err) {
      error('Generation failed:', err);
      return { success: false, error: err.message };
    }
  }

  async generateStream(prompt, options = {}, onToken) {
    if (!this.model || !this.context || !this.session) {
      throw new Error('No model loaded');
    }

    // Switch mode if specified (changes system prompt)
    if (options.mode !== undefined) {
      await this.setMode(options.mode);
    }

    const maxTokens = options.maxTokens ?? 500;
    const temperature = this.getTemperatureForMode(options.mode, options.temperature);
    const topP = options.topP ?? 0.95;
    const topK = options.topK ?? 40;

    let fullText = '';

    // Create abort controller for this generation
    this.abortController = new AbortController();

    try {
      const promptOptions = {
        maxTokens,
        temperature,
        topP,
        topK,
        seed: options.seed,
        repeatPenalty: options.repeatPenalty ?? this.config.get('llm.repeatPenalty'),
        signal: this.abortController.signal,
        stopOnAbortSignal: true, // Graceful stop, returns partial text
        onTextChunk: (chunk) => {
          if (onToken) {
            fullText += chunk;
            onToken(chunk);
          }
        }
      };

      // Add grammar if JSON schema provided
      let grammar = null;
      if (options.jsonSchema) {
        grammar = await this.getGrammarForSchema(options.jsonSchema);
        promptOptions.grammar = grammar;
      }

      await this.session.prompt(prompt, promptOptions);

      // Parse JSON if schema was used
      let result = { success: true, text: fullText };
      if (grammar) {
        try {
          result.parsed = grammar.parse(fullText);
        } catch (parseErr) {
          debug('[LlamaManager] JSON parse failed, returning raw:', parseErr.message);
        }
      }

      return result;
    } catch (err) {
      error('Streaming generation failed:', err);
      throw err;
    } finally {
      this.abortController = null;
    }
  }

  getAvailableMemory() {
    const totalRam = this.config.getTotalRAM();
    const freeRam = this.config.getFreeRAM();
    
    let recommendedContextSize;
    if (totalRam < 8) {
      recommendedContextSize = 2048;
    } else if (totalRam < 16) {
      recommendedContextSize = 4096;
    } else {
      recommendedContextSize = 8192;
    }

    return {
      totalRam,
      freeRam,
      recommendedContextSize
    };
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  isModelLoaded() {
    return !!(this.model && this.context && this.session);
  }

  getModelInfo() {
    if (!this.model) {
      return null;
    }

    return {
      isLoaded: true,
      contextSize: this.context?.contextSize || 0,
      vocabSize: this.model?.vocabSize || 0,
      gpuLayers: this.model?.gpuLayers || 0,
    };
  }

  /**
   * Abort the current generation
   * @returns {boolean} true if abort was requested, false if no generation in progress
   */
  abortGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      return true;
    }
    return false;
  }

  async shutdown() {
    if (this.session) {
      this.session = null;
    }
    this.contextSequence = null;
    this.currentMode = null;
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
  }
}
