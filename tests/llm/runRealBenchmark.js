#!/usr/bin/env node
/**
 * Real LLM Benchmark Runner
 *
 * Runs test cases against the actual Qwen model and measures quality metrics.
 *
 * Usage:
 *   npm run benchmark:real
 *   node tests/llm/runRealBenchmark.js
 *
 * Requirements:
 *   - Model must be downloaded (run the game first to download it)
 *   - node-llama-cpp must be installed
 */

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

import { QualityMetrics, extractDescription, extractTitle } from './testHelpers.js';
import { LEVEL_INTRO_TEST_CASES } from '../cases/levelIntros.js';
import { ARTIFACT_TEST_CASES } from '../cases/artifacts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '../results');

// Ensure results directory exists
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

// Model configuration
const MODEL_PATH = join(os.homedir(), 'Library/Application Support/RogueLLMania/models/qwen2.5/main/qwen2.5-1.5b-instruct-q4_k_m.gguf');
const TEMPERATURE = 0.8;
const MAX_TOKENS = 300;

// Import prompts from production code (as strings since we can't import ES modules easily)
const LEVEL_INTRO_PROMPT = `
You are the Chamber Herald—an AI narrator who writes a **punchy 1–2 sentence** introduction when an adventurer enters a new chamber. Keep it under 50 words. Be vivid, be brief.

### Tone & Aesthetic
Write in a science-fantasy style that feels alien and strange:
• The world is ancient beyond comprehension—technology and biology blur together
• Things have agency: moss grows with intention, stone remembers, water lies
• Threats feel predatory and instinctual, not evil—hunger, not malice
• Avoid generic fantasy: NO "ancient evil", "darkness lurks", "whispers of the past", "echoes of forgotten times", "the air grows cold"
• Instead: strange symbiosis, incomprehensible purpose, things that respond to your presence

### Reasoning checklist
1. Read every incoming XML tag and remember its values.
2. Weave the following ingredients into the prose:
   • <floor> and <chamber_type>—render as sensory or architectural imagery with a sense of strangeness
   • A sense of threat using <monster_count> and <monster_type>—imply predatory presence, not named creatures
   • A hint of discovery using <artifact_title> and, if provided, subtly echo the mood of <artifact_description> without quoting it
3. Write in second person ("You…"), mysterious and evocative, **1–2 sentences max, under 50 words**, no proper nouns except artifact title.
4. If <artifact_title> is "NONE", omit any artifact reference; if <artifact_description> is "NONE", ignore it.

### Creative guidelines
• Paraphrase seed facts—never repeat XML values verbatim
• Reflect <monster_count> as presence/density ("something watches", "many hungers") not raw numbers
• Vary your sentence structures—not every intro should start with "You step into"
• Preserve <artifact_title> exactly if mentioned; echo <artifact_description> mood without copying phrases

Return **only** this structure (no extra commentary):

<output_format>
  <description>…</description>
</output_format>
`;

const ARTIFACT_PROMPT = `
You are the Archivist—an AI scribe who crafts short, vivid blurbs for mysterious artifacts.

### Tone & Aesthetic
Write in a science-fantasy style where objects feel alive and strange:
• Artifacts have presence—they respond, remember, wait, or refuse
• Technology and biology are indistinguishable at this age
• Effects are subtle and uncanny, not flashy magic
• Avoid generic fantasy: NO "ancient power", "mystical energy", "dark secrets", "forgotten magic"
• Instead: strange physics, alien logic, things that recognize you, matter behaving unexpectedly

### Creative guidelines
1. Preserve <title> exactly as given.
2. Paraphrase XML facts—never repeat material, finish, position verbatim.
3. Incorporate <weirdness_hint> naturally—let it color the tone without stating it literally.
4. Truth constraints: never contradict tags; no new entities, combat effects, or measurements.
5. **LENGTH: 20–40 words. Be punchy. One sentence is fine. Two max.**

### Structure patterns (vary these):
• [Object] + [one strange quality]. Done.
• [Sensory hit]—[object]—[what it does].
• [Where it is]. [What's wrong with it].

Return only this structure (no extra text):

<output_format>
  <title>…</title>
  <description>…</description>
</output_format>
`;

/**
 * Initialize the LLM model
 */
async function initModel() {
  console.log('🔧 Initializing model...');

  if (!existsSync(MODEL_PATH)) {
    console.error('❌ Model not found at:', MODEL_PATH);
    console.log('   Run the game first to download the model.');
    process.exit(1);
  }

  const llama = await getLlama();
  const model = await llama.loadModel({
    modelPath: MODEL_PATH,
    gpuLayers: -1,
    gpu: true
  });
  const context = await model.createContext({
    contextSize: 4096,
    batchSize: 512
  });
  const session = new LlamaChatSession({
    contextSequence: context.getSequence()
  });

  console.log('✅ Model loaded successfully');
  return { llama, model, context, session };
}

/**
 * Generate a response from the model
 */
async function generate(session, prompt, xml) {
  const fullPrompt = `${prompt}\n${xml}`;

  const startTime = Date.now();
  const response = await session.prompt(fullPrompt, {
    temperature: TEMPERATURE,
    maxTokens: MAX_TOKENS
  });
  const duration = Date.now() - startTime;

  return { response, duration };
}

/**
 * Run a single test case
 */
async function runTestCase(session, testCase, promptType) {
  const prompt = promptType === 'levelIntro' ? LEVEL_INTRO_PROMPT : ARTIFACT_PROMPT;

  console.log(`  📝 ${testCase.name}...`);

  try {
    const { response, duration } = await generate(session, prompt, testCase.xml);

    // Extract the description
    let text = extractDescription(response);
    if (!text || text === response) {
      // Fallback: try to clean up the response
      text = response.replace(/<[^>]+>/g, '').trim();
    }

    // Evaluate quality
    const quality = QualityMetrics.evaluateOverallQuality(text, testCase.context);

    return {
      name: testCase.name,
      success: true,
      rawResponse: response,
      cleanText: text,
      wordCount: quality.wordCount,
      duration,
      quality
    };
  } catch (error) {
    return {
      name: testCase.name,
      success: false,
      error: error.message
    };
  }
}

/**
 * Run all test cases and collect results
 */
async function runBenchmark() {
  console.log('\n🚀 Starting Real LLM Benchmark\n');
  console.log('='.repeat(60));

  const { session } = await initModel();

  const results = {
    timestamp: new Date().toISOString(),
    config: {
      model: 'qwen2.5-1.5b-instruct-q4_k_m',
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS
    },
    levelIntros: [],
    artifacts: [],
    summary: {}
  };

  // Run level intro tests
  console.log('\n📖 Level Introductions:\n');
  for (const testCase of LEVEL_INTRO_TEST_CASES) {
    const result = await runTestCase(session, testCase, 'levelIntro');
    results.levelIntros.push(result);

    if (result.success) {
      const icon = result.quality.passed ? '✅' : '⚠️';
      console.log(`     ${icon} ${result.wordCount} words, score: ${(result.quality.overallScore * 100).toFixed(0)}%, ${result.duration}ms`);
      console.log(`        "${result.cleanText.substring(0, 80)}..."`);
    } else {
      console.log(`     ❌ Error: ${result.error}`);
    }
  }

  // Run artifact tests
  console.log('\n🔮 Artifacts:\n');
  for (const testCase of ARTIFACT_TEST_CASES) {
    const result = await runTestCase(session, testCase, 'artifact');
    results.artifacts.push(result);

    if (result.success) {
      const icon = result.quality.passed ? '✅' : '⚠️';
      console.log(`     ${icon} ${result.wordCount} words, score: ${(result.quality.overallScore * 100).toFixed(0)}%, ${result.duration}ms`);
      console.log(`        "${result.cleanText.substring(0, 80)}..."`);
    } else {
      console.log(`     ❌ Error: ${result.error}`);
    }
  }

  // Calculate summary statistics
  const allResults = [...results.levelIntros, ...results.artifacts].filter(r => r.success);
  const allTexts = allResults.map(r => r.cleanText);

  const batchEval = QualityMetrics.evaluateBatch(allTexts, { minWords: 15, maxWords: 50 });

  results.summary = {
    totalTests: allResults.length,
    ...batchEval.summary,
    levelIntroAvgWords: results.levelIntros.filter(r => r.success).reduce((sum, r) => sum + r.wordCount, 0) / results.levelIntros.filter(r => r.success).length,
    artifactAvgWords: results.artifacts.filter(r => r.success).reduce((sum, r) => sum + r.wordCount, 0) / results.artifacts.filter(r => r.success).length,
    avgDuration: allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length
  };

  // Display summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');
  console.log(`   Total Tests: ${results.summary.totalTests}`);
  console.log(`   Avg Score: ${(results.summary.avgScore * 100).toFixed(1)}%`);
  console.log(`   Pass Rate: ${(results.summary.passRate * 100).toFixed(1)}%`);
  console.log(`   Variety Score: ${(results.summary.varietyScore * 100).toFixed(1)}%`);
  console.log(`   Avg Word Count: ${results.summary.avgWordCount.toFixed(1)}`);
  console.log(`     Level Intros: ${results.summary.levelIntroAvgWords.toFixed(1)} words`);
  console.log(`     Artifacts: ${results.summary.artifactAvgWords.toFixed(1)} words`);
  console.log(`   Avg Duration: ${results.summary.avgDuration.toFixed(0)}ms`);

  // Save results
  const filename = `real-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = join(RESULTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${filepath}`);

  // Also save as latest for easy access
  const latestPath = join(RESULTS_DIR, 'real-latest.json');
  writeFileSync(latestPath, JSON.stringify(results, null, 2));
  console.log(`   Latest results: ${latestPath}`);

  console.log('\n✅ Benchmark complete!\n');

  return results;
}

// Run if called directly
runBenchmark().catch(error => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});
