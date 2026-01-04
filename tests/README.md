# LLM Testing and Benchmarking Framework

This framework provides comprehensive testing and quality tracking for RogueLLMania's LLM-generated narration (level introductions and artifact descriptions).

## 🎯 Goals

1. **Test Model Generations** - Validate that LLM outputs meet quality standards
2. **Improve Over Time** - Track quality metrics and identify regressions
3. **Ensure Cool Unique Lore** - Maintain atmospheric, evocative narration

## 📁 Structure

```
tests/
├── llm/
│   ├── testHelpers.js           # Quality metrics and test utilities
│   ├── benchmark.js             # Benchmark runner and tracking
│   ├── levelIntroduction.test.js # Level intro quality tests
│   ├── artifactDescription.test.js # Artifact description tests
│   └── runRealBenchmark.js      # Real LLM benchmark runner (production code)
├── cases/
│   ├── levelIntros.js           # Level introduction test cases
│   └── artifacts.js             # Artifact description test cases
├── fixtures/
│   └── goldenOutputs.js         # High-quality reference examples
├── benchmarks/
│   └── benchmark-results.json   # Historical benchmark data (gitignored)
└── results/                     # Real benchmark results (gitignored)
    └── real-*.json
```

## 🚀 Quick Start

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/llm/levelIntroduction.test.js

# Run with coverage
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch
```

### Running Benchmarks

```bash
# Run benchmarks against actual LLM model (requires model download)
npm run benchmark
```

## 📊 Quality Metrics

The framework evaluates LLM outputs on several dimensions:

### 1. **Length Requirements**
- **Level Introductions**: Target 30-40 words (assembled from 3 slots: room 8-14w, threat 6-12w, oddity 8-14w)
- **Artifact Descriptions**: Target 20-36 words (assembled from 2 slots: placement + effect)
- Test cases use ranges: 15-50 words for level intros, 20-75 words for artifacts (to catch outliers)

### 2. **Clean Output**
- No XML/HTML tags in final text
- No markdown code fences
- No `<think>` blocks or format indicators
- Proper sanitization

### 3. **Atmospheric Language**
- Uses evocative words (shadow, echo, ancient, mysterious, etc.)
- Creates mood and atmosphere
- Second-person perspective for level intros

### 4. **Context Integration**
- References tile/floor type
- Mentions monster presence appropriately
- Integrates artifact context when present
- Reflects environmental surroundings

### 5. **Avoids Clichés**
- No "in the heart of", "it should be noted", etc.
- Fresh, unique descriptions
- Paraphrases rather than lists

## 📝 Example Usage

### Testing Level Introductions

```javascript
import { QualityMetrics } from './tests/llm/testHelpers.js';

const intro = "You step into a verdant chamber where soft grass somehow thrives...";

// Evaluate quality
const quality = QualityMetrics.evaluateOverallQuality(intro, {
  minWords: 15,
  maxWords: 50,
  expectedElements: ['grass', 'chamber']
});

console.log(`Quality Score: ${quality.overallScore}`);
console.log(`Passed: ${quality.passed}`);
```

### Running Benchmarks

```javascript
import { BenchmarkRunner } from './tests/llm/benchmark.js';

const runner = new BenchmarkRunner();

// Run a benchmark
await runner.runBenchmark('Level 1 Intro', async () => {
  // Your LLM generation code here
  return await generateLevelIntroduction(...);
}, {
  minWords: 15,
  maxWords: 50
});

// Set as baseline
runner.setBaseline();

// Later, compare improvements
runner.compareToBaseline();
```

## 🎨 Golden Outputs

The framework includes "golden outputs" - high-quality reference examples that serve as benchmarks. These are real examples of excellent narration that meet all quality criteria.

### Level Introduction Examples

```javascript
"You step into a verdant chamber where soft grass somehow thrives beneath 
ancient stone. The air shifts with shambling presences, and decay mingles 
with the earthy scent of growth."
```

### Artifact Description Examples

```javascript
"A length of petrified root, veined with brittle crystal, lies half-claimed 
by the soil. Touch draws a hush from the ground—memory rising like cold 
breath from a cellar stair."
```

## 🔬 Benchmark System

The benchmark system tracks quality over time and helps identify improvements or regressions.

### Features

1. **Historical Tracking** - All runs stored in `benchmark-results.json`
2. **Baseline Comparison** - Compare current quality to established baseline
3. **Statistics** - Overall metrics across all runs
4. **Performance Metrics** - Track generation speed

### Workflow

```bash
# 1. Initial benchmark run
npm run benchmark
# Sets first run as baseline

# 2. Make prompt improvements
# Edit prompts in src/main/llm/ConfigManager.js (getSystemPrompts method)

# 3. Run benchmark again
npm run benchmark
# Compares to baseline, shows improvements

# 4. If quality improved significantly
# Edit runRealBenchmark.js to set a new baseline, or use the benchmark.js API directly
```

## 🛠️ Customization

### Adding New Test Cases

Edit `tests/fixtures/goldenOutputs.js`:

```javascript
export const GOLDEN_LEVEL_INTRODUCTIONS = [
  // Add your new golden example
  {
    context: {
      levelNumber: 5,
      levelType: 'pillaredHall',
      dominantTile: 'cobblestone',
      monsterCount: 7,
      monsterTypes: { chaser: 7 }
    },
    examples: [
      "Your new golden example here..."
    ]
  }
];
```

### Creating Custom Benchmarks

```javascript
import { createBenchmarkSuite } from './tests/llm/benchmark.js';

const customSuite = createBenchmarkSuite('My Custom Tests', [
  {
    name: 'Test Name',
    context: { minWords: 15, maxWords: 50 },
    fn: async () => {
      // Your test logic
      return generatedText;
    }
  }
]);

await customSuite.run(runner);
```

## 📈 Tracking Improvements

### Best Practices

1. **Baseline Early** - Set a baseline after your first benchmark run
2. **Run Regularly** - Benchmark after any prompt changes
3. **Document Changes** - Note what you changed when quality improves
4. **Track Patterns** - Look for patterns in what works/doesn't work
5. **Iterate** - Use failed tests to guide prompt improvements

### Quality Score Interpretation

- **0.9-1.0** - Excellent quality, meets all criteria
- **0.7-0.9** - Good quality, minor issues
- **0.5-0.7** - Acceptable, room for improvement
- **< 0.5** - Needs work, fails key criteria

## 🔍 Debugging

### Common Issues

**"Output contains XML tags"**
- Check assembly functions in `src/main/llm/schemas.js` (`assembleLevelIntro`, `assembleArtifact`)
- Ensure tags are stripped before displaying to user
- Note: System now uses JSON schema output, not XML

**"Text too short/long"**
- Adjust prompt instructions for desired length
- Check token limits in LLM generation

**"Missing context elements"**
- Verify context payload includes all required elements (JSON schema input)
- Check that prompt instructs model to use all elements
- For level intros: ensure room, threat, and oddity slots are populated
- For artifacts: ensure placement and effect slots are populated

**"Too generic/clichéd"**
- Add more specific constraints to prompt
- Include negative examples in prompt
- Increase temperature slightly for more creativity

## 🎯 Integration with Real LLM

To integrate benchmarks with actual LLM inference:

```javascript
// Use generateJson with JSON schemas (recommended)
import { generateJson, JsonSchemas, assembleArtifact } from '../src/llm.js';

const artifactSuite = createBenchmarkSuite('Real Artifacts', [
  {
    name: 'Real Generation Test',
    context: { minWords: 20, maxWords: 36 },
    fn: async () => {
      // Use actual LLM with JSON schema
      const slots = await generateJson(prompt, JsonSchemas.artifact, { mode: 'artifact' });
      return assembleArtifact(slots);
    }
  }
]);
```

**Note**: `generateDescription()` exists but is deprecated. Use `generateJson()` with `JsonSchemas` for structured output.

## 📚 Additional Resources

- **Prompts**: `src/main/llm/ConfigManager.js` (`getSystemPrompts()` method)
  - System prompts moved here for session-level efficiency (reduces token overhead)
  - Level intro prompt: `ConfigManager.getSystemPrompts().levelIntro`
  - Artifact prompt: `ConfigManager.getSystemPrompts().artifact`
- **Schemas & Assembly**: `src/main/llm/schemas.js`
  - `JsonSchemas.levelIntro` - JSON schema for level introductions
  - `JsonSchemas.artifact` - JSON schema for artifacts
  - `assembleLevelIntro(slots)` - Assembles room/threat/oddity slots
  - `assembleArtifact(slots)` - Assembles placement/effect slots
- **LLM Bridge**: `src/main/llm/LlamaBridge.js`
- **Content**: `src/content/artifacts.js`, `src/content/monsters.js`
- **Generation Functions**: `src/systems/levelIntroduction.js`, `src/entities/storyObject.js`

## 🤝 Contributing

When adding new narration types:

1. Create test file in `tests/llm/`
2. Add quality metrics for the new type
3. Create golden examples in `tests/fixtures/`
4. Add benchmark suite
5. Document expected quality standards

## 📄 License

Same as RogueLLMania (MIT)
