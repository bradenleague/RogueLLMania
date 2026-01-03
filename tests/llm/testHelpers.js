/**
 * Test helpers and utilities for LLM generation testing
 */

/**
 * Quality metrics for evaluating LLM-generated narration
 */
export const QualityMetrics = {
  /**
   * Check if text meets length requirements
   * Updated defaults for shorter, punchier outputs
   */
  meetsLengthRequirement(text, minWords = 15, maxWords = 50) {
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    return {
      valid: wordCount >= minWords && wordCount <= maxWords,
      wordCount,
      minWords,
      maxWords,
      tooShort: wordCount < minWords,
      tooLong: wordCount > maxWords
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
   * Check if text avoids common LLM clichés and generic fantasy phrases
   */
  avoidsClichés(text) {
    const clichés = [
      // Generic LLM clichés
      'in the heart of',
      'it is important to note',
      'as you can see',
      'note that',
      'it should be noted',
      'literally',
      'at the end of the day',
      // Generic fantasy clichés (added for our aesthetic)
      'ancient evil',
      'darkness lurks',
      'whispers of the past',
      'echoes of forgotten',
      'the air grows cold',
      'mystical energy',
      'dark secrets',
      'forgotten magic',
      'ancient power'
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
   * Measure variety/uniqueness across multiple outputs
   * Pass an array of texts and get variety metrics
   */
  measureVariety(texts) {
    if (texts.length < 2) {
      return { valid: true, score: 1.0, message: 'Need 2+ texts to measure variety' };
    }

    // Extract significant phrases (3+ word sequences)
    const extractPhrases = (text) => {
      const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const phrases = [];
      for (let i = 0; i < words.length - 2; i++) {
        phrases.push(words.slice(i, i + 3).join(' '));
      }
      return phrases;
    };

    // Count repeated phrases across all texts
    const allPhrases = texts.flatMap(extractPhrases);
    const phraseCounts = {};
    allPhrases.forEach(p => {
      phraseCounts[p] = (phraseCounts[p] || 0) + 1;
    });

    const repeatedPhrases = Object.entries(phraseCounts)
      .filter(([_, count]) => count > 1)
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate unique opening words (variety in sentence starts)
    const openingWords = texts.map(t => t.split(/\s+/)[0]?.toLowerCase());
    const uniqueOpenings = new Set(openingWords).size;
    const openingVariety = uniqueOpenings / texts.length;

    // Calculate variety score (higher is better)
    const repetitionPenalty = Math.min(repeatedPhrases.length * 0.1, 0.5);
    const varietyScore = Math.max(0, (openingVariety - repetitionPenalty));

    return {
      valid: varietyScore >= 0.5,
      score: varietyScore,
      repeatedPhrases: repeatedPhrases.slice(0, 5), // Top 5 repeated
      uniqueOpenings,
      totalTexts: texts.length,
      openingVariety
    };
  },

  /**
   * Check for "weirdness" - presence of non-standard fantasy imagery
   * Higher score = more aligned with Scavengers Reign / Numenera aesthetic
   */
  hasWeirdness(text) {
    const weirdIndicators = [
      // Perceptual strangeness
      'shadow', 'bends', 'larger', 'smaller', 'taste', 'sound',
      // Temporal strangeness
      'waiting', 'patience', 'memory', 'remember', 'forgot', 'before',
      // Agency/awareness
      'watches', 'expects', 'knows', 'facing', 'intent', 'deliberate',
      // Material strangeness
      'warm', 'cold', 'shifts', 'weight', 'touching', 'touched',
      // Spatial strangeness
      'real', 'emphatically', 'exists', 'space', 'orient',
      // Biological/symbiotic
      'grows', 'breathes', 'metabol', 'symbi', 'organism', 'membrane',
      // Incomprehensible
      'incomprehensible', 'purpose', 'billion', 'ancient', 'planetary'
    ];

    const lowerText = text.toLowerCase();
    const found = weirdIndicators.filter(w => lowerText.includes(w));

    return {
      valid: found.length >= 2,
      found,
      count: found.length,
      score: Math.min(found.length / 4, 1.0) // Cap at 1.0, need 4 for max
    };
  },

  /**
   * Comprehensive quality check for a single output
   */
  evaluateOverallQuality(text, context = {}) {
    const metrics = {
      length: this.meetsLengthRequirement(text, context.minWords, context.maxWords),
      cleanOutput: this.hasCleanOutput(text),
      atmospheric: this.hasAtmosphericLanguage(text),
      weirdness: this.hasWeirdness(text),
      clichés: this.avoidsClichés(text)
    };

    if (context.expectedElements) {
      metrics.context = this.containsContext(text, context.expectedElements);
    }

    // Calculate weighted score
    // Length and clean output are critical, weirdness and atmospheric are important
    const weights = {
      length: 0.25,
      cleanOutput: 0.25,
      weirdness: 0.20,
      atmospheric: 0.15,
      clichés: 0.10,
      context: 0.05
    };

    let totalWeight = 0;
    let weightedScore = 0;
    for (const [key, metric] of Object.entries(metrics)) {
      const weight = weights[key] || 0.1;
      totalWeight += weight;
      weightedScore += (metric.valid ? 1 : 0) * weight;
    }

    const overallScore = weightedScore / totalWeight;

    return {
      metrics,
      overallScore,
      passed: overallScore >= 0.6, // 60% threshold (lowered since we added more metrics)
      wordCount: metrics.length.wordCount
    };
  },

  /**
   * Evaluate a batch of outputs for both individual quality and variety
   */
  evaluateBatch(texts, context = {}) {
    const individualResults = texts.map(text => this.evaluateOverallQuality(text, context));
    const varietyResult = this.measureVariety(texts);

    const avgScore = individualResults.reduce((sum, r) => sum + r.overallScore, 0) / texts.length;
    const avgWordCount = individualResults.reduce((sum, r) => sum + r.wordCount, 0) / texts.length;
    const passRate = individualResults.filter(r => r.passed).length / texts.length;

    return {
      individual: individualResults,
      variety: varietyResult,
      summary: {
        avgScore,
        avgWordCount,
        passRate,
        varietyScore: varietyResult.score,
        totalTests: texts.length
      }
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
