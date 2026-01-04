#!/usr/bin/env node
/**
 * Real LLM Benchmark Runner
 *
 * Runs test cases against the actual Qwen model using PRODUCTION prompts and schemas.
 * This ensures benchmarks reflect real in-game behavior.
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

import { QualityMetrics } from './testHelpers.js';
import { LEVEL_INTRO_TEST_CASES } from '../cases/levelIntros.js';
import { ARTIFACT_TEST_CASES } from '../cases/artifacts.js';

// Import PRODUCTION code - same prompts/schemas used in-game
import { ConfigManager } from '../../src/main/llm/ConfigManager.js';
import { JsonSchemas, assembleLevelIntro, assembleArtifact } from '../../src/main/llm/schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, '../results');

// Ensure results directory exists
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

// Model configuration
const MODEL_PATH = join(os.homedir(), 'Library/Application Support/RogueLLMania/models/qwen3/main/Qwen3-1.7B-Q4_K_M.gguf');
const MAX_TOKENS = 300;

// Get production config
const config = new ConfigManager({ appDataPath: join(os.homedir(), 'Library/Application Support/RogueLLMania') });
const SYSTEM_PROMPTS = config.getSystemPrompts();
const TEMPERATURES = config.get('llm.temperature');

/**
 * Initialize the LLM model with a specific system prompt
 */
async function initModel(systemPrompt) {
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

  // Store context sequence for reuse (matches production LlamaManager pattern)
  const contextSequence = context.getSequence();

  const session = new LlamaChatSession({
    contextSequence: contextSequence,
    systemPrompt
  });

  console.log('✅ Model loaded successfully');
  return { llama, model, context, session, contextSequence };
}

/**
 * Generate JSON response with grammar enforcement
 */
async function generateWithGrammar(llama, session, prompt, schema, temperature) {
  const grammar = await llama.createGrammarForJsonSchema(schema);

  const startTime = Date.now();
  const response = await session.prompt(prompt, {
    temperature,
    maxTokens: MAX_TOKENS,
    grammar
  });
  const duration = Date.now() - startTime;

  // Parse the JSON response
  let parsed;
  try {
    parsed = grammar.parse(response);
  } catch (e) {
    console.warn('    ⚠️  JSON parse failed, trying manual parse');
    try {
      parsed = JSON.parse(response);
    } catch (e2) {
      parsed = null;
    }
  }

  return { response, parsed, duration };
}

/**
 * Run a level intro test case
 */
async function runLevelIntroTestCase(llama, session, testCase, temperature) {
  console.log(`  📝 ${testCase.name}...`);

  try {
    // Build context similar to production (simplified)
    const prompt = `Context: ${testCase.xml}`;

    const { response, parsed, duration } = await generateWithGrammar(
      llama, session, prompt, JsonSchemas.levelIntro, temperature
    );

    if (!parsed || !parsed.room || !parsed.threat || !parsed.oddity) {
      return {
        name: testCase.name,
        success: false,
        error: 'Failed to parse slots',
        rawResponse: response
      };
    }

    // Use production assembly function
    const text = assembleLevelIntro(parsed);

    // Evaluate quality
    const quality = QualityMetrics.evaluateOverallQuality(text, testCase.context);

    return {
      name: testCase.name,
      success: true,
      rawResponse: response,
      slots: parsed,
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
 * Run an artifact test case
 */
async function runArtifactTestCase(llama, session, testCase, temperature) {
  console.log(`  📝 ${testCase.name}...`);

  try {
    // Build context similar to production
    const prompt = testCase.xml;

    const { response, parsed, duration } = await generateWithGrammar(
      llama, session, prompt, JsonSchemas.artifact, temperature
    );

    if (!parsed || !parsed.placement || !parsed.effect) {
      return {
        name: testCase.name,
        success: false,
        error: 'Failed to parse slots',
        rawResponse: response
      };
    }

    // Use production assembly function
    const text = assembleArtifact(parsed);

    // Evaluate quality
    const quality = QualityMetrics.evaluateOverallQuality(text, testCase.context);

    return {
      name: testCase.name,
      success: true,
      rawResponse: response,
      slots: parsed,
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
  console.log('\n🚀 Starting Real LLM Benchmark (Production Code)\n');
  console.log('='.repeat(60));
  console.log('Using PRODUCTION prompts and schemas from ConfigManager');
  console.log('Temperatures:', JSON.stringify(TEMPERATURES));
  console.log('='.repeat(60));

  const results = {
    timestamp: new Date().toISOString(),
    config: {
      model: 'Qwen3-1.7B-Q4_K_M',
      temperatures: TEMPERATURES,
      maxTokens: MAX_TOKENS
    },
    levelIntros: [],
    artifacts: [],
    summary: {}
  };

  // Initialize model and get shared context sequence
  const { llama, model, context, session: levelSession, contextSequence } = await initModel(SYSTEM_PROMPTS.levelIntro);

  // Run level intro tests with level intro system prompt
  console.log('\n📖 Level Introductions:\n');
  console.log(`   System prompt: ${SYSTEM_PROMPTS.levelIntro.substring(0, 50)}...`);
  console.log(`   Temperature: ${TEMPERATURES.levelIntro}`);
  console.log('');

  for (const testCase of LEVEL_INTRO_TEST_CASES) {
    const result = await runLevelIntroTestCase(llama, levelSession, testCase, TEMPERATURES.levelIntro);
    results.levelIntros.push(result);

    if (result.success) {
      const icon = result.quality.passed ? '✅' : '⚠️';
      console.log(`     ${icon} ${result.wordCount} words, score: ${(result.quality.overallScore * 100).toFixed(0)}%, ${result.duration}ms`);
      console.log(`        "${result.cleanText.substring(0, 80)}..."`);
      if (result.slots) {
        console.log(`        Slots: room=${result.slots.room?.split(' ').length}w, threat=${result.slots.threat?.split(' ').length}w, oddity=${result.slots.oddity?.split(' ').length}w`);
      }
    } else {
      console.log(`     ❌ Error: ${result.error}`);
    }
  }

  // Run artifact tests with artifact system prompt
  console.log('\n🏺 Artifacts:\n');
  console.log(`   System prompt: ${SYSTEM_PROMPTS.artifact.substring(0, 50)}...`);
  console.log(`   Temperature: ${TEMPERATURES.artifact}`);
  console.log('');

  // Recreate session with same sequence, new system prompt (matches production LlamaManager.setMode())
  const artifactSession = new LlamaChatSession({
    contextSequence: contextSequence,
    systemPrompt: SYSTEM_PROMPTS.artifact
  });

  for (const testCase of ARTIFACT_TEST_CASES) {
    const result = await runArtifactTestCase(llama, artifactSession, testCase, TEMPERATURES.artifact);
    results.artifacts.push(result);

    if (result.success) {
      const icon = result.quality.passed ? '✅' : '⚠️';
      console.log(`     ${icon} ${result.wordCount} words, score: ${(result.quality.overallScore * 100).toFixed(0)}%, ${result.duration}ms`);
      console.log(`        "${result.cleanText.substring(0, 80)}..."`);
      if (result.slots) {
        console.log(`        Slots: placement=${result.slots.placement?.split(' ').length}w, effect=${result.slots.effect?.split(' ').length}w`);
      }
    } else {
      console.log(`     ❌ Error: ${result.error}`);
    }
  }

  // Calculate summary
  const allResults = [...results.levelIntros, ...results.artifacts];
  const successfulResults = allResults.filter(r => r.success);
  const allTexts = successfulResults.map(r => r.cleanText);

  results.summary = {
    totalTests: allResults.length,
    successfulTests: successfulResults.length,
    avgScore: successfulResults.reduce((sum, r) => sum + r.quality.overallScore, 0) / successfulResults.length || 0,
    avgWordCount: successfulResults.reduce((sum, r) => sum + r.wordCount, 0) / successfulResults.length || 0,
    passRate: successfulResults.filter(r => r.quality.passed).length / successfulResults.length || 0,
    varietyScore: allTexts.length >= 2 ? QualityMetrics.measureVariety(allTexts).score : 1.0,
    levelIntroAvgWords: results.levelIntros.filter(r => r.success).reduce((sum, r) => sum + r.wordCount, 0) / results.levelIntros.filter(r => r.success).length || 0,
    artifactAvgWords: results.artifacts.filter(r => r.success).reduce((sum, r) => sum + r.wordCount, 0) / results.artifacts.filter(r => r.success).length || 0,
    avgDuration: successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length || 0
  };

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary (Using Production Code):\n');
  console.log(`   Total Tests:        ${results.summary.totalTests}`);
  console.log(`   Successful:         ${results.summary.successfulTests}`);
  console.log(`   Average Score:      ${(results.summary.avgScore * 100).toFixed(1)}%`);
  console.log(`   Pass Rate:          ${(results.summary.passRate * 100).toFixed(1)}%`);
  console.log(`   Variety Score:      ${results.summary.varietyScore.toFixed(3)} (target: ≥0.6)`);
  console.log(`   Avg Word Count:     ${results.summary.avgWordCount.toFixed(1)}`);
  console.log(`   Level Intro Avg:    ${results.summary.levelIntroAvgWords.toFixed(1)} words (target: 30-40)`);
  console.log(`   Artifact Avg:       ${results.summary.artifactAvgWords.toFixed(1)} words (target: 20-36)`);
  console.log(`   Avg Duration:       ${results.summary.avgDuration.toFixed(0)}ms`);
  console.log('='.repeat(60));

  // Save results
  const filename = `real-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = join(RESULTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${filepath}\n`);

  return results;
}

// Run the benchmark
runBenchmark().catch(console.error);
