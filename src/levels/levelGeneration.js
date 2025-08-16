import { createCompleteTileMap } from "./tileGeneration.js";
import { setupLevelEntities, placeTorchesOnLevel } from "./entityPlacement.js";
import * as logger from '../systems/logger.js';

/**
 * Generates a complete level with tiles and entities
 * @param {Object} map - The map object to populate (will be modified)
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {Object} player - Player entity
 * @param {number} levelNumber - Level number for generation
 * @param {Object} world - World instance for notifications and rendering
 * @param {Object} levelInstance - Optional level instance to populate with light sources
 * @returns {Object} - Level entities {storyObject, portal, staticObjects}
 */
export async function generateLevel(map, MAP_WIDTH, MAP_HEIGHT, player, levelNumber = 1, world = null, levelInstance = null) {
    // Generate the complete tile map using the tile generation system
    const { map: generatedMap, levelType } = createCompleteTileMap(MAP_WIDTH, MAP_HEIGHT, levelNumber);
    
    // Copy the generated tiles to the provided map reference
    for (let x = 0; x < MAP_WIDTH; x++) {
        map[x] = generatedMap[x];
    }
    
    // Set up all entities (player placement, portal, static objects, story object)
    const entities = await setupLevelEntities(map, MAP_WIDTH, MAP_HEIGHT, player, levelNumber, world);
    
    // Place torch light sources if level instance is provided
    if (levelInstance) {
        placeTorchesOnLevel(map, MAP_WIDTH, MAP_HEIGHT, levelInstance, levelNumber, player);
    }
    
    // logger.debug(`Level ${levelNumber} (${levelType}) generation complete`);
    
    return entities;
} 