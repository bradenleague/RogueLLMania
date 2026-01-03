import { Events } from '../systems/eventBus.js';
import { findFreeTile, pickupEntityWithTileRestore } from './placement.js';
import { generateJson, JsonSchemas } from '../llm.js';
import { isLLMEnabled } from '../systems/settings.js';
import { incrementArtifactsFound, addToInventory, getGameState, updateInventoryItem } from '../systems/gameState.js';
import { refreshInventoryDisplay } from '../ui/overlays/inventory.js';
import { getTileContextDescription } from '../tiles/index.js';
import * as logger from '../systems/logger.js';
import { ensureWaitingMessage } from '../systems/systemMessages.js';
import {
    PROMPT_TEMPLATES,
    ARTIFACT_MATERIALS,
    TILE_THEMES,
    PROXIMITY_DESCRIPTIONS,
    MATERIAL_BIASES,
    ENVIRONMENTAL_INFLUENCES,
    EXAMPLE_ARTIFACTS,
    UI_MESSAGES,
    DEBUG_ARTIFACT,
    getAllWeirdnessModifiers
} from '../content/artifacts.js';

// LLM enable/disable is now controlled through settings

// NOTE: Static prompt moved to ConfigManager.getSystemPrompts().artifact
// This improves performance by using session-level systemPrompt instead of per-call embedding
// Output format changed from XML to JSON schema for reliability

// Build the context payload for the artifact prompt
// weirdnessHint is a seeded strange phenomenon to encourage variety
function buildArtifactXML(procSeed, position, proximity, environmentDetail, tileType, themes, weirdnessHint) {
    return `
<artifact>
  <seed>${procSeed.seedStr}</seed>
  <title>${procSeed.title}</title>
  <materials>${procSeed.material} (${procSeed.finish})</materials>
  <form>${procSeed.form}</form>
  <motif>${procSeed.motif}</motif>
  <tile>${tileType || 'unknown'}</tile>
  <position>${position}</position>
  <proximity>${proximity}</proximity>
  <environment>${environmentDetail}</environment>
  <power_hint>${procSeed.power}</power_hint>
  <themes>${themes || ''}</themes>
  <weirdness_hint>${weirdnessHint || ''}</weirdness_hint>
</artifact>`;
}

// Dynamic prompt templates are now imported from content/artifacts.js

// --- Deterministic proc‑gen helpers (seeded by level/coords) ---
// Lightweight hash + PRNG (xmur3 + sfc32)
function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    };
}
function sfc32(a, b, c, d) {
    return function() {
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
        let t = (a + b) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        d = (d + 1) | 0;
        t = (t + d) | 0;
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
}
function rngFromSeed(seedStr) {
    const seed = xmur3(seedStr);
    return sfc32(seed(), seed(), seed(), seed());
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function chance(rng, p) { return rng() < p; }

// Style tables are now imported from content/artifacts.js

function deduceTileType(underTile){
    if (!underTile) return null;
    if (underTile.type) return underTile.type;
    const p = underTile.props || {};
    if (p.organic && p.damp) return "moss";
    if (p.soft && p.organic) return "grass";
    if (p.dusty) return "dirt";
    if (p.hard && p.ancient) return "cobblestone";
    if (p.hard) return "stone";
    if (p.wet) return "water";
    if (p.granular) return "sand";
    return null;
}

// Analyze the 3x3 area around the artifact for environmental context
function analyzeEnvironmentalContext(x, y, map, MAP_WIDTH, MAP_HEIGHT) {
    const tileCounts = {};
    let totalTiles = 0;
    let wallCount = 0;
    
    // Check 3x3 area around the artifact
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            // Skip if out of bounds
            if (checkX < 0 || checkX >= MAP_WIDTH || checkY < 0 || checkY >= MAP_HEIGHT) {
                wallCount++;
                continue;
            }
            
            const tile = map[checkX][checkY];
            const tileType = deduceTileType(tile);
            
            if (!tile || tile.solid) {
                wallCount++;
            } else if (tileType) {
                tileCounts[tileType] = (tileCounts[tileType] || 0) + 1;
                totalTiles++;
            }
        }
    }
    
    // Determine environmental context
    const waterCount = tileCounts.water || 0;
    const stoneCount = (tileCounts.stone || 0) + (tileCounts.cobblestone || 0);
    const enclosureRatio = wallCount / 9; // How enclosed is the area?
    
    let environmentalType = null;
    
    // Near water (even if not directly under)
    if (waterCount > 0) {
        environmentalType = 'nearWater';
    }
    // Highly enclosed by walls/stone
    else if (enclosureRatio > 0.6 || stoneCount > 4) {
        environmentalType = 'enclosed';
    }
    // Mixed tile types (transitional area)
    else if (Object.keys(tileCounts).length > 2) {
        environmentalType = 'transitional';
    }
    
    return {
        environmentalType,
        tileCounts,
        wallCount,
        enclosureRatio,
        dominantTile: Object.keys(tileCounts).reduce((a, b) => tileCounts[a] > tileCounts[b] ? a : b, null)
    };
}

function buildProcgenArtifact(x, y, MAP_WIDTH, MAP_HEIGHT, levelNumber, underTile, map) {
    const seedStr = `L${levelNumber}:${x},${y}`;
    const rng = rngFromSeed(seedStr);

    // Position + environment context (reuse existing helpers)
    const { position, proximity } = getPositionDescription(x, y, MAP_WIDTH, MAP_HEIGHT);
    const tileType = deduceTileType(underTile);
    
    // NEW: Analyze surrounding environment
    const environmentalContext = analyzeEnvironmentalContext(x, y, map, MAP_WIDTH, MAP_HEIGHT);

    // Bias picks by tile type (direct tile under artifact)
    let material = pick(rng, ARTIFACT_MATERIALS.metals);
    let finishBonus = null;
    let powerHint = null;
    
    // Apply direct tile bias first
    if (MATERIAL_BIASES[tileType] && chance(rng, MATERIAL_BIASES[tileType].probability)) {
        material = pick(rng, MATERIAL_BIASES[tileType].materials);
    }
    
    // NEW: Apply environmental influences from surrounding area
    if (environmentalContext.environmentalType) {
        const influence = ENVIRONMENTAL_INFLUENCES[environmentalContext.environmentalType];
        if (influence && chance(rng, influence.probability)) {
            // Override material with environmental influence
            material = pick(rng, influence.materials);
            
            // Add environmental finish bonus
            if (influence.finishBonus && chance(rng, 0.3)) {
                finishBonus = pick(rng, influence.finishBonus);
            }
            
            // Add environmental power hint
            if (influence.powerHints && chance(rng, 0.4)) {
                powerHint = pick(rng, influence.powerHints);
            }
        }
    }

    const form = pick(rng, ARTIFACT_MATERIALS.forms);
    const finishA = finishBonus || pick(rng, ARTIFACT_MATERIALS.finishes);
    const finishB = chance(rng, 0.5) ? pick(rng, ARTIFACT_MATERIALS.finishes.filter(f => f !== finishA)) : null;
    const motif = pick(rng, ARTIFACT_MATERIALS.motifs);
    const adj = pick(rng, ARTIFACT_MATERIALS.adjectives);
    const power = powerHint || pick(rng, ARTIFACT_MATERIALS.powers);

    const title = `${pick(rng, ARTIFACT_MATERIALS.titleParts.left)} ${pick(rng, ARTIFACT_MATERIALS.titleParts.right)}`;

    // Pick a seeded weirdness modifier for variety injection
    // This gives each artifact a unique strange quality based on its coordinates
    const allWeirdness = getAllWeirdnessModifiers();
    const weirdnessHint = pick(rng, allWeirdness);

    // Compose a deterministic two‑sentence blurb we can use as a fallback or seed for LLM polish
    const environmentNoun = tileType ? tileType : "ground";
    const finishPart = finishB ? `${finishA} and ${finishB}` : finishA;

    const sentence1 = `A ${adj} ${material} ${form}, ${finishPart}, worked with ${motif}, lies ${position}.`;
    const sentence2 = `${proximity} When handled near the ${environmentNoun}, it ${power}.`;

    return {
        seedStr,
        tileType,
        environmentalContext,
        position,
        proximity,
        material,
        form,
        finish: finishPart,
        motif,
        adj,
        power,
        title,
        weirdnessHint,
        fallbackText: `${sentence1} ${sentence2}`
    };
}

function getPositionDescription(x, y, MAP_WIDTH, MAP_HEIGHT) {
    const centerX = Math.floor(MAP_WIDTH / 2);
    const centerY = Math.floor(MAP_HEIGHT / 2);
    
    // Determine position relative to room
    let position = "";
    let proximity = "";
    
    // Corner detection
    if ((x <= 2 && y <= 2)) position = "in the northwest corner";
    else if ((x >= MAP_WIDTH - 3 && y <= 2)) position = "in the northeast corner"; 
    else if ((x <= 2 && y >= MAP_HEIGHT - 3)) position = "in the southwest corner";
    else if ((x >= MAP_WIDTH - 3 && y >= MAP_HEIGHT - 3)) position = "in the southeast corner";
    // Edge detection
    else if (x <= 2) position = "near the western wall";
    else if (x >= MAP_WIDTH - 3) position = "near the eastern wall";
    else if (y <= 2) position = "near the northern wall";
    else if (y >= MAP_HEIGHT - 3) position = "near the southern wall";
    // Center area
    else if (Math.abs(x - centerX) <= 1 && Math.abs(y - centerY) <= 1) position = "in the very center";
    else position = "in the open area";
    
    // Add proximity context
    if (position.includes("corner")) proximity = PROXIMITY_DESCRIPTIONS.corner;
    else if (position.includes("wall")) proximity = PROXIMITY_DESCRIPTIONS.wall;  
    else if (position.includes("center")) proximity = PROXIMITY_DESCRIPTIONS.center;
    else proximity = PROXIMITY_DESCRIPTIONS.open;
    
    return { position, proximity };
}

// Returns a string of artifact themes based on tile type
function getArtifactThemesForTile(tileType) {
    const tileData = TILE_THEMES[tileType];
    return tileData ? tileData.themes : "";
}

function constructDynamicPrompt(x, y, MAP_WIDTH, MAP_HEIGHT, levelNumber, underTile, artifactsFound, procSeed = null) {
    const { position, proximity } = getPositionDescription(x, y, MAP_WIDTH, MAP_HEIGHT);

    // Build environmentDetail and tileType using existing logic
    const tileContext = getTileContextDescription(underTile);
    let environmentDetail = "";
    let tileType = null;
    if (underTile) {
        if (underTile.type) {
            tileType = underTile.type;
        } else if (underTile.props) {
            if (underTile.props.organic && underTile.props.damp) tileType = "moss";
            else if (underTile.props.soft && underTile.props.organic) tileType = "grass";
            else if (underTile.props.dusty) tileType = "dirt";
            else if (underTile.props.hard && underTile.props.ancient) tileType = "cobblestone";
            else if (underTile.props.hard) tileType = "stone";
            else if (underTile.props.wet) tileType = "water";
            else if (underTile.props.granular) tileType = "sand";
        }
        const tileData = TILE_THEMES[tileType];
        environmentDetail = tileData
            ? tileData.environmentDescription
            : (tileContext
                ? `The ground here feels ${tileContext}, adding a sense of mystery.`
                : "The environment here is unusual, lending the artifact an air of intrigue.");

        if (tileContext && !environmentDetail.includes(tileContext)) {
            environmentDetail += ` (${tileContext})`;
        }
    }

    // Build XML payload + final prompt
    const themes = getArtifactThemesForTile(tileType);
    const weirdnessHint = procSeed?.weirdnessHint || '';
    const xmlPayload = buildArtifactXML(procSeed, position, proximity, environmentDetail, tileType, themes, weirdnessHint);
    // System prompt is now at session level via ConfigManager.getSystemPrompts()
    const dynamicPrompt = xmlPayload;

    // Optional debug log
    logger.info(`Artifact prompt:\n${dynamicPrompt}`);

    return dynamicPrompt;
}

export async function generateStoryDetails(x, y, MAP_WIDTH, MAP_HEIGHT, levelNumber, underTile, map) {
    if (!(await isLLMEnabled())) {
        // Return a clearly labeled debug object
        return {
            title: DEBUG_ARTIFACT.title,
            description: DEBUG_ARTIFACT.description
        };
    }
    // Get the number of artifacts found so far
    const { artifactsFound } = getGameState();

    // Build deterministic proc‑gen seed from level + coords; use as LLM scaffold and fallback text
    const procSeed = buildProcgenArtifact(x, y, MAP_WIDTH, MAP_HEIGHT, levelNumber, underTile, map);

    // Ask LLM to polish the proc‑gen seed (deterministic base), retaining our title
    const dynamicPrompt = constructDynamicPrompt(
        x, y, MAP_WIDTH, MAP_HEIGHT, levelNumber, underTile, artifactsFound, procSeed
    );

    let description;
    let title = procSeed.title; // Default to proc‑gen title if parsing fails

    try {
        // Generate JSON with schema enforcement and mode for system prompt
        const result = await generateJson(dynamicPrompt, JsonSchemas.artifact, { mode: 'artifact' });

        // Extract title and description from JSON result
        title = result.title || procSeed.title;
        description = result.description || procSeed.fallbackText;

        // Clean up any thinking tags that might be inside the description
        description = description.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        logger.info(`Generated artifact: ${title}`);
    } catch (error) {
        logger.error(`Failed to generate artifact description: ${error.message}`, error);
        description = procSeed.fallbackText;
    }

    if (!description || description.length === 0) {
        description = procSeed.fallbackText;
    }

    return { title, description };
}

export async function createStoryObject(map, MAP_WIDTH, MAP_HEIGHT, player, levelNumber = 1, existingEntities = [], world = null) {
    try {
        // Find a free position for the story object
        const { x, y } = findFreeTile(map, MAP_WIDTH, MAP_HEIGHT, player, existingEntities);
        
        // Store the original tile for potential restoration (but don't place on map)
        const underTile = JSON.parse(JSON.stringify(map[x][y]));
        
        // Create the story object instance
        const storyObject = {
            x: x,
            y: y,
            pickedUp: false,
            title: "Mysterious Artifact", // Placeholder title
            description: "Loading...", // Placeholder description
            levelNumber: levelNumber,
            loading: true,
            underTile // Store the original tile
        };
        
        // Show loading message to player
        if (!(await isLLMEnabled())) {
            const debugMessage = UI_MESSAGES.debugMode;
            if (world && world.messageBus) {
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: debugMessage, type: 'system' });
            } else {
                logger.warn('No world provided to createStoryObject, debug message not shown');
            }
            
            storyObject.title = DEBUG_ARTIFACT.title;
            storyObject.description = DEBUG_ARTIFACT.description;
            storyObject.loading = false;
            
            // Clear message and redraw
            if (world && world.messageBus) {
                world.messageBus.emit(Events.MESSAGE, '');
                world.requestRedraw();
            } else {
                logger.warn('No world provided to createStoryObject, cannot clear message or redraw');
            }
            
            return storyObject;
        }
        
        const loadingMessage = ensureWaitingMessage();
        if (world && world.messageBus) {
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: loadingMessage, type: 'system' });
        } else {
            logger.warn('No world provided to createStoryObject, loading message not shown');
        }
        
        // Kick off async description generation
        generateStoryDetails(x, y, MAP_WIDTH, MAP_HEIGHT, levelNumber, underTile, map)
            .then(({ title, description }) => {
                // Update the story object in-place when ready
                storyObject.title = title;
                storyObject.description = description;
                storyObject.loading = false;
                
                // If the story object was already picked up, update the UI description
                if (storyObject.pickedUp && world && world.messageBus) {
                    world.messageBus.emit(Events.UI_DESCRIPTION, storyObject.description, storyObject.title);
                    
                    // Also update the inventory item
                    updateInventoryItem(storyObject.levelNumber, storyObject.x, storyObject.y, storyObject.title, storyObject.description);
                    refreshInventoryDisplay();
                }
                
                // Clear loading message and redraw
                if (world && world.messageBus) {
                    world.messageBus.emit(Events.MESSAGE, '');
                    world.requestRedraw();
                } else {
                    logger.warn('No world provided to createStoryObject, cannot clear message or redraw after generation');
                }
            })
            .catch(error => {
                logger.error(`Failed to generate story object details: ${error.message}`, error);
                const code = error && (error.code || error.errorType);
                if (!window.__OLLAMA_NUDGE_SHOWN && (code === 'CONNECTION_ERROR' || code === 'MODEL_NOT_FOUND' || code === 'SERVICE_ERROR')) {
                    try {
                        world.messageBus.emit(Events.MESSAGE_TYPED, { 
                            text: "Your Archivist coughs politely: I can riff on vibes, but Ollama isn’t connected. Flip the ⚙️ Settings, pick a model, and I’ll spin something legendary.", 
                            type: 'warn' 
                        });
                        window.__OLLAMA_NUDGE_SHOWN = true;
                    } catch {}
                }
                // Keep placeholder values but mark as not loading
                storyObject.loading = false;
                
                if (world && world.messageBus) {
                    world.messageBus.emit(Events.MESSAGE, '');
                    world.requestRedraw();
                } else {
                    logger.warn('No world provided to createStoryObject, cannot clear message or redraw after error');
                }
            });
        
        return storyObject;
    } catch (error) {
        logger.error(`Failed to create story object: ${error.message}`, error);
        
        // Create a basic fallback story object
        return {
            x: player.x + 1,
            y: player.y + 1,
            pickedUp: false,
            title: "Ancient Relic",
            description: "A mysterious object of unknown origin.",
            levelNumber: levelNumber,
            loading: false,
            underTile: null
        };
    }
}

// Check if player is standing on an item (for visual feedback)
export function checkForInteraction(x, y, storyObject, map, MAP_WIDTH, MAP_HEIGHT, player, world = null) {
    if (x === storyObject.x && y === storyObject.y && !storyObject.pickedUp) {
        // Show message that there's an item here, but don't pick it up automatically
        const message = UI_MESSAGES.interaction;
        if (world && world.messageBus) {
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: message, type: 'system' });
        } else {
            Promise.all([
                import('../ui/messageLog.js')
            ]).then(([log]) => {
                log.appendMessage(message);
            });
        }
        return true; // Interaction available
    }
    return false; // No interaction
}

// Try to pick up item at current position (called when 'g' is pressed)
export function tryPickupItem(x, y, storyObject, map, MAP_WIDTH, MAP_HEIGHT, player, world = null) {
    if (x === storyObject.x && y === storyObject.y && !storyObject.pickedUp) {
        try {
            // Pick up the item
            storyObject.pickedUp = true;
            // Restore the original tile using generic function
            pickupEntityWithTileRestore(map, storyObject.x, storyObject.y, storyObject.underTile);
            
            // Add to inventory instead of just tracking artifacts found
            addToInventory({
                id: `artifact_${Date.now()}`, // Unique ID
                title: storyObject.title, // Pass the title
                description: storyObject.description,
                x: storyObject.x,
                y: storyObject.y,
                levelNumber: storyObject.levelNumber // Changed from roomNumber to levelNumber
            });
            
            incrementArtifactsFound(); // Update game state
            
            // Log the pickup action
            logger.info(`Artifact picked up: ${storyObject.title}`);
            
            const message = UI_MESSAGES.pickupSuccess;
            if (world && world.messageBus) {
                world.messageBus.emit(Events.MESSAGE, message);
                world.messageBus.emit(Events.UI_DESCRIPTION, storyObject.description, storyObject.title || "Mysterious Artifact");
            } else {
                Promise.all([
                    import('../ui/messageLog.js')
                ]).then(([log]) => {
                    log.appendMessage(message);
                    // Route description to message log as well
                    const safeTitle = (storyObject.title || 'Mysterious Artifact');
                    const safeDesc = (storyObject.description || '');
                    log.appendMessage({ html: `<strong>${escapeHtml(safeTitle)}</strong><br><em>${escapeHtml(safeDesc)}</em>`, type: 'info' });
                });
            }
            
            // Refresh inventory display if it's currently open
            refreshInventoryDisplay();
            
            // Trigger redraw
            if (world && world.messageBus) {
                world.requestRedraw();
            } else {
                import('../game.js').then(({ draw }) => {
                    draw();
                });
            }
            
            return true; // Successfully picked up
        } catch (error) {
            logger.error(`Failed to pick up ${storyObject.title}: ${error.message}`, error);
            
            const message = UI_MESSAGES.pickupFailed;
            if (world && world.messageBus) {
                world.messageBus.emit(Events.MESSAGE, message);
                world.requestRedraw();
            } else {
                import('../ui/messageLog.js').then(({ appendMessage }) => appendMessage(message));
            }
            return false;
        }
    } else if (x === storyObject.x && y === storyObject.y && storyObject.pickedUp) {
        // Item already picked up
        return false; // Nothing to pick up
    } else {
        // Not standing on an item
        return false; // Nothing to pick up
    }
}