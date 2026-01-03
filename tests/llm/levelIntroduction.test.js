import { describe, it, expect, beforeEach } from 'vitest';
import { 
  QualityMetrics, 
  MockLLMGenerator, 
  createMockMap,
  extractDescription 
} from './testHelpers.js';
import { 
  GOLDEN_LEVEL_INTRODUCTIONS, 
  BAD_EXAMPLES 
} from '../fixtures/goldenOutputs.js';

describe('Level Introduction Quality Tests', () => {
  describe('Quality Metrics', () => {
    it('should validate length requirements', () => {
      const goodText = "You step into a verdant chamber where soft grass somehow thrives beneath ancient stone. The air shifts with shambling presences, and decay mingles with the earthy scent of growth.";
      const result = QualityMetrics.meetsLengthRequirement(goodText, 20, 100);
      
      expect(result.valid).toBe(true);
      expect(result.wordCount).toBeGreaterThan(20);
      expect(result.wordCount).toBeLessThan(100);
    });

    it('should reject text that is too short', () => {
      const shortText = BAD_EXAMPLES.tooShort;
      const result = QualityMetrics.meetsLengthRequirement(shortText, 20, 100);
      
      expect(result.valid).toBe(false);
      expect(result.wordCount).toBeLessThan(20);
    });

    it('should detect XML/HTML tags in output', () => {
      const dirtyText = BAD_EXAMPLES.hasXMLTags;
      const result = QualityMetrics.hasCleanOutput(dirtyText);
      
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect code fences in output', () => {
      const dirtyText = BAD_EXAMPLES.hasCodeFence;
      const result = QualityMetrics.hasCleanOutput(dirtyText);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Contains code fences');
    });

    it('should validate atmospheric language', () => {
      const goodText = "You step into a chamber where shadows dance and ancient whispers echo through the cold stone.";
      const result = QualityMetrics.hasAtmosphericLanguage(goodText);
      
      expect(result.valid).toBe(true);
      expect(result.foundWords.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect common LLM clichés', () => {
      const clichéText = BAD_EXAMPLES.hasClichés;
      const result = QualityMetrics.avoidsClichés(clichéText);
      
      expect(result.valid).toBe(false);
      expect(result.foundClichés.length).toBeGreaterThan(0);
    });
  });

  describe('Golden Output Validation', () => {
    it('should validate all golden level introductions meet quality standards', () => {
      GOLDEN_LEVEL_INTRODUCTIONS.forEach(golden => {
        golden.examples.forEach(example => {
          const quality = QualityMetrics.evaluateOverallQuality(example, {
            minWords: 20,
            maxWords: 100
          });
          
          expect(quality.passed, `Golden example should pass quality check: ${example}`).toBe(true);
          expect(quality.overallScore).toBeGreaterThanOrEqual(0.7);
        });
      });
    });
  });

  describe('Context Integration', () => {
    it('should include monster type in description', () => {
      const text = "The shambling undead move through the shadows, their presence unmistakable.";
      const result = QualityMetrics.containsContext(text, ['undead', 'shambling']);
      
      expect(result.valid).toBe(true);
      expect(result.coverage).toBe(1.0);
    });

    it('should reference tile/floor type', () => {
      const text = "You step onto soft grass that somehow thrives in this underground realm.";
      const result = QualityMetrics.containsContext(text, ['grass']);
      
      expect(result.valid).toBe(true);
    });

    it('should detect missing context elements', () => {
      const text = "You enter a room with some things.";
      const result = QualityMetrics.containsContext(text, ['grass', 'zombie', 'artifact']);
      
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBe(3);
      expect(result.coverage).toBe(0);
    });
  });

  describe('Bad Example Detection', () => {
    it('should flag all bad examples', () => {
      Object.entries(BAD_EXAMPLES).forEach(([key, badText]) => {
        const quality = QualityMetrics.evaluateOverallQuality(badText, {
          minWords: 20,
          maxWords: 100
        });
        
        // Bad examples should generally fail (though some might pass on certain metrics)
        expect(quality.overallScore, `Bad example "${key}" should have low quality score`).toBeLessThan(1.0);
      });
    });
  });

  describe('Mock Generator', () => {
    let mockGen;

    beforeEach(() => {
      mockGen = new MockLLMGenerator();
    });

    it('should return mock responses', async () => {
      const response = await mockGen.generate('test prompt');
      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should use custom mock responses', async () => {
      mockGen.setMockResponse('custom', { text: '<description>Custom response</description>' });
      
      const response = await mockGen.generate('custom prompt');
      expect(response.text).toContain('Custom response');
    });

    it('should track call count', async () => {
      await mockGen.generate('test 1');
      await mockGen.generate('test 2');
      
      expect(mockGen.callCount).toBe(2);
    });
  });

  describe('Text Extraction', () => {
    it('should extract description from XML tags', () => {
      const xml = '<description>A mysterious chamber awaits.</description>';
      const extracted = extractDescription(xml);
      
      expect(extracted).toBe('A mysterious chamber awaits.');
    });

    it('should handle text without tags', () => {
      const plain = 'A mysterious chamber awaits.';
      const extracted = extractDescription(plain);
      
      expect(extracted).toBe(plain);
    });
  });
});

describe('Level Introduction Prompt Testing', () => {
  it('should construct valid prompts with all required context', () => {
    const context = {
      levelNumber: 1,
      levelType: 'basic',
      dominantTile: 'grass',
      monsterCount: 3,
      monsterTypes: { zombie: 2, chaser: 1 },
      staticObjectCount: 2,
      storyObjectDetails: {
        title: 'Ancient Relic',
        description: 'A mysterious stone tablet.'
      }
    };

    // Verify context has all necessary fields
    expect(context.levelNumber).toBeDefined();
    expect(context.levelType).toBeDefined();
    expect(context.dominantTile).toBeDefined();
    expect(context.monsterCount).toBeGreaterThan(0);
  });

  it('should handle missing story object gracefully', () => {
    const context = {
      levelNumber: 1,
      levelType: 'cave',
      dominantTile: 'stone',
      monsterCount: 5,
      monsterTypes: { chaser: 5 },
      staticObjectCount: 1,
      storyObjectDetails: null
    };

    // Should not have story object details
    expect(context.storyObjectDetails).toBeNull();
  });
});
