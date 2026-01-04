/**
 * LLM generation utilities for node-llama-cpp backend
 *
 * Supports JSON schema grammars for structured output.
 * When a jsonSchema is provided, the model output is constrained to valid JSON.
 */

import { appendLevelIntroductionText } from './ui/overlays/levelIntro.js';

const { ipcRenderer } = window.require('electron');

// Re-export schemas from shared location (used by both game and benchmarks)
export { JsonSchemas, assembleLevelIntro, assembleArtifact } from './main/llm/schemas.js';

/**
 * Generate structured JSON using the LLM with schema enforcement
 * @param {string} prompt - The prompt for the LLM
 * @param {object} jsonSchema - JSON schema to enforce
 * @param {object} options - Optional: { mode, seed }
 * @returns {Promise<object>} Parsed JSON object
 */
export async function generateJson(prompt, jsonSchema, options = {}) {
    const result = await ipcRenderer.invoke('llm-generate', {
        prompt,
        jsonSchema,
        mode: options.mode,
        seed: options.seed
    });

    if (!result.success) {
        const err = new Error(getErrorMessage(result));
        if (result.errorType) err.code = result.errorType;
        console.error('LLM generation failed:', result);
        throw err;
    }

    // Return parsed JSON if available, otherwise try to parse the text
    if (result.parsed) {
        return result.parsed;
    }

    try {
        return JSON.parse(result.text);
    } catch (parseErr) {
        console.warn('JSON parse failed, returning raw text:', parseErr.message);
        return { description: result.text }; // Fallback wrapper
    }
}

/**
 * Generate a description using the LLM (non-streaming, plain text)
 * @deprecated Use generateJson with JsonSchemas.levelIntro for structured output
 */
export async function generateDescription(prompt) {
    const result = await ipcRenderer.invoke('llm-generate', {
        prompt
    });

    if (!result.success) {
        const err = new Error(getErrorMessage(result));
        if (result.errorType) err.code = result.errorType;
        console.error('LLM generation failed:', result);
        throw err;
    }

    return result.text || 'No description generated.';
}

/**
 * Stream JSON from the LLM, updating the UI as tokens arrive
 * @param {string} prompt - The prompt for the LLM
 * @param {object} options - { jsonSchema, onToken }
 * @returns {Promise<object>} Parsed JSON object
 */
export async function streamJson(prompt, { jsonSchema, onToken } = {}) {
    return new Promise((resolve, reject) => {
        let full = '';

        const handler = (event, data) => {
            const piece = data?.content || '';
            if (piece) {
                full += piece;
                // Stream raw tokens to UI (will be JSON fragments)
                try { appendLevelIntroductionText(piece); } catch {}
                if (onToken) onToken(piece);
            }
        };

        const endHandler = () => {
            cleanup();
            // Parse the complete JSON
            try {
                const parsed = JSON.parse(full);
                resolve(parsed);
            } catch (parseErr) {
                console.warn('JSON parse failed after stream:', parseErr.message);
                resolve({ description: full }); // Fallback
            }
        };

        const errorHandler = (event, payload) => {
            cleanup();
            const err = new Error(payload?.error || 'Stream error');
            if (payload?.errorType) err.code = payload.errorType;
            reject(err);
        };

        function cleanup() {
            ipcRenderer.removeListener('llm-generate-stream-data', handler);
            ipcRenderer.removeListener('llm-generate-stream-end', endHandler);
            ipcRenderer.removeListener('llm-generate-stream-error', errorHandler);
        }

        ipcRenderer.on('llm-generate-stream-data', handler);
        ipcRenderer.on('llm-generate-stream-end', endHandler);
        ipcRenderer.on('llm-generate-stream-error', errorHandler);
        ipcRenderer.send('llm-generate-stream', { prompt, jsonSchema });
    });
}

/**
 * Stream a description from the LLM, updating the UI as tokens arrive
 * @deprecated Use streamJson with JsonSchemas.levelIntro for structured output
 */
export async function streamDescription(prompt, { onToken } = {}) {
    return new Promise((resolve, reject) => {
        let full = '';

        const handler = (event, data) => {
            const piece = data?.content || '';
            if (piece) {
                full += piece;
                try { appendLevelIntroductionText(piece); } catch {}
                if (onToken) onToken(piece);
            }
        };

        const endHandler = () => {
            cleanup();
            resolve(full);
        };

        const errorHandler = (event, payload) => {
            cleanup();
            const err = new Error(payload?.error || 'Stream error');
            if (payload?.errorType) err.code = payload.errorType;
            reject(err);
        };

        function cleanup() {
            ipcRenderer.removeListener('llm-generate-stream-data', handler);
            ipcRenderer.removeListener('llm-generate-stream-end', endHandler);
            ipcRenderer.removeListener('llm-generate-stream-error', errorHandler);
        }

        ipcRenderer.on('llm-generate-stream-data', handler);
        ipcRenderer.on('llm-generate-stream-end', endHandler);
        ipcRenderer.on('llm-generate-stream-error', errorHandler);
        ipcRenderer.send('llm-generate-stream', { prompt });
    });
}

/**
 * Convert error results to user-friendly messages
 */
function getErrorMessage(result) {
    if (result.errorType === 'NOT_INITIALIZED') {
        return 'LLM system not initialized. Please restart the application.';
    }
    if (result.errorType === 'GENERATION_ERROR') {
        return 'Failed to generate content. The model may be too large for your system.';
    }
    if (result.error?.includes('Model file not found')) {
        return 'No model downloaded. Open Settings (⚙️) to download a model.';
    }
    return result.error || 'Unknown LLM error';
}

/**
 * Abort the current LLM generation
 * @returns {Promise<{success: boolean, aborted: boolean}>}
 */
export async function abortGeneration() {
    return await ipcRenderer.invoke('llm-abort-generation');
}
