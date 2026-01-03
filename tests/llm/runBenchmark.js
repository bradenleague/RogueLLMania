/**
 * Example benchmark test demonstrating how to use the benchmark system
 * 
 * Run this with: npm run benchmark
 */

import { BenchmarkRunner, createBenchmarkSuite } from './benchmark.js';
import { MockLLMGenerator } from './testHelpers.js';
import { TEST_PROMPTS, GOLDEN_LEVEL_INTRODUCTIONS } from '../fixtures/goldenOutputs.js';

// Initialize the benchmark runner
const runner = new BenchmarkRunner();

// Create a mock LLM generator for testing
// In production, replace this with actual LLM calls
const mockGen = new MockLLMGenerator();

// Set up mock responses that simulate good quality outputs
mockGen.setMockResponse('Chamber Herald', () => ({
  text: '<description>You step into a verdant chamber where soft grass somehow thrives beneath ancient stone. The air shifts with shambling presences, and decay mingles with the earthy scent of growth.</description>'
}));

/**
 * Level Introduction Benchmark Suite
 */
const levelIntroSuite = createBenchmarkSuite('Level Introductions', [
  {
    name: 'Basic Chamber - Grass Floor',
    context: {
      minWords: 20,
      maxWords: 100,
      expectedElements: ['grass', 'chamber']
    },
    fn: async () => {
      // Simulate LLM generation
      const response = await mockGen.generate(TEST_PROMPTS.levelIntroduction.basic);
      return response.text.replace(/<description>|<\/description>/g, '').trim();
    }
  },
  {
    name: 'Cave - Moss Floor with Chasers',
    context: {
      minWords: 20,
      maxWords: 100,
      expectedElements: ['cave', 'moss']
    },
    fn: async () => {
      const response = await mockGen.generate(TEST_PROMPTS.levelIntroduction.cave);
      return response.text.replace(/<description>|<\/description>/g, '').trim();
    }
  }
]);

/**
 * Artifact Description Benchmark Suite
 */
const artifactSuite = createBenchmarkSuite('Artifact Descriptions', [
  {
    name: 'Simple Artifact - Whispering Root',
    context: {
      minWords: 35,
      maxWords: 70,
      expectedElements: ['Whispering Root', 'root']
    },
    fn: async () => {
      mockGen.setMockResponse('Archivist', () => ({
        text: '<title>Whispering Root</title><description>A length of petrified root, veined with brittle crystal, lies half-claimed by the soil. Touch draws a hush from the ground—memory rising like cold breath from a cellar stair.</description>'
      }));
      const response = await mockGen.generate(TEST_PROMPTS.artifact.simple);
      return response.text.replace(/<title>.*?<\/title>|<description>|<\/description>/g, '').trim();
    }
  },
  {
    name: 'Complex Artifact - Echo Tablet',
    context: {
      minWords: 35,
      maxWords: 70,
      expectedElements: ['Echo Tablet', 'tablet']
    },
    fn: async () => {
      mockGen.setMockResponse('Archivist', () => ({
        text: '<title>Echo Tablet</title><description>A flat slab rests against time-smoothed stone; its face refuses dust. The chamber holds its breath, and for a moment the floor seems to remember your footsteps before you make them.</description>'
      }));
      const response = await mockGen.generate(TEST_PROMPTS.artifact.complex);
      return response.text.replace(/<title>.*?<\/title>|<description>|<\/description>/g, '').trim();
    }
  }
]);

/**
 * Main benchmark execution
 */
async function main() {
  console.log('🚀 Starting LLM Generation Benchmarks\n');
  console.log('=' .repeat(60));

  // Run level introduction benchmarks
  await levelIntroSuite.run(runner);

  // Run artifact description benchmarks
  await artifactSuite.run(runner);

  console.log('\n' + '='.repeat(60));

  // Display overall statistics
  runner.getStats();

  // Set baseline if this is the first run
  if (!runner.results.baseline) {
    console.log('\n📌 Setting first run as baseline...');
    runner.setBaseline(0);
  } else {
    // Compare to baseline
    runner.compareToBaseline();
  }

  console.log('\n✅ Benchmark complete!');
  console.log('\n💡 Tips:');
  console.log('   - Run benchmarks regularly to track quality over time');
  console.log('   - Use runner.setBaseline() after improving prompts');
  console.log('   - Check benchmark-results.json for historical data');
  console.log('   - Adjust TEST_PROMPTS in fixtures/goldenOutputs.js to test different scenarios');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { runner, levelIntroSuite, artifactSuite };
