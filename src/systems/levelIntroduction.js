import { generateDescription, streamDescription } from '../ollama.js';
import { isLLMEnabled } from './settings.js';
import { determineLevelType } from '../levels/tileGeneration.js';
import { Events } from './eventBus.js';
import { openLevelIntroduction, setLevelIntroductionText, appendLevelIntroductionText, showLevelIntroductionNudge } from '../ui/overlays/levelIntro.js';
import { openTransientSystemOverlay, closeTransientSystemOverlay } from '../ui/overlayManager.js';
import { ensureWaitingMessage, clearWaitingMessage } from './systemMessages.js';
import * as logger from './logger.js';

// Avoid spamming Ollama nudges
let OLLAMA_NUDGE_SHOWN = false;

// Sanitize LLM output to remove code fences, language hints like leading "xml",
// stray tags, and thinking blocks
function sanitizeIntro(text) {
    if (!text) return '';
    let t = String(text);
    // Strip markdown code fences entirely
    t = t.replace(/```[\s\S]*?```/g, '');
    // Remove leading language hint like 'xml' at start
    t = t.replace(/^\s*xml\b[:\-]?\s*/i, '');
    // Remove <think> blocks if any leaked
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // Remove any remaining tags
    t = t.replace(/<[^>]*>/g, '');
    // Collapse whitespace and trim
    return t.replace(/\s+/g, ' ').trim();
}

// -------- Static prompt shared by all level‑introduction generations --------
const STATIC_PROMPT = `
You are the Chamber Herald—an AI narrator who writes a vivid 2‑3 sentence introduction when an adventurer steps into a new chamber of a dungeon.

### Reasoning checklist
1. Read every incoming XML tag and remember its values.
2. Weave the following ingredients into the prose:
   • <floor> and <chamber_type>  
   • A sense of threat using <monster_count> and <monster_type>  
   • A hint of discovery using <artifact_title> and, if provided, subtly echo the mood of <artifact_description> without quoting it
3. Write in second person ("You…"), keep it mysterious and evocative, no more than 3 sentences, avoid proper nouns except the artifact title.
4. If <artifact_title> is "NONE", omit any artifact reference; if <artifact_description> is "NONE", ignore it.

### Creative guidelines
• Paraphrase seed facts from the XML rather than repeating them verbatim. Render <floor> and <chamber_type> as sensory or architectural imagery; imply <monster_type> as threat rather than naming it literally; reflect <monster_count> as tone ("a few", "many") instead of raw numbers unless a numeral feels natural.
• Preserve <artifact_title> exactly if mentioned; never quote or copy phrases from <artifact_description>—echo its mood instead.
5. Return **only** the following structure (no extra commentary):

<output_format>
  <description>…</description>
</output_format>
`;

// Build XML payload for the Chamber Herald
function buildLevelIntroXML(ctx) {
    const dominantMonsterType = Object.keys(ctx.monsterTypes)[0] || 'none';
    const floorDesc = tileAtmospheres[ctx.dominantTile] || 'ancient stone';
    return `
<chamber>
  <level>${ctx.levelNumber}</level>
  <chamber_type>${ctx.levelType}</chamber_type>
  <floor>${floorDesc}</floor>
  <monster_count>${ctx.monsterCount}</monster_count>
  <monster_type>${dominantMonsterType}</monster_type>
  <static_object_count>${ctx.staticObjectCount}</static_object_count>
  <artifact_title>${ctx.storyObjectDetails ? ctx.storyObjectDetails.title : 'NONE'}</artifact_title>
  <artifact_description>${ctx.storyObjectDetails ? ctx.storyObjectDetails.description : 'NONE'}</artifact_description>
</chamber>`;
}

// LLM enable/disable is now controlled through settings

// Dynamic prompt templates for different level types
const levelTypeTemplates = {
    basic: [
        "You step into a well-constructed chamber, its {tileDescription} floors bearing witness to ancient craftsmanship.",
        "The entrance reveals a spacious hall with {tileDescription} beneath your feet, speaking of forgotten builders.",
        "Before you stretches a methodically built room, {tileDescription} tiles arranged in careful patterns."
    ],
    cave: [
        "You emerge into a natural cavern, where {tileDescription} ground tells stories of geological ages.",
        "The rough-hewn cave opens before you, its {tileDescription} floor shaped by time and underground waters.",
        "You find yourself in a winding cave system, {tileDescription} surfaces carved by nature's patient hand."
    ],
    pillaredHall: [
        "You enter a grand pillared hall, where {tileDescription} floors echo with the footsteps of history.",
        "Ancient columns rise from {tileDescription} ground in this majestic chamber of forgotten purposes.",
        "The pillared hall welcomes you with {tileDescription} beneath towering stone sentinels."
    ]
};

// Atmospheric descriptions based on dominant tile types
const tileAtmospheres = {
    stone: "cold, unyielding stone",
    grass: "soft, verdant grass that somehow thrives in this underground realm",
    dirt: "dusty, well-worn earth",
    water: "pools of still, reflecting water",
    cobblestone: "weathered cobblestones, each bearing the marks of countless ages",
    moss: "damp, moss-covered stones that glisten with moisture",
    sand: "shifting, golden sand that whispers with each footstep",
    pillar: "solid stone pillars"
};

// Monster atmosphere descriptions
const monsterAtmospheres = {
    zombie: {
        few: "A shambling presence disturbs the air, the scent of decay barely perceptible.",
        many: "The stench of undeath hangs heavy, and shuffling sounds echo from the shadows."
    },
    chaser: {
        few: "Something predatory watches from the darkness, waiting.",
        many: "Multiple pairs of hungry eyes gleam from hidden alcoves, and low growls reverberate through the chamber."
    }
};

/**
 * Analyze the level context to extract relevant details for the introduction
 */
function analyzeLevelContext(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject) {
    const levelType = determineLevelType(levelNumber);
    
    // Analyze tile distribution
    const tileCounts = {};
    let totalTiles = 0;
    let sampleTiles = []; // For debugging
    
    for (let x = 0; x < MAP_WIDTH; x++) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            if (map[x] && map[x][y] && map[x][y].props && map[x][y].props.passable) {
                const tile = map[x][y];
                const tileKey = getTileKey(tile);
                tileCounts[tileKey] = (tileCounts[tileKey] || 0) + 1;
                totalTiles++;
                
                // Collect sample tiles for debugging
                if (sampleTiles.length < 5) {
                    sampleTiles.push({
                        x, y, 
                        tileKey, 
                        type: tile.type, 
                        props: tile.props,
                        char: tile.char,
                        fullTile: JSON.stringify(tile, null, 2)
                    });
                }
            }
        }
    }
    
    // Find dominant tile type
    let dominantTile = 'stone';
    let maxCount = 0;
    for (const [tile, count] of Object.entries(tileCounts)) {
        if (count > maxCount) {
            maxCount = count;
            dominantTile = tile;
        }
    }
    
    // Debug logging with expected vs actual comparison
    const expectedTiles = ['grass', 'dirt', 'cobblestone', 'moss', 'sand'];
    const expectedDominant = levelType === 'basic' ? expectedTiles[levelNumber % expectedTiles.length] : 'varies';
    
    logger.debug('Tile analysis results:', {
        levelNumber,
        levelType,
        expectedDominant,
        actualDominant: dominantTile,
        tileCounts,
        totalTiles,
        sampleTiles
    });
    
    // ALERT if mismatch
    if (levelType === 'basic' && dominantTile !== expectedDominant) {
        logger.warn(`TILE MISMATCH: Level ${levelNumber} expected ${expectedDominant} but got ${dominantTile}`);
    }
    
    // Analyze monsters
    const monsterTypes = {};
    monsters.forEach(monster => {
        const type = monster.typeId || 'unknown';
        monsterTypes[type] = (monsterTypes[type] || 0) + 1;
    });
    
    // Extract story object details (only available after generation completes)
    let storyObjectDetails = null;
    if (storyObject && !storyObject.loading) {
        storyObjectDetails = {
            title: storyObject.title || 'Mysterious Artifact',
            description: storyObject.description || 'A mysterious object of unknown origin.'
        };
        logger.debug('Story object details extracted:', storyObjectDetails);
    } else {
        logger.debug('Story object state:', { 
            exists: !!storyObject, 
            loading: storyObject?.loading,
            title: storyObject?.title 
        });
    }
    
    return {
        levelType,
        levelNumber,
        dominantTile,
        tileCounts,
        totalTiles,
        monsterTypes,
        monsterCount: monsters.length,
        staticObjectCount: staticObjects.length,
        hasStoryObject: !!storyObject,
        storyObjectDetails // This will be null if not ready, or contain title/description if ready
    };
}

/**
 * Get a simple tile key from tile data
 * Since TileTypes don't have a 'type' property, we analyze props and char
 */
function getTileKey(tile) {
    // Debug removed - issue identified and fixed
    
    // Analyze props to determine tile type (simplified to match story object logic)
    if (tile.props) {
        // Use the same logic as the story object system for consistency
        if (tile.props.organic && tile.props.damp) return 'moss';
        if (tile.props.soft && tile.props.organic) return 'grass';
        if (tile.props.dusty) return 'dirt'; // Simplified - just dusty (matches story object)
        if (tile.props.hard && tile.props.ancient) return 'cobblestone';
        if (tile.props.granular) return 'sand'; // Simplified - just granular (matches story object)
        if (tile.props.wet) return 'water'; // Simplified - just wet
        if (tile.props.hard) return 'stone'; // Simplified - just hard (matches story object fallback)
    }
    
    // Fallback based on character if props don't match
    if (tile.char) {
        switch (tile.char) {
            case '"': return tile.props?.damp ? 'moss' : 'grass';
            case '.': 
                if (tile.props?.dusty) return 'dirt';
                if (tile.props?.ancient) return 'cobblestone';
                if (tile.props?.granular) return 'sand';
                return 'stone';
            case '~': return 'water';
            case '#': return 'stone';
        }
    }
    
    return 'stone'; // default
}

/**
 * Construct a static prompt + XML payload for level introduction
 */
function constructLevelIntroductionPrompt(context) {
    const xmlPayload = buildLevelIntroXML(context);
    const prompt = `${STATIC_PROMPT}\n${xmlPayload}`;
    logger.debug('Level introduction prompt (XML):', prompt);
    return prompt;
}

/**
 * Generate a level introduction using the LLM
 */
export async function generateLevelIntroduction(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject) {
    if (!(await isLLMEnabled())) {
        return {
            title: `Chamber ${levelNumber}`,
            description: `DEBUG: You enter level ${levelNumber} (${determineLevelType(levelNumber)} type) with ${monsters.length} monsters and ${staticObjects.length} objects. This is a debug introduction - LLM is disabled.`
        };
    }
    
    try {
        // Analyze the level context
        const context = analyzeLevelContext(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject);
        
        // Construct the dynamic prompt
        const prompt = constructLevelIntroductionPrompt(context);
        
        // Generate the introduction
        const rawResponse = await generateDescription(prompt);
        
        // Extract description from XML tags
        const descriptionMatch = rawResponse.match(/<description>(.*?)<\/description>/s);
        let cleanDescription;
        
        if (descriptionMatch) {
            cleanDescription = sanitizeIntro(descriptionMatch[1]);
        } else {
            // Fallback: clean up the raw response
            cleanDescription = sanitizeIntro(
                rawResponse.replace(/^\s*["']|["']\s*$/g, '')
            );
        }
        
        logger.info(`Generated introduction for level ${levelNumber} (${context.levelType})`);
        
        return {
            title: `Chamber ${levelNumber}`,
            description: cleanDescription
        };
        
    } catch (error) {
        logger.error(`Failed to generate level introduction: ${error.message}`, error);
        
        // Fallback description
        const levelType = determineLevelType(levelNumber);
        return {
            title: `Chamber ${levelNumber}`,
            description: `You step into chamber ${levelNumber}, a ${levelType} space that echoes with ancient mysteries. The shadows seem to shift with unseen presences, and the air itself whispers of adventures yet to unfold.`
        };
    }
}

/**
 * Coordinate level introduction generation after all entities are created
 * This function waits for the story object to complete, then generates the level introduction
 */
export function initiateLevelIntroductionSequence(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject, world) {
    if (!world || !world.turnEngine) {
        logger.error('Cannot initiate level introduction: world or turn engine not available');
        return;
    }
    
    // Open a loading overlay to explicitly lock input during story-object generation
    try { openTransientSystemOverlay(ensureWaitingMessage()); } catch {}
    
    // Set up a polling mechanism to check when story object is done loading
    const checkStoryObjectComplete = () => {
        if (storyObject && storyObject.loading) {
            // Still loading, check again in a moment
            logger.debug('Story object still loading, waiting...');
            setTimeout(checkStoryObjectComplete, 100);
            return;
        }
        
        // Story object is complete (or doesn't exist), now generate level introduction
        logger.debug('Story object complete, starting level introduction generation');
        logger.debug('Final story object state:', {
            exists: !!storyObject,
            loading: storyObject?.loading,
            title: storyObject?.title,
            descriptionLength: storyObject?.description?.length || 0
        });
        
        // Close loading overlay before intro and open intro overlay
        try { closeTransientSystemOverlay(); } catch {}
        try { clearWaitingMessage(); } catch {}
        
        // Open intro overlay with empty body first
        openLevelIntroduction(`Chamber ${levelNumber}`, '');
        
        // Generate level introduction with streaming
        if (!(isLLMEnabled && typeof isLLMEnabled === 'function')) {
            // fallback sync if settings missing
            generateLevelIntroduction(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject)
                .then(({ title, description }) => {
                    appendLevelIntroductionText(description);
                    if (description) {
                        world.messageBus.emit(Events.MESSAGE_TYPED, { text: description, type: 'level' });
                    }
                    world.requestRedraw();
                })
                .catch(error => {
                    logger.error(`Failed to generate level introduction: ${error.message}`, error);
                    world.requestRedraw();
                });
        } else {
            isLLMEnabled().then((enabled) => {
                if (enabled) {
                    const context = analyzeLevelContext(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject);
                    const prompt = constructLevelIntroductionPrompt(context);
                    // Stream tokens directly into the overlay
                    streamDescription(prompt, { onToken: () => {} })
                        .then(full => {
                            if (full) {
                                // Try to extract <description> content first
                                const m = full.match(/<description>([\s\S]*?)<\/description>/i);
                                const clean = m ? sanitizeIntro(m[1]) : sanitizeIntro(full);
                                // Do NOT overwrite the typewriter text on completion; only emit to log
                                world.messageBus.emit(Events.MESSAGE_TYPED, { text: clean, type: 'level' });
                            }
                            world.requestRedraw();
                        })
                        .catch(err => {
                            logger.error('Streaming intro failed:', err);
                            // Playful nudge when Ollama isn't connected or model missing
                            const code = err && (err.code || err.errorType);
                            if (!OLLAMA_NUDGE_SHOWN && (code === 'CONNECTION_ERROR' || code === 'MODEL_NOT_FOUND' || code === 'SERVICE_ERROR')) {
                                try {
                                    world.messageBus.emit(Events.MESSAGE_TYPED, { 
                                        text: "Psst… my Chamber Herald is napping. Fire up Ollama and check your model in Settings (⚙️) to hear the full tale.", 
                                        type: 'warn' 
                                    });
                                    try { showLevelIntroductionNudge('Psst… the Chamber Herald is napping. Start Ollama and set your model in Settings (⚙️) to stream the full intro.'); } catch {}
                                    OLLAMA_NUDGE_SHOWN = true;
                                } catch {}
                            }
                            world.requestRedraw();
                        });
                } else {
                    generateLevelIntroduction(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject)
                        .then(({ description }) => {
                            appendLevelIntroductionText(description);
                            if (description) {
                                world.messageBus.emit(Events.MESSAGE_TYPED, { text: description, type: 'level' });
                            }
                            if (!OLLAMA_NUDGE_SHOWN) {
                                try { showLevelIntroductionNudge('LLM is disabled. Turn it on in Settings (⚙️) and start Ollama to get bespoke chamber intros.'); } catch {}
                                OLLAMA_NUDGE_SHOWN = true;
                            }
                            world.requestRedraw();
                        })
                        .catch(error => {
                            logger.error(`Failed to generate level introduction: ${error.message}`, error);
                            world.requestRedraw();
                        });
                }
            });
        }
    };
    
    // Start checking for story object completion
    checkStoryObjectComplete();
}