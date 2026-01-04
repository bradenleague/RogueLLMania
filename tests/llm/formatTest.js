#!/usr/bin/env node
/**
 * Test if the model can follow XML output format instructions
 */

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

const MODEL_PATH = join(os.homedir(), 'Library/Application Support/RogueLLMania/models/qwen3/main/Qwen3-1.7B-Q4_K_M.gguf');

async function runTests() {
  console.log('🔧 Loading model...\n');

  if (!existsSync(MODEL_PATH)) {
    console.error('❌ Model not found');
    process.exit(1);
  }

  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath: MODEL_PATH, gpuLayers: -1 });

  // Test 1: Simple XML request
  console.log('='.repeat(60));
  console.log('TEST 1: Simple XML format request');
  console.log('='.repeat(60));

  const ctx1 = await model.createContext({ contextSize: 2048 });
  const session1 = new LlamaChatSession({ contextSequence: ctx1.getSequence() });

  const response1 = await session1.prompt(
    `Write a one-sentence description of a dark cave. Output your response in this exact XML format:
<description>your text here</description>`,
    { temperature: 0.7, maxTokens: 100 }
  );
  console.log('\nResponse:\n```\n' + response1 + '\n```\n');
  console.log('Contains <description>:', /<description>/i.test(response1));

  // Test 2: System message approach
  console.log('='.repeat(60));
  console.log('TEST 2: With system message');
  console.log('='.repeat(60));

  const ctx2 = await model.createContext({ contextSize: 2048 });
  const session2 = new LlamaChatSession({
    contextSequence: ctx2.getSequence(),
    systemPrompt: 'You always respond in XML format using <description> tags.'
  });

  const response2 = await session2.prompt(
    'Write a one-sentence description of a dark cave.',
    { temperature: 0.7, maxTokens: 100 }
  );
  console.log('\nResponse:\n```\n' + response2 + '\n```\n');
  console.log('Contains <description>:', /<description>/i.test(response2));

  // Test 3: Just ask for plain prose (no XML)
  console.log('='.repeat(60));
  console.log('TEST 3: Plain prose (no XML request)');
  console.log('='.repeat(60));

  const ctx3 = await model.createContext({ contextSize: 2048 });
  const session3 = new LlamaChatSession({ contextSequence: ctx3.getSequence() });

  const response3 = await session3.prompt(
    'Write a one-sentence, evocative description of a dark cave with moss-covered stones. Be brief and vivid.',
    { temperature: 0.7, maxTokens: 100 }
  );
  console.log('\nResponse:\n```\n' + response3 + '\n```\n');

  // Test 4: JSON format (some models handle this better)
  console.log('='.repeat(60));
  console.log('TEST 4: JSON format request');
  console.log('='.repeat(60));

  const ctx4 = await model.createContext({ contextSize: 2048 });
  const session4 = new LlamaChatSession({ contextSequence: ctx4.getSequence() });

  const response4 = await session4.prompt(
    `Write a one-sentence description of a dark cave. Respond with ONLY valid JSON in this format: {"description": "your text"}`,
    { temperature: 0.7, maxTokens: 100 }
  );
  console.log('\nResponse:\n```\n' + response4 + '\n```\n');
  console.log('Valid JSON:', (() => { try { JSON.parse(response4); return true; } catch { return false; } })());

  console.log('\n✅ Tests complete!\n');
}

runTests().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
