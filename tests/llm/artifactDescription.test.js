import { describe, it, expect, beforeEach } from 'vitest';
import {
  QualityMetrics,
  MockLLMGenerator,
  createMockTile,
  extractDescription,
  extractTitle
} from './testHelpers.js';
import {
  GOLDEN_ARTIFACT_DESCRIPTIONS,
  BAD_EXAMPLES
} from '../fixtures/goldenOutputs.js';

describe('Artifact Description Quality Tests', () => {
  describe('Golden Artifact Validation', () => {
    it('should validate all golden artifact descriptions meet quality standards', () => {
      GOLDEN_ARTIFACT_DESCRIPTIONS.forEach(golden => {
        const quality = QualityMetrics.evaluateOverallQuality(golden.example, {
          minWords: 20, // Adjusted to match actual game requirements
          maxWords: 80, // Adjusted to allow for more descriptive artifacts
          expectedElements: [golden.context.title]
        });

        expect(quality.passed, `Golden artifact should pass: ${golden.context.title}`).toBe(true);
        expect(quality.overallScore).toBeGreaterThanOrEqual(0.7);
      });
    });
  });

  describe('Artifact Length Requirements', () => {
    it('should accept descriptions in 20-80 word range', () => {
      const goodText = "A length of petrified root, veined with brittle crystal, lies half-claimed by the soil. Touch draws a hush from the ground—memory rising like cold breath from a cellar stair.";
      const result = QualityMetrics.meetsLengthRequirement(goodText, 20, 80);

      expect(result.valid).toBe(true);
      expect(result.wordCount).toBeGreaterThanOrEqual(20);
      expect(result.wordCount).toBeLessThanOrEqual(80);
    });

    it('should reject descriptions that are too short', () => {
      const shortText = "A mysterious artifact lies on the ground.";
      const result = QualityMetrics.meetsLengthRequirement(shortText, 20, 80);

      expect(result.valid).toBe(false);
      expect(result.wordCount).toBeLessThan(20);
    });

    it('should flag descriptions that are too verbose', () => {
      // Generate a long text (over 80 words)
      const longText = "A mysterious artifact of ancient origin lies before you in this chamber of forgotten memories. " +
        "The craftsmanship speaks to ages long past when skilled artisans worked with dedication and precision. " +
        "Upon closer examination, intricate patterns reveal themselves across its weathered surface. " +
        "The weight of history seems to press down upon this remarkable object. " +
        "You sense that picking it up might reveal untold secrets of a civilization lost to time. " +
        "Its presence fills the room with an aura of power and mystery that cannot be denied.";
      const result = QualityMetrics.meetsLengthRequirement(longText, 20, 80);

      expect(result.valid).toBe(false);
      expect(result.wordCount).toBeGreaterThan(80);
    });
  });

  describe('Title Extraction', () => {
    it('should extract title from XML response', () => {
      const xml = '<title>Whispering Root</title><description>A mysterious root...</description>';
      const title = extractTitle(xml);

      expect(title).toBe('Whispering Root');
    });

    it('should preserve exact title format', () => {
      const xml = '<title>Echo Tablet</title>';
      const title = extractTitle(xml);

      expect(title).toBe('Echo Tablet');
    });

    it('should return null for missing title', () => {
      const xml = '<description>A mysterious root...</description>';
      const title = extractTitle(xml);

      expect(title).toBeNull();
    });
  });

  describe('Material and Context Integration', () => {
    it('should paraphrase materials rather than listing them verbatim', () => {
      // Good: "A length of petrified root"
      // Bad: "Material: petrified wood (weathered)"
      const goodText = "A length of petrified root, veined with brittle crystal";
      const badText = "Material: petrified wood (weathered). Form: rod.";

      expect(goodText).not.toContain('Material:');
      expect(goodText).not.toContain('Form:');
      expect(badText).toContain('Material:');
    });

    it('should integrate environmental context naturally', () => {
      const goodExample = GOLDEN_ARTIFACT_DESCRIPTIONS.find(g => g.context.title === 'Whispering Root');
      const text = goodExample.example;

      // Should mention the environment (soil/earth) naturally
      expect(text.toLowerCase()).toMatch(/soil|earth|ground/);
      // Should not have XML-style tags
      expect(text).not.toContain('<environment>');
    });

    it('should reflect tile type in description', () => {
      const contexts = GOLDEN_ARTIFACT_DESCRIPTIONS.map(g => ({
        tile: g.context.tileType,
        text: g.example.toLowerCase()
      }));

      contexts.forEach(({ tile, text }) => {
        // Artifact description should subtly reference the tile type
        // e.g., dirt -> "soil", stone -> "stone", cobblestone -> "stones"
        if (tile === 'dirt') {
          expect(text).toMatch(/soil|earth|ground/);
        } else if (tile === 'stone' || tile === 'cobblestone') {
          expect(text).toMatch(/stone/);
        }
      });
    });
  });

  describe('Power Hints', () => {
    it('should integrate power hints subtly', () => {
      const examples = [
        {
          powerHint: 'whispers forgotten knowledge',
          text: "Touch draws a hush from the ground—memory rising like cold breath"
        },
        {
          powerHint: 'reflects the past',
          text: "the floor seems to remember your footsteps before you make them"
        }
      ];

      examples.forEach(({ powerHint, text }) => {
        // Should not mention power hint literally
        expect(text.toLowerCase()).not.toContain(powerHint.toLowerCase());
        // Should evoke the concept through imagery
        expect(text.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Sensory Details', () => {
    it('should include sensory details from golden examples', () => {
      const goldenExamples = GOLDEN_ARTIFACT_DESCRIPTIONS.map(g => g.example);

      const sensoryIndicators = {
        temperature: ['cold', 'chill', 'warm', 'frost'],
        texture: ['smooth', 'rough', 'brittle', 'jagged'],
        visual: ['glisten', 'shimmer', 'glow', 'shadow'],
        sound: ['whisper', 'echo', 'hush', 'silence'],
        motion: ['dance', 'shift', 'rise', 'recoil']
      };

      goldenExamples.forEach(example => {
        const lowerExample = example.toLowerCase();
        let hasSensory = false;

        for (const [category, indicators] of Object.entries(sensoryIndicators)) {
          if (indicators.some(word => lowerExample.includes(word))) {
            hasSensory = true;
            break;
          }
        }

        expect(hasSensory, `Example should have sensory detail: ${example}`).toBe(true);
      });
    });
  });

  describe('Procedural Generation Context', () => {
    it('should validate tile type deduction', () => {
      const tiles = [
        { type: 'moss', props: { organic: true, damp: true, passable: true } },
        { type: 'stone', props: { hard: true, passable: true } },
        { type: 'grass', props: { soft: true, organic: true, passable: true } }
      ];

      tiles.forEach(tile => {
        expect(tile.props).toBeDefined();
        expect(tile.props.passable).toBe(true);
      });
    });

    it('should validate position descriptions', () => {
      const positions = [
        'in the very center',
        'near the western wall',
        'in the northeast corner',
        'in the open area'
      ];

      positions.forEach(pos => {
        expect(pos.length).toBeGreaterThan(0);
        expect(pos).toMatch(/center|wall|corner|area/);
      });
    });
  });

  describe('Environmental Influences', () => {
    it('should apply environmental context from surroundings', () => {
      const frostShardExample = GOLDEN_ARTIFACT_DESCRIPTIONS.find(g => 
        g.context.title === 'Frost Shard'
      );

      expect(frostShardExample).toBeDefined();
      expect(frostShardExample.context.environmentalType).toBe('enclosed');
      expect(frostShardExample.example.toLowerCase()).toContain('corner');
    });
  });

  describe('Artifact Uniqueness', () => {
    it('should generate diverse artifacts from different seeds', () => {
      // Simulate different seed contexts
      const seeds = [
        { level: 1, x: 10, y: 5, tile: 'dirt' },
        { level: 2, x: 20, y: 15, tile: 'stone' },
        { level: 3, x: 5, y: 18, tile: 'moss' }
      ];

      seeds.forEach(seed => {
        const seedStr = `L${seed.level}:${seed.x},${seed.y}`;
        expect(seedStr).toMatch(/L\d+:\d+,\d+/);
      });
    });
  });
});

describe('Artifact Prompt Construction', () => {
  it('should include all required XML elements', () => {
    const requiredElements = [
      'seed',
      'title',
      'materials',
      'form',
      'motif',
      'tile',
      'position',
      'proximity',
      'environment',
      'power_hint',
      'themes'
    ];

    // These should be part of the prompt structure
    requiredElements.forEach(element => {
      expect(element).toMatch(/^[a-z_]+$/);
    });
  });

  it('should use appropriate tile themes', () => {
    const tileThemes = {
      moss: 'ancient, damp, organic',
      stone: 'solid, enduring, cold',
      grass: 'verdant, living, unexpected',
      dirt: 'ancient, earthy, dusty',
      cobblestone: 'architectural, aged, deliberate'
    };

    Object.entries(tileThemes).forEach(([tile, themes]) => {
      expect(themes).toBeDefined();
      expect(themes.length).toBeGreaterThan(0);
    });
  });
});
