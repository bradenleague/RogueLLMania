import EventEmitter from 'events';
import { basename } from 'path';
import { error, info, debug } from '../../systems/logger.js';

export class LlamaBridge extends EventEmitter {
  constructor(llamaManager, modelDownloader, configManager) {
    super();
    this.llamaManager = llamaManager;
    this.modelDownloader = modelDownloader;
    this.config = configManager;
    this.currentModel = null;
    this.ensureModelPromise = null;
    this.validatedModelPath = null;
    this.validatedModelStats = null;
  }

  async initialize() {
    try {
      const result = await this.llamaManager.initialize();
      if (!result.success) {
        throw new Error(result.error);
      }
      return { success: true };
    } catch (err) {
      error('Failed to initialize LlamaBridge:', err);
      return { success: false, error: err.message };
    }
  }

  async ensureModel() {
    if (this.ensureModelPromise) {
      return this.ensureModelPromise;
    }

    this.ensureModelPromise = (async () => {
      try {
        const model = this.config.getTargetModel();
        const modelPath = this.modelDownloader.getModelPath(model.filename);

        const { existsSync, statSync } = await import('fs');

        if (existsSync(modelPath)) {
          const stats = statSync(modelPath);

          if (this.validatedModelPath === modelPath && this.validatedModelStats) {
            if (this.validatedModelStats.size === stats.size && 
                this.validatedModelStats.mtime === stats.mtimeMs) {
              debug('[LlamaBridge] Model already validated (cached), skipping validation');
              return modelPath;
            }
            debug('[LlamaBridge] Model file changed since last validation, re-validating');
          }

          debug('[LlamaBridge] Checking model status...');
          debug('[LlamaBridge] Model file exists, validating');
          const validation = await this.modelDownloader.validateModel(modelPath, model, null);
          if (validation.valid) {
            this.validatedModelPath = modelPath;
            this.validatedModelStats = {
              size: stats.size,
              mtime: stats.mtimeMs
            };
            info('[LlamaBridge] Model already downloaded and validated');
            return modelPath;
          } else {
            this.validatedModelPath = null;
            this.validatedModelStats = null;
            info('[LlamaBridge] Existing model invalid, re-downloading');
          }
        }

        info('[LlamaBridge] Model not found or invalid, starting download');
        const result = await this.downloadModel(model.id);
        if (!result.success) {
          if (result.error && result.error.includes('Download incomplete')) {
            info('[LlamaBridge] Download incomplete, keeping partial for resume');
            throw new Error('Download incomplete. Please wait or try again later.');
          }
          throw new Error(result.error || 'Model download failed');
        }
        this.validatedModelPath = result.path;
        this.validatedModelStats = statSync(result.path);
        return result.path;
      } finally {
        this.ensureModelPromise = null;
      }
    })();

    return this.ensureModelPromise;
  }

  async chat(options) {
    const { prompt, model, temperature = 0.7, maxTokens = 500, stream = false } = options;

    try {
      await this.ensureModel();

      if (!this.llamaManager.isModelLoaded()) {
        if (model) {
          const loadResult = await this.loadModel(model);
          if (!loadResult.success) {
            return loadResult;
          }
        } else {
          const targetModel = this.config.getTargetModel();
          const loadResult = await this.loadModel(targetModel.id);
          if (!loadResult.success) {
            return loadResult;
          }
        }
      }

      const result = await this.llamaManager.generate(prompt, {
        temperature,
        maxTokens,
      });

      return result;
    } catch (err) {
      error('Chat failed:', err);
      return { success: false, error: err.message };
    }
  }

  async chatStream(options, onChunk) {
    const { prompt, model, temperature = 0.7, maxTokens = 500 } = options;

    try {
      await this.ensureModel();

      if (!this.llamaManager.isModelLoaded()) {
        if (model) {
          const loadResult = await this.loadModel(model);
          if (!loadResult.success) {
            throw new Error(loadResult.error);
          }
        } else {
          const targetModel = this.config.getTargetModel();
          const loadResult = await this.loadModel(targetModel.id);
          if (!loadResult.success) {
            throw new Error(loadResult.error);
          }
        }
      }

      const result = await this.llamaManager.generateStream(prompt, {
        temperature,
        maxTokens,
      }, onChunk);

      return result;
    } catch (err) {
      error('Chat stream failed:', err);
      throw err;
    }
  }

  async testConnection(modelId) {
    try {
      const model = this.config.getTargetModel();

      if (!model) {
        return { success: false, error: `Unknown model: ${modelId}` };
      }

      const validation = this.config.validateModelRequirements(model);
      if (!validation.valid) {
        return { success: false, error: validation.reason };
      }

      const loadResult = await this.loadModel(modelId);
      if (!loadResult.success) {
        return { success: false, error: loadResult.error };
      }

      const startTime = Date.now();
      const testPrompt = 'Hello! Say one word.';
      const result = await this.llamaManager.generate(testPrompt, {
        maxTokens: 10,
        temperature: 0.1,
      });

      const latency = Date.now() - startTime;

      if (result.success) {
        return {
          success: true,
          message: `✓ Model loaded and responding (${latency}ms first token)`,
          model: model.name,
          latency
        };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err) {
      error('Connection test failed:', err);
      return { success: false, error: err.message };
    }
  }

  async downloadModel(modelId, onProgress) {
    try {
      const model = this.config.getTargetModel();

      if (!model) {
        throw new Error(`Unknown model: ${modelId}`);
      }

      const validation = this.config.validateModelRequirements(model);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      this.emit('model-download-started', { modelId, model });

      const result = await this.modelDownloader.downloadModelResumable(model, (progress) => {
        this.emit('model-download-progress', {
          modelId,
          model,
          ...progress
        });
        if (onProgress) {
          onProgress(progress);
        }
      });

      if (result.success) {
        this.emit('model-download-complete', {
          modelId,
          model,
          path: result.path,
          size: result.size
        });

        await this.loadModel(modelId);
      } else {
        this.emit('model-download-error', {
          modelId,
          model,
          error: result.error
        });
      }

      return result;
    } catch (error) {
      this.emit('model-download-error', {
        modelId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  async loadModel(modelId) {
    try {
      const model = this.config.getTargetModel();

      if (!model) {
        throw new Error(`Unknown model: ${modelId}`);
      }

      const modelPath = this.modelDownloader.getModelPath(model.filename);

      const result = await this.llamaManager.loadModel(modelPath, {
        gpu: this.config.get('llm.gpu', true),
        contextSize: this.config.get('llm.contextSize', 8192),
        threads: this.config.get('llm.threads', 4),
      });

      if (result.success) {
        this.currentModel = modelId;
        this.config.set('llm.model', modelId);
      }

      return result;
    } catch (err) {
      error('Failed to load model:', err);
      return { success: false, error: err.message };
    }
  }

  async getAvailableModels() {
    const model = this.config.getTargetModel();
    return [{
      id: model.id,
      name: model.name,
      size: model.size,
      sizeGB: model.sizeGB,
      ramRequired: model.ramRequired,
      url: model.url,
      format: model.format,
      contextSize: model.contextSize,
      description: model.description
    }];
  }

  async getModels() {
    const downloadedModels = this.modelDownloader.listDownloadedModels();
    const targetModel = this.config.getTargetModel();

    return downloadedModels.map(model => ({
      name: targetModel.name,
      id: targetModel.id,
      path: model.path,
      size: model.size,
      sizeMB: parseFloat(model.sizeMB),
      format: model.format
    }));
  }

  getModelIdFromPath(modelPath) {
    const targetModel = this.config.getTargetModel();
    if (modelPath.includes(targetModel.filename)) {
      return targetModel.id;
    }
    return targetModel.id;
  }

  async deleteModel(modelId) {
    try {
      const model = this.config.getTargetModel();

      if (!model) {
        throw new Error(`Unknown model: ${modelId}`);
      }

      const modelPath = this.modelDownloader.getModelPath(model.filename);

      const result = await this.modelDownloader.deleteModel(model.filename);

      if (result.success) {
        if (this.validatedModelPath === modelPath) {
          this.validatedModelPath = null;
          this.validatedModelStats = null;
        }
        if (this.currentModel === modelId) {
          await this.llamaManager.shutdown();
          this.currentModel = null;
        }
      }

      return result;
    } catch (err) {
      error('Failed to delete model:', err);
      return { success: false, error: err.message };
    }
  }

  setModel(modelId) {
    const model = this.config.getTargetModel();

    if (!model) {
      return {
        valid: false,
        reason: `Unknown model: ${modelId}`
      };
    }

    const validation = this.config.validateModelRequirements(model);
    if (!validation.valid) {
      return validation;
    }

    this.config.set('llm.model', modelId);

    return { valid: true, model };
  }

  async getConfig() {
    return {
      currentModel: this.currentModel,
      defaultModel: this.config.get('llm.model'),
      enabled: this.config.get('llm.enabled'),
      gpu: this.config.get('llm.gpu'),
      contextSize: this.config.get('llm.contextSize'),
      temperature: this.config.get('llm.temperature'),
      maxTokens: this.config.get('llm.maxTokens'),
      threads: this.config.get('llm.threads'),
      modelDir: this.config.getModelDir(),
      memory: this.config.getMemoryInfo(),
      supportsGPU: this.config.supportsGPU()
    };
  }

  async shutdown() {
    try {
      await this.llamaManager.shutdown();
      this.currentModel = null;
      return { success: true };
    } catch (err) {
      error('Failed to shutdown LlamaBridge:', err);
      return { success: false, error: err.message };
    }
  }
}
