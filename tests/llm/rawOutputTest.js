#!/usr/bin/env node
/**
 * Raw LLM Output Test
 *
 * Captures the actual raw output from the model without any processing.
 * Run with: node tests/llm/rawOutputTest.js
 */

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

const MODEL_PATH = join(os.homedir(), 'Library/Application Support/RogueLLMania/models/qwen2.5/main/qwen2.5-1.5b-instruct-q4_k_m.gguf');

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

const TEST_XML = `
<chamber>
  <level>3</level>
  <chamber_type>cave</chamber_type>
  <floor>damp, moss-covered stones that glisten with moisture</floor>
  <monster_count>4</monster_count>
  <monster_type>zombie</monster_type>
  <static_object_count>2</static_object_count>
  <artifact_title>Whispering Root</artifact_title>
  <artifact_description>A gnarled root that hums with strange frequencies</artifact_description>
</chamber>`;

async function runTest() {
  console.log('🔧 Loading model...\n');

  if (!existsSync(MODEL_PATH)) {
    console.error('❌ Model not found at:', MODEL_PATH);
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

  console.log('✅ Model loaded\n');
  console.log('=' .repeat(60));
  console.log('PROMPT:');
  console.log('=' .repeat(60));
  console.log(LEVEL_INTRO_PROMPT + TEST_XML);
  console.log('\n' + '=' .repeat(60));
  console.log('RAW OUTPUT (unprocessed):');
  console.log('=' .repeat(60) + '\n');

  // Test 1: Non-streaming
  console.log('--- Non-streaming response ---\n');
  const response1 = await session.prompt(LEVEL_INTRO_PROMPT + TEST_XML, {
    temperature: 0.8,
    maxTokens: 300
  });
  console.log('```');
  console.log(response1);
  console.log('```\n');

  // Show character codes for first 100 chars to see any hidden formatting
  console.log('First 100 chars as codes:', [...response1.slice(0, 100)].map(c => c.charCodeAt(0)));

  // Test 2: Streaming (to see if tokens come differently)
  console.log('\n--- Streaming response (token by token) ---\n');

  // Create a new session for clean context
  const context2 = await model.createContext({
    contextSize: 4096,
    batchSize: 512
  });
  const session2 = new LlamaChatSession({
    contextSequence: context2.getSequence()
  });

  let streamedFull = '';
  process.stdout.write('```\n');

  await session2.prompt(LEVEL_INTRO_PROMPT + TEST_XML, {
    temperature: 0.8,
    maxTokens: 300,
    onTextChunk: (chunk) => {
      streamedFull += chunk;
      process.stdout.write(chunk);
    }
  });

  console.log('\n```\n');

  console.log('=' .repeat(60));
  console.log('ANALYSIS:');
  console.log('=' .repeat(60));
  console.log(`Contains <description> tag: ${/<description>/i.test(response1)}`);
  console.log(`Contains </description> tag: ${/<\/description>/i.test(response1)}`);
  console.log(`Contains <output_format> tag: ${/<output_format>/i.test(response1)}`);
  console.log(`Contains code fences: ${/```/.test(response1)}`);
  console.log(`Contains <think> tag: ${/<think>/i.test(response1)}`);
  console.log(`Starts with whitespace: ${/^\s/.test(response1)}`);
  console.log(`Total length: ${response1.length} chars`);

  console.log('\n✅ Test complete!\n');
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
