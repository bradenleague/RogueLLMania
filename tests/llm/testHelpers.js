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
   * NEW VARIETY METRICS: Detect opening pattern repetition
   * Extracts first 5 words from each text and measures uniqueness
   */
  measureOpeningPatterns(texts) {
    if (texts.length < 2) {
      return { uniqueness: 1.0, patterns: [], mostCommon: null, repetitionRate: 0 };
    }

    const openings = texts.map(t => {
      const words = t.split(/\s+/).slice(0, 5).join(' ').toLowerCase();
      return words;
    });

    const patternCounts = {};
    openings.forEach(o => {
      patternCounts[o] = (patternCounts[o] || 0) + 1;
    });

    const patterns = Object.entries(patternCounts)
      .map(([pattern, count]) => ({ pattern, count, percentage: count / texts.length }))
      .sort((a, b) => b.count - a.count);

    const uniquePatterns = patterns.length;
    const mostCommon = patterns[0] || null;
    const repetitionRate = mostCommon ? mostCommon.percentage : 0;

    // Uniqueness: 1.0 if all unique, 0.0 if all identical
    const uniqueness = uniquePatterns / texts.length;

    return {
      uniqueness,
      patterns: patterns.slice(0, 5), // Top 5 patterns
      mostCommon,
      repetitionRate
    };
  },

  /**
   * NEW VARIETY METRICS: Enhanced phrase repetition with variable window sizes
   * Detects repeated phrases of 4-8 words (not just 3)
   */
  measurePhraseRepetition(texts, windowSize = 6) {
    if (texts.length < 2) {
      return { diversity: 1.0, repeatedPhrases: [], worstOffenders: [] };
    }

    const extractPhrases = (text, window) => {
      const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const phrases = [];
      for (let i = 0; i <= words.length - window; i++) {
        phrases.push(words.slice(i, i + window).join(' '));
      }
      return phrases;
    };

    // Count phrases across all texts
    const allPhrases = texts.flatMap(t => extractPhrases(t, windowSize));
    const phraseCounts = {};
    allPhrases.forEach(p => {
      phraseCounts[p] = (phraseCounts[p] || 0) + 1;
    });

    const repeatedPhrases = Object.entries(phraseCounts)
      .filter(([_, count]) => count > 1)
      .map(([phrase, count]) => ({ phrase, count, percentage: count / texts.length }))
      .sort((a, b) => b.count - a.count);

    const worstOffenders = repeatedPhrases.filter(p => p.percentage > 0.3); // >30% repetition

    // Diversity: lower penalty for fewer repeated phrases
    const repetitionPenalty = Math.min(repeatedPhrases.length * 0.05, 0.5);
    const diversity = Math.max(0, 1.0 - repetitionPenalty);

    return {
      diversity,
      repeatedPhrases: repeatedPhrases.slice(0, 10), // Top 10
      worstOffenders,
      coverage: worstOffenders.length
    };
  },

  /**
   * NEW VARIETY METRICS: Detect closing pattern repetition
   * Extracts last 8 words from each text and measures uniqueness
   */
  measureClosingPatterns(texts) {
    if (texts.length < 2) {
      return { uniqueness: 1.0, patterns: [], repeatedClosings: [] };
    }

    const closings = texts.map(t => {
      const words = t.split(/\s+/);
      const closing = words.slice(Math.max(0, words.length - 8)).join(' ').toLowerCase();
      return closing;
    });

    const patternCounts = {};
    closings.forEach(c => {
      patternCounts[c] = (patternCounts[c] || 0) + 1;
    });

    const patterns = Object.entries(patternCounts)
      .map(([pattern, count]) => ({ pattern, count, percentage: count / texts.length }))
      .sort((a, b) => b.count - a.count);

    const uniquePatterns = patterns.length;
    const repeatedClosings = patterns.filter(p => p.count > 1);

    const uniqueness = uniquePatterns / texts.length;

    return {
      uniqueness,
      patterns: patterns.slice(0, 5),
      repeatedClosings
    };
  },

  /**
   * NEW VARIETY METRICS: Measure structural diversity
   * Detects when all outputs follow the same sentence-count pattern
   */
  measureStructuralDiversity(texts) {
    if (texts.length < 2) {
      return { variance: 1.0, templateScore: 1.0, structuralVariance: 1.0 };
    }

    // Count sentences per text (split on period, question mark, exclamation)
    const sentenceCounts = texts.map(t => {
      const sentences = t.split(/[.!?]+/).filter(s => s.trim().length > 0);
      return sentences.length;
    });

    // Calculate variance in sentence counts
    const avgSentences = sentenceCounts.reduce((sum, c) => sum + c, 0) / sentenceCounts.length;
    const variance = sentenceCounts.reduce((sum, c) => sum + Math.pow(c - avgSentences, 2), 0) / sentenceCounts.length;

    // Check if all texts have same sentence count (template indicator)
    const uniqueSentenceCounts = new Set(sentenceCounts).size;
    const templateScore = uniqueSentenceCounts / texts.length; // 1.0 if all different, lower if same

    // Measure sentence length variance
    const avgSentenceLengths = texts.map(t => {
      const sentences = t.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const lengths = sentences.map(s => s.split(/\s+/).length);
      return lengths.reduce((sum, l) => sum + l, 0) / (lengths.length || 1);
    });

    const avgLengthVariance = avgSentenceLengths.reduce((sum, l) => sum + Math.pow(l - avgSentences, 2), 0) / avgSentenceLengths.length;

    // Overall structural variance (0.0 = identical structure, 1.0 = very diverse)
    const structuralVariance = Math.min((variance + avgLengthVariance) / 10, 1.0);

    return {
      variance,
      templateScore,
      structuralVariance,
      sentenceCounts,
      uniqueSentenceCounts
    };
  },

  /**
   * UPDATED: Composite variety measurement using all new metrics
   * Replaces old single-word + 3-word phrase detection with comprehensive analysis
   */
  measureVariety(texts) {
    if (texts.length < 2) {
      return { valid: true, score: 1.0, message: 'Need 2+ texts to measure variety' };
    }

    // Run all new variety metrics
    const opening = this.measureOpeningPatterns(texts);
    const middle = this.measurePhraseRepetition(texts, 6); // 6-word window
    const closing = this.measureClosingPatterns(texts);
    const structure = this.measureStructuralDiversity(texts);

    // Weighted composite score (matches plan)
    const varietyScore =
      opening.uniqueness * 0.3 +
      middle.diversity * 0.3 +
      closing.uniqueness * 0.2 +
      structure.structuralVariance * 0.2;

    return {
      valid: varietyScore >= 0.6, // Updated threshold from plan
      score: varietyScore,
      openingPatterns: opening,
      phraseRepetition: middle,
      closingPatterns: closing,
      structure: structure,
      // Legacy fields for backward compatibility
      repeatedPhrases: middle.repeatedPhrases.slice(0, 5),
      uniqueOpenings: Math.round(opening.uniqueness * texts.length),
      totalTexts: texts.length,
      openingVariety: opening.uniqueness
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
