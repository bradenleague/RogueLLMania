# LLM Testing Quick Reference

## 🚀 Quick Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm test:watch

# Run with coverage report
npm test:coverage

# Run benchmarks
npm run benchmark

# View test results with UI
npm run test:ui
```

## 📊 Quality Metrics

| Metric | Level Intros | Artifacts | Weight |
|--------|-------------|-----------|--------|
| Length | 20-100 words | 20-80 words | High |
| Clean Output | No XML/tags | No XML/tags | Critical |
| Atmospheric | 2+ evocative words | 2+ evocative words | Medium |
| Context | Tile, monsters | Material, location | High |
| No Clichés | Pass | Pass | Low |

**Overall Passing Score**: ≥ 0.7 (70%)

## 🎯 Testing Workflow

### When Changing Prompts

1. **Before**: Backup current prompt
2. **Test**: Run `npm run benchmark` 
3. **Modify**: Edit prompt in source file
4. **Verify**: Run `npm test`
5. **Benchmark**: Run `npm run benchmark` again
6. **Compare**: Check if score improved
7. **Baseline**: If better, set new baseline

### Setting Baseline

```javascript
node -e "import('./tests/llm/runBenchmark.js').then(m => m.runner.setBaseline())"
```

### Viewing Results

```bash
# View historical benchmark data
cat tests/benchmarks/benchmark-results.json

# Or open in editor
code tests/benchmarks/benchmark-results.json
```

## 📝 Common Test Scenarios

### Test a Single File

```bash
npm test tests/llm/levelIntroduction.test.js
```

### Test with Specific Pattern

```bash
npm test -- -t "Golden"
```

### Run Only Changed Tests

```bash
npm test:watch
# Then press 'o' to run only changed tests
```

## 🔍 Debugging Tests

### Check Test Output

Tests show detailed information on failure:
- Which metric failed
- Expected vs actual values
- Context that was tested

### View Quality Breakdown

```javascript
import { QualityMetrics } from './tests/llm/testHelpers.js';

const text = "Your generated text here";
const result = QualityMetrics.evaluateOverallQuality(text, {
  minWords: 20,
  maxWords: 100
});

console.log(result);
// Shows: metrics (each pass/fail), overallScore, passed
```

## 📦 Test Structure

```
tests/
├── llm/
│   ├── testHelpers.js           # QualityMetrics, MockGenerator, etc.
│   ├── levelIntroduction.test.js # 18 tests for level intros
│   ├── artifactDescription.test.js # 18 tests for artifacts
│   ├── benchmark.js              # BenchmarkRunner class
│   └── runBenchmark.js           # Example benchmark suite
├── fixtures/
│   └── goldenOutputs.js          # Reference examples & test data
└── benchmarks/
    └── benchmark-results.json    # Historical results (auto-generated)
```

## 🎨 Quality Metrics API

```javascript
import { QualityMetrics } from './tests/llm/testHelpers.js';

// Check length
QualityMetrics.meetsLengthRequirement(text, minWords, maxWords);

// Check for context elements
QualityMetrics.containsContext(text, ['element1', 'element2']);

// Check for clean output (no tags)
QualityMetrics.hasCleanOutput(text);

// Check atmospheric language
QualityMetrics.hasAtmosphericLanguage(text);

// Check for clichés
QualityMetrics.avoidsClichés(text);

// Run all checks
QualityMetrics.evaluateOverallQuality(text, context);
```

## 🧪 Mock Testing

```javascript
import { MockLLMGenerator } from './tests/llm/testHelpers.js';

const mock = new MockLLMGenerator();

// Set custom response
mock.setMockResponse('pattern', { text: '<description>...</description>' });

// Generate
const result = await mock.generate('Your prompt here');

// Check calls
console.log(mock.callCount); // Number of times called
```

## 📈 Benchmark Interpretation

### Quality Scores

- **0.9-1.0**: Excellent ✅ (ship it!)
- **0.7-0.9**: Good ✅ (minor tweaks)
- **0.5-0.7**: Acceptable ⚠️ (needs work)
- **< 0.5**: Poor ❌ (major issues)

### Duration Targets

- **< 500ms**: Excellent (real-time feel)
- **500-1000ms**: Good (acceptable)
- **1000-2000ms**: Slow (consider optimization)
- **> 2000ms**: Too slow (user frustration)

## 🛠️ Adding New Tests

### 1. Add Golden Example

Edit `tests/fixtures/goldenOutputs.js`:

```javascript
export const GOLDEN_LEVEL_INTRODUCTIONS = [
  // Add your example
  {
    context: { /* context object */ },
    examples: ["Your golden text here"]
  }
];
```

### 2. Create Test

```javascript
it('should test your new feature', () => {
  const result = QualityMetrics.someNewMetric(text);
  expect(result.valid).toBe(true);
});
```

### 3. Add to Benchmark

Edit `tests/llm/runBenchmark.js`:

```javascript
{
  name: 'Your Test',
  context: { /* your context */ },
  fn: async () => {
    // Your generation logic
    return generatedText;
  }
}
```

## 🔗 Related Files

- **Prompts**: `src/systems/levelIntroduction.js`, `src/entities/storyObject.js`
- **LLM Bridge**: `src/main/llm/LlamaBridge.js`
- **Sanitization**: `src/systems/levelIntroduction.js` (sanitizeIntro)
- **Streaming**: `src/ollama.js` (streamDescription)

## 💡 Tips

1. **Run tests before AND after** changes
2. **Benchmark regularly** to catch regressions
3. **Set baselines** after confirmed improvements
4. **Use watch mode** during development
5. **Check coverage** to find untested code
6. **Read test failures carefully** - they tell you exactly what's wrong
7. **Start simple** - fix one metric at a time

## 📚 Documentation

- **Full Guide**: `tests/README.md`
- **Prompt Tips**: `docs/PROMPT_IMPROVEMENT_GUIDE.md`
- **Vitest Docs**: https://vitest.dev/

---

**Remember**: Tests are your safety net. They catch problems before players do! 🎮
