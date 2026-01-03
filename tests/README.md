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
│   └── runBenchmark.js          # Example benchmark execution
├── fixtures/
│   └── goldenOutputs.js         # High-quality reference examples
└── benchmarks/
    └── benchmark-results.json   # Historical benchmark data
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
# Run benchmarks to track quality over time
npm run benchmark
```

## 📊 Quality Metrics

The framework evaluates LLM outputs on several dimensions:

### 1. **Length Requirements**
- **Level Introductions**: 20-100 words (2-3 sentences)
- **Artifact Descriptions**: 20-80 words (1-2 sentences, flexible based on content)

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
  minWords: 20,
  maxWords: 100,
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
  minWords: 20,
  maxWords: 100
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
# Edit prompts in src/systems/levelIntroduction.js or src/entities/storyObject.js

# 3. Run benchmark again
npm run benchmark
# Compares to baseline, shows improvements

# 4. If quality improved significantly
node -e "import('./tests/llm/runBenchmark.js').then(m => m.runner.setBaseline())"
# Sets new baseline
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
    context: { minWords: 20, maxWords: 100 },
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
- Check sanitization functions in `levelIntroduction.js` and `storyObject.js`
- Ensure tags are stripped before displaying to user

**"Text too short/long"**
- Adjust prompt instructions for desired length
- Check token limits in LLM generation

**"Missing context elements"**
- Verify XML payload includes all required context
- Check that prompt instructs model to use all elements

**"Too generic/clichéd"**
- Add more specific constraints to prompt
- Include negative examples in prompt
- Increase temperature slightly for more creativity

## 🎯 Integration with Real LLM

To integrate benchmarks with actual LLM inference:

```javascript
// Replace MockLLMGenerator with real calls
import { generateDescription } from '../src/ollama.js';

const artifactSuite = createBenchmarkSuite('Real Artifacts', [
  {
    name: 'Real Generation Test',
    context: { minWords: 35, maxWords: 70 },
    fn: async () => {
      // Use actual LLM
      const result = await generateDescription(prompt);
      return extractDescription(result);
    }
  }
]);
```

## 📚 Additional Resources

- **Prompts**: `src/systems/levelIntroduction.js` (STATIC_PROMPT)
- **Prompts**: `src/entities/storyObject.js` (STATIC_PROMPT)
- **LLM Bridge**: `src/main/llm/LlamaBridge.js`
- **Content**: `src/content/artifacts.js`, `src/content/monsters.js`

## 🤝 Contributing

When adding new narration types:

1. Create test file in `tests/llm/`
2. Add quality metrics for the new type
3. Create golden examples in `tests/fixtures/`
4. Add benchmark suite
5. Document expected quality standards

## 📄 License

Same as RogueLLMania (MIT)
