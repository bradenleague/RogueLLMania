import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import fs from 'fs/promises';
import { error } from '../../systems/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class LlamaManager {
  constructor(configManager) {
    this.config = configManager;
    this.llama = null;
    this.model = null;
    this.context = null;
    this.session = null;
    this.isInitialized = false;
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

      this.session = new LlamaChatSession({
        contextSequence: this.context.getSequence()
      });

      return {
        success: true,
        contextSize,
        gpu: gpu
      };
    } catch (error) {
      error('Failed to load model:', error);
      return { success: false, error: error.message };
    }
  }

  async generate(prompt, options = {}) {
    if (!this.model || !this.context || !this.session) {
      return { success: false, error: 'No model loaded' };
    }

    try {
      const maxTokens = options.maxTokens || 500;
      const temperature = options.temperature || 0.7;
      const topP = options.topP || 0.95;
      const topK = options.topK || 40;

      const generator = await this.session.prompt(prompt, {
        maxTokens,
        temperature,
        topP,
        topK,
      });

      return { 
        success: true, 
        text: generator 
      };
    } catch (error) {
      error('Generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async generateStream(prompt, options = {}, onToken) {
    if (!this.model || !this.context || !this.session) {
      throw new Error('No model loaded');
    }

    const maxTokens = options.maxTokens || 500;
    const temperature = options.temperature || 0.7;
    const topP = options.topP || 0.95;
    const topK = options.topK || 40;

    let fullText = '';

    try {
      const response = await this.session.prompt(prompt, {
        maxTokens,
        temperature,
        topP,
        topK,
        onResponseChunk: (chunk) => {
          if (onToken && chunk.text) {
            fullText += chunk.text;
            onToken(chunk.text);
          }
        }
      });

      return { success: true, text: fullText };
    } catch (error) {
      error('Streaming generation failed:', error);
      throw error;
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

  async shutdown() {
    if (this.session) {
      this.session = null;
    }
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
