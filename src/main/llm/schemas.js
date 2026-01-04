/**
 * JSON Schemas for LLM generation
 *
 * Shared between game code (src/llm.js) and benchmarks (tests/llm/runRealBenchmark.js)
 * to ensure we test what we ship.
 *
 * SLOT-BASED GENERATION:
 * - Level intros use 3 slots (room, threat, oddity) assembled with periods
 * - Artifacts use 3 slots (title, placement, effect) assembled with period
 */

export const JsonSchemas = {
    // Level introduction: { room: "...", threat: "...", oddity: "..." }
    // Assembled as: `${room}. ${threat}. ${oddity}.`
    levelIntro: {
        type: 'object',
        properties: {
            room: { type: 'string' },      // 8-14 words: environment + sensory detail
            threat: { type: 'string' },    // 6-12 words: enemy presence (behavior, not count)
            oddity: { type: 'string' }     // 8-14 words: uncanny detail or artifact tease
        },
        required: ['room', 'threat', 'oddity']
    },

    // Artifact: { title: "...", placement: "...", effect: "..." }
    // Assembled as: `${placement}. ${effect}.`
    artifact: {
        type: 'object',
        properties: {
            title: { type: 'string' },       // Exact artifact name
            placement: { type: 'string' },   // 10-18 words: location + chamber interaction
            effect: { type: 'string' }       // 10-18 words: weirdness/power hint
        },
        required: ['title', 'placement', 'effect']
    }
};

/**
 * Assemble level intro slots into final description
 * Cleans trailing punctuation to avoid double periods
 */
export function assembleLevelIntro({ room, threat, oddity }) {
    const clean = (s) => s?.replace(/[.!?,;:\s]+$/g, '').trim() || '';
    return `${clean(room)}. ${clean(threat)}. ${clean(oddity)}.`;
}

/**
 * Assemble artifact slots into final description
 * Cleans trailing punctuation to avoid double periods
 */
export function assembleArtifact({ placement, effect }) {
    const clean = (s) => s?.replace(/[.!?,;:\s]+$/g, '').trim() || '';
    return `${clean(placement)}. ${clean(effect)}.`;
}
