// import { createStaticObjects } from "../entities/staticObject.js";
import { createStoryObject } from "../entities/storyObject.js";
import { createPortal } from "../entities/portal.js";
import { MonsterFactory } from "../entities/monsterFactory.js";
import { findFreeTile } from "../entities/placement.js";
import { randomFloorType, isTilePassable } from "../tiles/tileTypes.js";
import { findNearestPassableTile } from "./pathfinding.js";
import * as logger from '../systems/logger.js';
import { createHealthPotions } from "../entities/healthPotion.js";

// TUNABLE: How many health potions to spawn per level
// Adjust to change potion frequency
export const POTIONS_PER_LEVEL = 2;

/**
 * Ensures the player is placed on a passable tile, moving them if necessary
 * @param {Object} map - The level tile map
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {Object} player - Player entity
 */
export function ensurePlayerPlacement(map, MAP_WIDTH, MAP_HEIGHT, player) {
    // Ensure player starting position is on a passable tile
    if (!isTilePassable(map[player.x][player.y])) {
        // Use pathfinding utility to find the nearest passable tile
        const nearestPassable = findNearestPassableTile(map, MAP_WIDTH, MAP_HEIGHT, player.x, player.y);
        
        // Move player to nearest passable tile if found
        if (nearestPassable) {
            player.setPosition(nearestPassable.x, nearestPassable.y);
            // logger.debug(`Moved player from impassable tile to (${nearestPassable.x}, ${nearestPassable.y})`);
        }
    }
    
    // Ensure player starting position has a good floor tile
    if (!isTilePassable(map[player.x][player.y])) {
        map[player.x][player.y] = randomFloorType();
        // logger.debug(`Fixed player tile at (${player.x}, ${player.y}) with floor tile`);
    }
}

/**
 * Places all entities (portal, static objects, story object, monsters) in the level
 * @param {Object} map - The level tile map
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {Object} player - Player entity
 * @param {number} levelNumber - Current level number
 * @param {Object} world - World instance for notifications and rendering
 * @returns {Object} - Placed entities {portal, staticObjects, storyObject, monsters}
 */
export async function placeAllEntities(map, MAP_WIDTH, MAP_HEIGHT, player, levelNumber, world) {
    const existingEntities = [player];
    

    // Place portal at a free tile
    const { x: portalX, y: portalY } = findFreeTile(map, MAP_WIDTH, MAP_HEIGHT, player, existingEntities);
    const portal = createPortal(map, portalX, portalY);
    existingEntities.push(portal);
            // logger.debug(`Placed portal at (${portalX}, ${portalY})`);
    
    // Create and place health potions in the level (reuse staticObjects slot)
    const staticObjects = createHealthPotions(map, MAP_WIDTH, MAP_HEIGHT, player, existingEntities, POTIONS_PER_LEVEL);
    existingEntities.push(...staticObjects);
    // Set level number for all potions
    staticObjects.forEach(p => { p.levelNumber = levelNumber; });
            // logger.debug(`Placed ${staticObjects.length} health potions in level ${levelNumber}`);
    
    // Create and place story object (with async description generation)
    const storyObject = await createStoryObject(map, MAP_WIDTH, MAP_HEIGHT, player, levelNumber, existingEntities, world);
    existingEntities.push(storyObject);
            // logger.debug(`Placed story object at (${storyObject.x}, ${storyObject.y})`);
    
    // Create and place monsters (2-3 per level)
    const monsters = createMonsters(map, MAP_WIDTH, MAP_HEIGHT, player, existingEntities, levelNumber);
    existingEntities.push(...monsters);
            // logger.debug(`Placed ${monsters.length} monsters in level ${levelNumber}`);
    
    return {
        portal,
        staticObjects,
        storyObject,
        monsters
    };
}

/**
 * Create monsters for the level using the data-driven monster factory
 * @param {Object} map - The level tile map
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {Object} player - Player entity
 * @param {Array} existingEntities - Entities already placed
 * @param {number} levelNumber - Current level number for spawn table logic
 * @returns {Array} - Array of monster entities
 */
function createMonsters(map, MAP_WIDTH, MAP_HEIGHT, player, existingEntities, levelNumber = 1) {
    const monsters = [];
    // Base 2-3 monsters + 1 for each level deeper
    const baseCount = Math.floor(Math.random() * 2) + 2; // 2-3 base monsters
    const monsterCount = baseCount + (levelNumber - 1); // +1 per level
    
    // Get level-appropriate spawn table
    const spawnTable = MonsterFactory.createSpawnTable(levelNumber, monsterCount);
    
    for (let i = 0; i < monsterCount; i++) {
        const { x, y } = findFreeTile(map, MAP_WIDTH, MAP_HEIGHT, player, existingEntities);
        
        // Select monster type from spawn table
        const monsterType = MonsterFactory.selectFromSpawnTable(spawnTable);
        
        // Create monster using factory
        const monster = MonsterFactory.create(monsterType, x, y);
        
        monsters.push(monster);
        existingEntities.push(monster);
        // logger.debug(`Created ${monster.name} (${monsterType}) at (${x}, ${y})`);
    }
    
    return monsters;
}

/**
 * Complete entity setup for a level - handles both player placement and entity placement
 * @param {Object} map - The level tile map
 * @param {number} MAP_WIDTH - Map width  
 * @param {number} MAP_HEIGHT - Map height
 * @param {Object} player - Player entity
 * @param {number} levelNumber - Current level number
 * @param {Object} world - World instance for notifications and rendering
 * @returns {Object} - All placed entities {portal, staticObjects, storyObject, monsters}
 */
export async function setupLevelEntities(map, MAP_WIDTH, MAP_HEIGHT, player, levelNumber, world) {
    // First ensure player is properly placed
    ensurePlayerPlacement(map, MAP_WIDTH, MAP_HEIGHT, player);
    
    // Then place all other entities
    const entities = await placeAllEntities(map, MAP_WIDTH, MAP_HEIGHT, player, levelNumber, world);
    
            // logger.debug(`Level ${levelNumber} entity setup complete`);
    
    return entities;
}

/**
 * Place torch light sources on a level
 * @param {Object} map - The level tile map
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {Object} level - Level instance to add torches to
 * @param {number} levelNumber - Current level number
 * @param {Object} player - Player entity (to avoid placing torches too close)
 */
export function placeTorchesOnLevel(map, MAP_WIDTH, MAP_HEIGHT, level, levelNumber, player) {
    const torchCount = Math.floor(Math.random() * 3) + 2; // 2-4 torches per level
    const minDistanceFromPlayer = 5; // Don't place torches too close to player
    
            // logger.debug(`Placing ${torchCount} torches on level ${levelNumber}`);
    
    for (let i = 0; i < torchCount; i++) {
        // Find a random floor position that's not too close to the player
        let attempts = 0;
        let torchPosition = null;
        
        while (attempts < 50 && !torchPosition) {
            const candidate = findFreeTile(map, MAP_WIDTH, MAP_HEIGHT, player, []);
            if (candidate) {
                const distanceToPlayer = Math.sqrt(
                    Math.pow(candidate.x - player.x, 2) + 
                    Math.pow(candidate.y - player.y, 2)
                );
                
                if (distanceToPlayer >= minDistanceFromPlayer) {
                    torchPosition = candidate;
                }
            }
            attempts++;
        }
        
        if (torchPosition) {
            // Vary torch radius and type based on level
            const torchTypes = ['torch', 'lantern', 'crystal'];
            const torchType = torchTypes[Math.floor(Math.random() * torchTypes.length)];
            
            // Different light radii for different types
            const lightRadii = {
                'torch': 3 + Math.floor(Math.random() * 2), // 3-4 radius
                'lantern': 4 + Math.floor(Math.random() * 2), // 4-5 radius  
                'crystal': 5 + Math.floor(Math.random() * 2)  // 5-6 radius
            };
            
            const radius = lightRadii[torchType] || 4;
            
            level.addLightSource(torchPosition.x, torchPosition.y, radius, torchType);
            
            // logger.debug(`Placed ${torchType} at (${torchPosition.x}, ${torchPosition.y}) with radius ${radius}`);
        } else {
            logger.warn(`Failed to place torch ${i + 1} on level ${levelNumber} after ${attempts} attempts`);
        }
    }
    
            // logger.debug(`Placed ${level.getLightSources().length} light sources on level ${levelNumber}`);
} 