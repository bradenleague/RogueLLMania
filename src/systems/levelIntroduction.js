import { generateJson, JsonSchemas, assembleLevelIntro } from '../llm.js';
import { isLLMEnabled } from './settings.js';
import { determineLevelType } from '../levels/tileGeneration.js';
import { Events } from './eventBus.js';
import { openLevelIntroduction, setLevelIntroductionText, appendLevelIntroductionText, showLevelIntroductionNudge } from '../ui/overlays/levelIntro.js';
import { openTransientSystemOverlay, closeTransientSystemOverlay } from '../ui/overlayManager.js';
import { ensureWaitingMessage, clearWaitingMessage } from './systemMessages.js';
import * as logger from './logger.js';

// Avoid spamming LLM nudges
let LLM_NUDGE_SHOWN = false;

// NOTE: Static prompt moved to ConfigManager.getSystemPrompts().levelIntro
// This improves performance by using session-level systemPrompt instead of per-call embedding

// Build context for the Chamber Herald prompt
function buildLevelIntroContext(ctx) {
    const dominantMonsterType = Object.keys(ctx.monsterTypes)[0] || 'none';
    const floorDesc = tileAtmospheres[ctx.dominantTile] || 'ancient stone';
    const artifact = ctx.storyObjectDetails
        ? `An artifact called "${ctx.storyObjectDetails.title}" awaits discovery.`
        : '';

    return `Chamber ${ctx.levelNumber}, a ${ctx.levelType}. Floor: ${floorDesc}. ${ctx.monsterCount} ${dominantMonsterType}${ctx.monsterCount !== 1 ? 's' : ''} lurk nearby. ${artifact}`;
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
 * Construct prompt for level introduction (JSON output)
 * NOTE: System prompt (tone, rules) is now at session level via ConfigManager.getSystemPrompts()
 */
function constructLevelIntroductionPrompt(context) {
    const contextText = buildLevelIntroContext(context);
    // Just return context - system prompt is handled at session level
    const prompt = `Context: ${contextText}`;
    logger.debug('Level introduction prompt:', prompt);
    return prompt;
}

// assembleLevelIntro is imported from shared schemas.js (includes punctuation cleanup)

/**
 * Generate fallback slots for when LLM is disabled or fails
 * Uses the same slot structure as LLM generation for consistency
 */
function generateFallbackSlots(context) {
    const { levelType, dominantTile, monsterCount, monsterTypes, storyObjectDetails } = context;

    // Room slot (8-14 words): environment + sensory detail
    const tileDesc = tileAtmospheres[dominantTile] || 'ancient stone';
    const templates = levelTypeTemplates[levelType] || levelTypeTemplates.basic;
    const roomTemplate = templates[Math.floor(Math.random() * templates.length)];
    const room = roomTemplate.replace('{tileDescription}', tileDesc);

    // Threat slot (6-12 words): monster presence
    const monsterType = Object.keys(monsterTypes)[0] || 'unknown';
    const monsterAtmosphere = monsterAtmospheres[monsterType];
    let threat;
    if (monsterAtmosphere) {
        threat = monsterCount > 2 ? monsterAtmosphere.many : monsterAtmosphere.few;
    } else {
        threat = monsterCount > 2
            ? `Multiple threats lurk in the shadows, waiting`
            : `A lone presence watches from the darkness`;
    }

    // Oddity slot (8-14 words): uncanny detail or artifact tease
    let oddity;
    if (storyObjectDetails) {
        oddity = `Something called ${storyObjectDetails.title} rests here, its purpose unclear`;
    } else {
        const oddities = [
            `The air itself seems to remember something you've forgotten`,
            `Shadows fall at angles that don't quite match the light`,
            `The silence has texture, like it's been waiting for your arrival`
        ];
        oddity = oddities[Math.floor(Math.random() * oddities.length)];
    }

    return { room, threat, oddity };
}

/**
 * Generate a level introduction using the LLM with JSON schema
 * SLOT-BASED: Returns {room, threat, oddity} from LLM, then assembles into final description
 */
export async function generateLevelIntroduction(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject) {
    // Analyze the level context first (needed for both LLM and fallback)
    const context = analyzeLevelContext(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject);

    if (!(await isLLMEnabled())) {
        // Use fallback slot generation
        const slots = generateFallbackSlots(context);
        const description = assembleLevelIntro(slots);
        return {
            title: `Chamber ${levelNumber}`,
            description
        };
    }

    try {
        // Construct the dynamic prompt
        const prompt = constructLevelIntroductionPrompt(context);

        // Generate JSON with schema enforcement and mode for system prompt
        // Returns {room, threat, oddity} slots
        const slots = await generateJson(prompt, JsonSchemas.levelIntro, { mode: 'levelIntro' });

        // Assemble slots into final description
        const description = assembleLevelIntro(slots);

        logger.info(`Generated introduction for level ${levelNumber} (${context.levelType})`);

        return {
            title: `Chamber ${levelNumber}`,
            description
        };

    } catch (error) {
        logger.error(`Failed to generate level introduction: ${error.message}`, error);

        // Use fallback slot generation on error
        const slots = generateFallbackSlots(context);
        const description = assembleLevelIntro(slots);
        return {
            title: `Chamber ${levelNumber}`,
            description
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
                    // Use JSON schema generation (non-streaming since JSON syntax would show in UI)
                    generateLevelIntroduction(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject)
                        .then(({ description }) => {
                            appendLevelIntroductionText(description);
                            if (description) {
                                world.messageBus.emit(Events.MESSAGE_TYPED, { text: description, type: 'level' });
                            }
                            world.requestRedraw();
                        })
                        .catch(err => {
                            logger.error('Level intro generation failed:', err);
                            // Playful nudge when model isn't available
                            const code = err && (err.code || err.errorType);
                            if (!LLM_NUDGE_SHOWN && (code === 'CONNECTION_ERROR' || code === 'MODEL_NOT_FOUND' || code === 'SERVICE_ERROR')) {
                                try {
                                    world.messageBus.emit(Events.MESSAGE_TYPED, {
                                        text: "Psst… my Chamber Herald is napping. Check Settings (⚙️) to download a model.",
                                        type: 'warn'
                                    });
                                    try { showLevelIntroductionNudge('Psst… the Chamber Herald is napping. Check Settings (⚙️) to download a model.'); } catch {}
                                    LLM_NUDGE_SHOWN = true;
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
                            if (!LLM_NUDGE_SHOWN) {
                                try { showLevelIntroductionNudge('LLM is disabled. Turn it on in Settings (⚙️) to get bespoke chamber intros.'); } catch {}
                                LLM_NUDGE_SHOWN = true;
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