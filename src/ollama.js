import { getLLMModel } from './systems/settings.js';
import { appendLevelIntroductionText, setLevelIntroductionText } from './ui/overlays/levelIntro.js';

const { ipcRenderer } = window.require('electron');

export async function generateDescription(prompt) {
    try {
        const model = 'qwen:1.5b';
        const result = await ipcRenderer.invoke('llm-generate', {
            model: model,
            prompt: prompt,
            stream: false
        });
        
        if (!result.success) {
            let userError = result.error;
            
            if (result.errorType === 'NOT_INITIALIZED') {
                userError = 'LLM system not initialized. Please restart the application.';
            } else if (result.errorType === 'GENERATION_ERROR') {
                userError = 'Failed to generate content. The model may be too large for your system.';
            } else if (result.error && result.error.includes('Model file not found')) {
                userError = 'No model downloaded. Open Settings (⚙️) to download a model.';
            }
            
            console.error('LLM generation failed:', {
                error: result.error,
                errorType: result.errorType,
                model: model
            });
            
            const err = new Error(userError);
            if (result.errorType) err.code = result.errorType;
            throw err;
        }
        
        return result.text || 'No description generated.';
    } catch (error) {
        console.error('Error generating description:', error);
        throw error;
    }
}

export async function streamDescription(prompt, { onToken } = {}) {
    const model = 'qwen:1.5b';
    return new Promise((resolve, reject) => {
        try {
            let full = '';
            let buffer = '';
            let inDescription = false;
            let inFence = false;
            let hasStreamStarted = false;
            let thinkSkip = false;
            const lower = (s) => String(s || '').toLowerCase();
            let softMode = false; // fallback streaming before <description>
            const softModeTimer = setTimeout(() => { softMode = true; }, 900);
            let descriptionTagFound = false; // whether we've seen an explicit <description>

            function processBuffer() {
                let appended = '';
                let i = 0;
                while (i < buffer.length) {
                    if (!inDescription) {
                        const idx = lower(buffer.slice(i)).indexOf('<description>');
                        if (idx === -1) {
                            // If soft mode is active, begin streaming outside of tags/fences
                            if (!softMode) {
                                const keepTail = Math.max(0, buffer.length - 24);
                                buffer = buffer.slice(buffer.length - keepTail);
                                break;
                            } else {
                                // Treat as inside description but without requiring end tag
                                inDescription = true;
                                // We have not actually seen the tag; mark accordingly
                                descriptionTagFound = false;
                                // continue in same iteration without consuming
                            }
                        } else {
                            const start = i + idx;
                            const after = start + '<description>'.length;
                            buffer = buffer.slice(after);
                            i = 0;
                            inDescription = true;
                            descriptionTagFound = true;
                            continue;
                        }
                    }

                    if (lower(buffer.slice(i)).startsWith('</description>')) {
                        buffer = buffer.slice(i + '</description>'.length);
                        inDescription = false;
                        break;
                    }

                    if (buffer.slice(i, i + 3) === '```') {
                        // Toggle fence and skip the fence markers
                        inFence = !inFence;
                        i += 3;
                        // On opening fence, skip optional language hint like 'xml' and an optional newline
                        if (inFence) {
                            while (i < buffer.length && /[A-Za-z]/.test(buffer[i])) i++;
                            while (i < buffer.length && (buffer[i] === ' ' || buffer[i] === '\t' || buffer[i] === ':' || buffer[i] === '-')) i++;
                            if (buffer[i] === '\n' || buffer[i] === '\r') i++;
                        }
                        continue;
                    }

                    if (!thinkSkip && lower(buffer.slice(i)).startsWith('<think>')) {
                        thinkSkip = true;
                        i += '<think>'.length;
                        continue;
                    }
                    if (thinkSkip) {
                        const endThinkIdx = lower(buffer.slice(i)).indexOf('</think>');
                        if (endThinkIdx === -1) {
                            break;
                        } else {
                            i += endThinkIdx + '</think>'.length;
                            thinkSkip = false;
                            continue;
                        }
                    }

                    // If we entered soft mode without an explicit <description>, we can
                    // occasionally see stray tag tails like "_format>". When we encounter
                    // a lone '>' before having seen the description tag, drop any collected
                    // prefix and continue after the '>' to avoid leaking partial tags.
                    if (!descriptionTagFound && !inFence && buffer[i] === '>') {
                        appended = '';
                        i += 1;
                        continue;
                    }

                    if (buffer[i] === '<') {
                        const closeIdx = buffer.indexOf('>', i + 1);
                        if (closeIdx === -1) {
                            break;
                        }
                        i = closeIdx + 1;
                        continue;
                    }

                    // Always append character content; tags are handled separately above
                    appended += buffer[i];
                    i += 1;
                }

                if (i > 0) buffer = buffer.slice(i);
                if (appended) {
                    // Sanitize any soft-mode prefix tails like "output_format>" or "_format>"
                    if (!descriptionTagFound) {
                        appended = appended.replace(/^[A-Za-z]*_?format>\s*/i, '');
                    }
                    // On the very first append, drop a leading language hint like 'xml'
                    if (!hasStreamStarted) {
                        appended = appended.replace(/^\s*xml\b[:\-]?\s*/i, '');
                    }
                    if (appended) {
                        try { appendLevelIntroductionText(appended); } catch {}
                        if (onToken) onToken(appended);
                        hasStreamStarted = true;
                    }
                }
            }

            const handler = (event, data) => {
                try {
                    const piece = data?.content || '';
                    if (piece) {
                        full += piece;
                        buffer += piece;
                        processBuffer();
                    }
                } catch (e) {}
            };
            const endHandler = () => { 
                cleanup();
                if (full && !/<description>/i.test(full)) {
                    const cleaned = full.replace(/```[\s\S]*?```/g, '').replace(/<[^>]*>/g, '').trim();
                    try { appendLevelIntroductionText(cleaned); } catch {}
                }
                resolve(full);
            };
            const errorHandler = (event, payload) => {
                cleanup();
                const err = new Error(payload?.error || 'Stream error');
                if (payload && payload.errorType) err.code = payload.errorType;
                reject(err);
            };
            function cleanup() {
                clearTimeout(softModeTimer);
                ipcRenderer.removeListener('llm-generate-stream-data', handler);
                ipcRenderer.removeListener('llm-generate-stream-end', endHandler);
                ipcRenderer.removeListener('llm-generate-stream-error', errorHandler);
            }
            ipcRenderer.on('llm-generate-stream-data', handler);
            ipcRenderer.on('llm-generate-stream-end', endHandler);
            ipcRenderer.on('llm-generate-stream-error', errorHandler);
            ipcRenderer.send('llm-generate-stream', { model, prompt });
        } catch (err) {
            reject(err);
        }
    });
}