import { join } from 'path';
import { existsSync } from 'fs';
import os from 'os';
import { info } from '../../systems/logger.js';

export class ConfigManager {
  constructor({ appDataPath } = {}) {
    this.appDataPath = appDataPath;
    this.settings = new Map();
    this.platform = process.platform;
    
    this.initializeDefaults();
    this.detectMemory();
  }

  initializeDefaults() {
    this.set('llm.model', 'qwen:1.5b');
    this.set('llm.enabled', true);
    this.set('llm.gpu', true);
    this.set('llm.contextSize', 8192);
    this.set('llm.temperature', 0.7);
    this.set('llm.maxTokens', 500);
    this.set('llm.threads', 4);
  }

  getMemoryInfo() {
    return {
      total: this.totalRam,
      free: this.freeRam,
      platform: this.platform
    };
  }

  getTotalRAM() {
    return this.totalRam || 0;
  }

  getFreeRAM() {
    return this.freeRam || 0;
  }

  detectMemory() {
    const total = os.totalmem();
    const free = os.freemem();
    
    this.totalRam = Math.round(total / (1024 * 1024 * 1024));
    this.freeRam = Math.round(free / (1024 * 1024 * 1024));
    
    info(`Memory detected: ${this.totalRam}GB total, ${this.freeRam}GB free`);
  }

  getModelDir() {
    return join(this.appDataPath, 'models', 'qwen2.5', 'main');
  }

  getTargetModel() {
    return {
      id: 'qwen:1.5b',
      name: 'Qwen2.5-1.5B-Instruct',
      revision: '91cad51170dc346986eccefdc2dd33a9da36ead9',
      filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
      url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/91cad51170dc346986eccefdc2dd33a9da36ead9/qwen2.5-1.5b-instruct-q4_k_m.gguf?download=true',
      expectedSize: 1117320736,
      sha256: '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e',
      etag: '6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e',
      sizeGB: 1.04,
      size: '1.04GB',
      ramRequired: 3,
      contextSize: 8192,
      format: 'GGUF',
      description: 'Optimized 1.5B model with excellent performance/size ratio'
    };
  }

  getModelById(modelId) {
    const target = this.getTargetModel();
    return target.id === modelId ? target : null;
  }

  validateModelRequirements(model) {
    const availableRam = this.totalRam;

    if (model.ramRequired && availableRam < model.ramRequired) {
      return {
        valid: false,
        reason: `Insufficient RAM. Required: ${model.ramRequired}GB, Available: ${availableRam}GB`
      };
    }

    return { valid: true };
  }

  set(key, value) {
    this.settings.set(key, value);
  }

  get(key, defaultValue) {
    return this.settings.get(key) ?? defaultValue;
  }

  getAll() {
    return Object.fromEntries(this.settings);
  }

  getPlatform() {
    return this.platform;
  }

  isPlatform(platform) {
    return this.platform === platform;
  }

  supportsGPU() {
    if (this.isPlatform('darwin')) {
      return true;
    }
    if (this.isPlatform('linux')) {
      return true;
    }
    if (this.isPlatform('win32')) {
      return true;
    }
    return false;
  }
}
