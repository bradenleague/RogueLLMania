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
    // Model swap: update llm.model + getTargetModel() when changing the bundled LLM.
    this.set('llm.model', 'qwen3:1.7b');
    this.set('llm.enabled', true);
    this.set('llm.gpu', true);
    this.set('llm.contextSize', 32768);
    // Per-mode temperature: artifacts need precision, level intros can be more creative
    this.set('llm.temperature', {
      levelIntro: 0.75,  // Balance variety + control
      artifact: 0.65,    // Precision + brevity
      default: 0.7       // Fallback for other modes
    });
    this.set('llm.maxTokens', 500);
    this.set('llm.threads', 4);
    this.set('llm.repeatPenalty', {
      lastTokens: 32,
      penalty: 1.1,
      penalizeNewLine: true,
      frequencyPenalty: 0.03,
      presencePenalty: 0.03
    });
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
    return join(this.appDataPath, 'models', 'qwen3', 'main');
  }

  getTargetModel() {
    return {
      id: 'qwen3:1.7b',
      name: 'Qwen3-1.7B-Instruct',
      revision: '9133944160303d79aad5acc1d86feaecbb47978f',
      filename: 'Qwen3-1.7B-Q4_K_M.gguf',
      url: 'https://huggingface.co/lm-kit/qwen-3-1.7b-instruct-gguf/resolve/9133944160303d79aad5acc1d86feaecbb47978f/Qwen3-1.7B-Q4_K_M.gguf?download=true',
      expectedSize: 1282439360,
      sha256: 'b047d6617eba56dcfa3357566b06807f54b15816faf6182aabd12d7e2378e537',
      etag: 'b047d6617eba56dcfa3357566b06807f54b15816faf6182aabd12d7e2378e537',
      sizeGB: 1.19,
      size: '1.19GB',
      ramRequired: 3,
      contextSize: 32768,
      format: 'GGUF',
      description: 'Quantized Qwen3-1.7B instruct model (Q4_K_M) with enhanced reasoning and narrative quality'
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

  /**
   * Get system prompts for different generation modes
   * Using session-level systemPrompt reduces per-call token overhead by ~150 words
   *
   * SLOT-BASED GENERATION: We request typed slots with strict constraints,
   * then assemble them deterministically to ensure length control and variety.
   *
   * TODO: Ban List System (see plan Part 6)
   * After gathering more benchmark data, implement banned phrase filtering:
   * - Add bannedPhrases config with mode-specific lists
   * - Option 1: Add to prompts as explicit constraints
   * - Option 2: Post-generation validation and retry
   * - Option 3: Grammar-based token sequence blocking
   */
  getSystemPrompts() {
    return {
      // Level intros use 3 slots: room (environment), threat (enemies), oddity (weirdness)
      levelIntro: `You write 3-part chamber introductions. Each part has a specific job.

TONE: Science-fantasy. Technology/biology blur. Things have agency.
AVOID: "ancient evil", "darkness lurks", "the air grows cold"
PREFER: strange symbiosis, incomprehensible purpose, responsive environments

SLOT 1 - ROOM (8-14 words):
- Describe the floor/environment with 1 concrete sensory detail (sound/smell/temperature)
- Second person, present tense
- Example: "Grass thrives under stone, cold and wet against your boots."

SLOT 2 - THREAT (6-12 words):
- Imply monster presence through behavior, not numbers
- Use vivid verbs (loiter, pace, coil, twitch)
- Example: "Three zombies loiter between mossy pillars, heads twitching."

SLOT 3 - ODDITY (8-14 words):
- ONE uncanny detail that feels wrong or alien
- Make environment responsive/alive
- Example: "The blades lean the wrong way, as if listening to something below you."

Respond with JSON: {"room": "...", "threat": "...", "oddity": "..."}`,

      // Artifacts use 2 slots: placement (location/interaction), effect (weirdness/power)
      artifact: `You write 2-part artifact descriptions. Be brief and strange.

TONE: Science-fantasy. Objects have presence—they respond, remember, wait.
AVOID: "ancient power", "mystical energy", "dark secrets"
PREFER: strange physics, alien logic, things that recognize you

SLOT 1 - PLACEMENT (10-18 words):
- Where it is + how it interacts with the room
- Show relationship between artifact and environment
- Example: "Iron Lens lies in the grass like a dropped eye, every blade angled toward it."

SLOT 2 - EFFECT (10-18 words):
- Hint at power through subtle weirdness
- Show what happens when you interact/observe
- Example: "When you lift it, your shadow bends first—late to follow, as if it hesitates."

Respond with JSON: {"title": "exact artifact name", "placement": "...", "effect": "..."}`
    };
  }
}
