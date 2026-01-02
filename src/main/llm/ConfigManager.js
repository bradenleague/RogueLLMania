const os = require('os');
const path = require('path');
const fs = require('fs').promises;

class ConfigManager {
  constructor(options = {}) {
    this.appDataPath = options.appDataPath;
    this.dataPath = options.dataPath || this.getDefaultDataPath();
    this.config = {
      ollama: {
        defaultModel: this.getDefaultModel(),
        port: null,
        host: '127.0.0.1',
        startupTimeout: 30000,
        maxRetries: 3
      },
      models: {
        recommended: this.getRecommendedModels()
      },
      memory: this.detectSystemMemory()
    };
  }

  getDefaultDataPath() {
    const platform = process.platform;
    let baseDir;

    if (platform === 'darwin') {
      baseDir = path.join(os.homedir(), 'Library', 'Application Support', 'RogueLLMania');
    } else if (platform === 'win32') {
      baseDir = path.join(os.homedir(), 'AppData', 'Local', 'RogueLLMania');
    } else {
      baseDir = path.join(os.homedir(), '.roguellmania');
    }

    return path.join(baseDir, 'ollama');
  }

  detectSystemMemory() {
    try {
      const totalMemGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
      const freeMemGB = Math.round(os.freemem() / (1024 * 1024 * 1024));
      
      return {
        total: totalMemGB,
        free: freeMemGB,
        isLowMemory: totalMemGB < 8,
        canRun7B: totalMemGB >= 8,
        canRun14B: totalMemGB >= 16
      };
    } catch (error) {
      console.warn('Failed to detect system memory:', error);
      return {
        total: 16,
        free: 8,
        isLowMemory: false,
        canRun7B: true,
        canRun14B: false
      };
    }
  }

  getDefaultModel() {
    const mem = this.detectSystemMemory();
    if (mem.isLowMemory) {
      return 'phi3:mini';
    }
    return 'gemma3n:e4b';
  }

  getRecommendedModels() {
    const mem = this.detectSystemMemory();
    const models = [
      {
        name: 'phi3:mini',
        size: '2.2GB',
        sizeBytes: 2.2 * 1024 * 1024 * 1024,
        ramRequired: 4,
        description: 'Fast, efficient for low-RAM systems',
        recommendedFor: ['all', 'low-memory'],
        default: mem.isLowMemory
      },
      {
        name: 'gemma3n:e4b',
        size: '2.5GB',
        sizeBytes: 2.5 * 1024 * 1024 * 1024,
        ramRequired: 6,
        description: 'Good balance of quality and speed',
        recommendedFor: ['all'],
        default: !mem.isLowMemory
      }
    ];

    if (mem.canRun7B) {
      models.push({
        name: 'llama3.2:3b',
        size: '2.0GB',
        sizeBytes: 2.0 * 1024 * 1024 * 1024,
        ramRequired: 8,
        description: 'Higher quality for systems with 8GB+ RAM',
        recommendedFor: ['standard', 'high-memory']
      });
    }

    if (mem.canRun14B) {
      models.push({
        name: 'llama3.2:7b',
        size: '4.5GB',
        sizeBytes: 4.5 * 1024 * 1024 * 1024,
        ramRequired: 16,
        description: 'Best quality for systems with 16GB+ RAM',
        recommendedFor: ['high-memory']
      });
    }

    return models;
  }

  get(key) {
    const keys = key.split('.');
    let value = this.config;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) break;
    }
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let target = this.config;
    for (const k of keys) {
      if (!target[k]) target[k] = {};
      target = target[k];
    }
    target[lastKey] = value;
  }

  getAll() {
    return JSON.parse(JSON.stringify(this.config));
  }

  async ensureDirectories() {
    const dirs = [
      this.dataPath,
      path.join(this.dataPath, 'models'),
      path.join(this.dataPath, 'logs')
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  validateModelChoice(modelName) {
    const model = this.get('models.recommended').find(m => m.name === modelName);
    if (!model) return { valid: false, reason: 'Model not found' };

    const mem = this.get('memory');
    if (model.ramRequired > mem.total) {
      return {
        valid: false,
        reason: `Model requires ${model.ramRequired}GB RAM, but system has ${mem.total}GB`,
        warning: true
      };
    }

    return { valid: true };
  }
}

module.exports = ConfigManager;