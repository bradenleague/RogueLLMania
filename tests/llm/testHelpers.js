/**
 * Test helpers and utilities for LLM generation testing
 */

/**
 * Quality metrics for evaluating LLM-generated narration
 */
export const QualityMetrics = {
  /**
   * Check if text meets minimum length requirements
   */
  meetsLengthRequirement(text, minWords = 20, maxWords = 100) {
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    return {
      valid: wordCount >= minWords && wordCount <= maxWords,
      wordCount,
      minWords,
      maxWords
    };
  },

  /**
   * Check if text contains expected context elements
   */
  containsContext(text, expectedElements) {
    const lowerText = text.toLowerCase();
    const found = [];
    const missing = [];

    for (const element of expectedElements) {
      if (lowerText.includes(element.toLowerCase())) {
        found.push(element);
      } else {
        missing.push(element);
      }
    }

    return {
      valid: missing.length === 0,
      found,
      missing,
      coverage: found.length / expectedElements.length
    };
  },

  /**
   * Check for unwanted artifacts in text (tags, code fences, etc.)
   */
  hasCleanOutput(text) {
    const issues = [];
    
    // Check for XML/HTML tags
    if (/<[^>]+>/.test(text)) {
      issues.push('Contains XML/HTML tags');
    }
    
    // Check for markdown code fences
    if (/```/.test(text)) {
      issues.push('Contains code fences');
    }
    
    // Check for think tags
    if (/<think>/i.test(text)) {
      issues.push('Contains <think> tags');
    }
    
    // Check for leading "xml" or format indicators
    if (/^\s*xml\b/i.test(text)) {
      issues.push('Contains format indicator');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  },

  /**
   * Check if text uses evocative, atmospheric language
   */
  hasAtmosphericLanguage(text) {
    const atmosphericWords = [
      'shadow', 'echo', 'ancient', 'mysterious', 'dark', 'light',
      'whisper', 'silence', 'cold', 'breath', 'glow', 'shimmer',
      'dust', 'stone', 'forgotten', 'hidden', 'secret', 'eerie',
      'damp', 'musty', 'crumbling', 'vast', 'narrow', 'twisting'
    ];

    const lowerText = text.toLowerCase();
    const foundWords = atmosphericWords.filter(word => 
      new RegExp(`\\b${word}`, 'i').test(lowerText)
    );

    return {
      valid: foundWords.length >= 2,
      foundWords,
      count: foundWords.length
    };
  },

  /**
   * Check if text avoids common LLM clichés
   */
  avoidsClichés(text) {
    const clichés = [
      'in the heart of',
      'it is important to note',
      'as you can see',
      'note that',
      'it should be noted',
      'literally',
      'at the end of the day'
    ];

    const lowerText = text.toLowerCase();
    const foundClichés = clichés.filter(cliché => 
      lowerText.includes(cliché)
    );

    return {
      valid: foundClichés.length === 0,
      foundClichés
    };
  },

  /**
   * Comprehensive quality check
   */
  evaluateOverallQuality(text, context = {}) {
    const metrics = {
      length: this.meetsLengthRequirement(text, context.minWords, context.maxWords),
      cleanOutput: this.hasCleanOutput(text),
      atmospheric: this.hasAtmosphericLanguage(text),
      clichés: this.avoidsClichés(text)
    };

    if (context.expectedElements) {
      metrics.context = this.containsContext(text, context.expectedElements);
    }

    // Calculate overall score
    const scores = Object.values(metrics).map(m => m.valid ? 1 : 0);
    const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      metrics,
      overallScore,
      passed: overallScore >= 0.7 // 70% threshold
    };
  }
};

/**
 * Mock LLM responses for testing without actual model inference
 */
export class MockLLMGenerator {
  constructor() {
    this.responses = new Map();
    this.callCount = 0;
  }

  /**
   * Set a mock response for a specific prompt pattern
   */
  setMockResponse(promptPattern, response) {
    this.responses.set(promptPattern, response);
  }

  /**
   * Generate a mock response
   */
  async generate(prompt) {
    this.callCount++;

    // Find matching pattern
    for (const [pattern, response] of this.responses.entries()) {
      if (prompt.includes(pattern)) {
        return typeof response === 'function' ? response(prompt) : response;
      }
    }

    // Default response
    return {
      text: '<description>A mysterious chamber unfolds before you, its ancient stones whispering secrets of ages past. Shadows dance along the walls as you step forward into the unknown.</description>'
    };
  }

  /**
   * Reset call count and responses
   */
  reset() {
    this.callCount = 0;
    this.responses.clear();
  }
}

/**
 * Create a mock map for testing
 */
export function createMockMap(width = 40, height = 20, tileType = 'stone') {
  const map = [];
  for (let x = 0; x < width; x++) {
    map[x] = [];
    for (let y = 0; y < height; y++) {
      map[x][y] = createMockTile(tileType);
    }
  }
  return map;
}

/**
 * Create a mock tile with specified properties
 */
export function createMockTile(type = 'stone') {
  const tileTypes = {
    stone: { hard: true, passable: true },
    grass: { soft: true, organic: true, passable: true },
    moss: { organic: true, damp: true, passable: true },
    dirt: { dusty: true, passable: true },
    cobblestone: { hard: true, ancient: true, passable: true },
    sand: { granular: true, passable: true },
    water: { wet: true, passable: false }
  };

  return {
    type,
    char: type === 'grass' ? '"' : type === 'water' ? '~' : '.',
    props: tileTypes[type] || tileTypes.stone,
    solid: false
  };
}

/**
 * Timer utility for measuring generation performance
 */
export class PerformanceTimer {
  constructor() {
    this.measurements = [];
  }

  start() {
    this.startTime = Date.now();
  }

  end(label = 'measurement') {
    const duration = Date.now() - this.startTime;
    this.measurements.push({ label, duration });
    return duration;
  }

  getStats() {
    if (this.measurements.length === 0) return null;

    const durations = this.measurements.map(m => m.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return { avg, min, max, count: durations.length };
  }

  reset() {
    this.measurements = [];
  }
}

/**
 * Extract text from XML description tags
 */
export function extractDescription(text) {
  const match = text.match(/<description>(.*?)<\/description>/s);
  return match ? match[1].trim() : text;
}

/**
 * Extract title from XML title tags
 */
export function extractTitle(text) {
  const match = text.match(/<title>(.*?)<\/title>/);
  return match ? match[1].trim() : null;
}
