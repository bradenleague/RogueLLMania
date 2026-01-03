#!/usr/bin/env node
/**
 * Test JSON Schema Grammar Integration
 *
 * Tests that the model outputs valid JSON when constrained by a grammar.
 * Run with: node tests/llm/jsonSchemaTest.js
 */

import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

const MODEL_PATH = join(os.homedir(), 'Library/Application Support/RogueLLMania/models/qwen2.5/main/qwen2.5-1.5b-instruct-q4_k_m.gguf');

// Test schemas
const LEVEL_INTRO_SCHEMA = {
    type: 'object',
    properties: {
        description: { type: 'string' }
    },
    required: ['description']
};

const ARTIFACT_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        description: { type: 'string' }
    },
    required: ['title', 'description']
};

async function runTests() {
    console.log('🔧 Loading model...\n');

    if (!existsSync(MODEL_PATH)) {
        console.error('❌ Model not found at:', MODEL_PATH);
        process.exit(1);
    }

    const llama = await getLlama();
    const model = await llama.loadModel({ modelPath: MODEL_PATH, gpuLayers: -1 });

    // Test 1: Level intro with JSON schema grammar
    console.log('='.repeat(60));
    console.log('TEST 1: Level Intro with JSON Schema Grammar');
    console.log('='.repeat(60));

    const ctx1 = await model.createContext({ contextSize: 2048 });
    const session1 = new LlamaChatSession({ contextSequence: ctx1.getSequence() });
    const grammar1 = await llama.createGrammarForJsonSchema(LEVEL_INTRO_SCHEMA);

    const prompt1 = `Write a one-sentence, evocative description of a dark cave with moss-covered stones.
Be vivid and atmospheric. Respond with JSON: {"description": "your text"}`;

    console.log('\nPrompt:', prompt1);
    console.log('\nResponse:');

    const response1 = await session1.prompt(prompt1, {
        grammar: grammar1,
        temperature: 0.7,
        maxTokens: 150
    });

    console.log('```');
    console.log(response1);
    console.log('```\n');

    try {
        const parsed1 = grammar1.parse(response1);
        console.log('✅ Valid JSON!');
        console.log('Parsed:', parsed1);
        console.log('Description length:', parsed1.description?.length, 'chars');
    } catch (e) {
        console.log('❌ Parse failed:', e.message);
    }

    // Test 2: Artifact with JSON schema grammar
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Artifact with JSON Schema Grammar');
    console.log('='.repeat(60));

    const ctx2 = await model.createContext({ contextSize: 2048 });
    const session2 = new LlamaChatSession({ contextSequence: ctx2.getSequence() });
    const grammar2 = await llama.createGrammarForJsonSchema(ARTIFACT_SCHEMA);

    const prompt2 = `Create a mysterious artifact called "Void Shard" made of rough crystal.
It should feel strange and alien. Respond with JSON: {"title": "...", "description": "..."}`;

    console.log('\nPrompt:', prompt2);
    console.log('\nResponse:');

    const response2 = await session2.prompt(prompt2, {
        grammar: grammar2,
        temperature: 0.7,
        maxTokens: 150
    });

    console.log('```');
    console.log(response2);
    console.log('```\n');

    try {
        const parsed2 = grammar2.parse(response2);
        console.log('✅ Valid JSON!');
        console.log('Parsed:', parsed2);
    } catch (e) {
        console.log('❌ Parse failed:', e.message);
    }

    // Test 3: Streaming with grammar
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Streaming with JSON Grammar');
    console.log('='.repeat(60));

    const ctx3 = await model.createContext({ contextSize: 2048 });
    const session3 = new LlamaChatSession({ contextSequence: ctx3.getSequence() });
    const grammar3 = await llama.createGrammarForJsonSchema(LEVEL_INTRO_SCHEMA);

    const prompt3 = `Write a brief, eerie description of entering a flooded chamber.
Respond with JSON: {"description": "..."}`;

    console.log('\nPrompt:', prompt3);
    console.log('\nStreaming response:');
    process.stdout.write('```\n');

    let streamedText = '';
    await session3.prompt(prompt3, {
        grammar: grammar3,
        temperature: 0.7,
        maxTokens: 150,
        onTextChunk: (chunk) => {
            streamedText += chunk;
            process.stdout.write(chunk);
        }
    });

    console.log('\n```\n');

    try {
        const parsed3 = JSON.parse(streamedText);
        console.log('✅ Streamed valid JSON!');
        console.log('Parsed:', parsed3);
    } catch (e) {
        console.log('❌ Parse failed:', e.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests complete!');
    console.log('='.repeat(60));
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
