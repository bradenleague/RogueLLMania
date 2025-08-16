// Shared placement utilities for all entities
import { isTilePassable, randomFloorType } from '../tiles/index.js';

export function findRandomFloorPosition(map, MAP_WIDTH, MAP_HEIGHT, player, avoidPositions = []) {
    let placed = false;
    let x, y;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops
    
    while (!placed && attempts < maxAttempts) {
        x = 1 + Math.floor(Math.random() * (MAP_WIDTH - 2));
        y = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2));
        
        // Check if position is passable and not occupied by player or other entities
        const tile = map[x][y];
        const isPassable = isTilePassable(tile);
        const notPlayerPosition = !(x === player.x && y === player.y);
        const notAvoidedPosition = !avoidPositions.some(pos => pos.x === x && pos.y === y);
        
        if (isPassable && notPlayerPosition && notAvoidedPosition) {
            placed = true;
        }
        attempts++;
    }
    
    if (!placed) {
        // Fallback to a simple position if we can't find a random one
        console.warn("Could not find random placement, using fallback position");
        x = Math.floor(MAP_WIDTH / 2);
        y = Math.floor(MAP_HEIGHT / 2);
    }
    
    return { x, y };
}

/**
 * Enhanced findFreeTile utility that avoids all entity types
 * Now uses object-based collision detection instead of tile-based entity symbols
 * @param {Object} map - The level tile map
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {Object} player - Player entity
 * @param {Array} entities - Array of entities to avoid
 * @returns {{x: number, y: number}} - Free position coordinates
 */
export function findFreeTile(map, MAP_WIDTH, MAP_HEIGHT, player, entities = []) {
    let placed = false;
    let x, y;
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops
    
    // Build avoid positions from all entities
    const avoidPositions = [];
    
    // Add player position
    avoidPositions.push({ x: player.x, y: player.y });
    
    // Add all entity positions
    entities.forEach(entity => {
        if (entity && typeof entity.x === 'number' && typeof entity.y === 'number' && !entity.pickedUp) {
            avoidPositions.push({ x: entity.x, y: entity.y });
        }
    });
    
    while (!placed && attempts < maxAttempts) {
        x = 1 + Math.floor(Math.random() * (MAP_WIDTH - 2));
        y = 1 + Math.floor(Math.random() * (MAP_HEIGHT - 2));
        
        // Check if position is passable and not occupied by any entity
        const tile = map[x][y];
        const isPassable = isTilePassable(tile);
        const notOccupied = !avoidPositions.some(pos => pos.x === x && pos.y === y);
        
        if (isPassable && notOccupied) {
            placed = true;
        }
        attempts++;
    }
    
    if (!placed) {
        // Fallback: find the first available floor tile
        console.warn("Could not find random free tile, searching systematically");
        for (let fallbackX = 1; fallbackX < MAP_WIDTH - 1; fallbackX++) {
            for (let fallbackY = 1; fallbackY < MAP_HEIGHT - 1; fallbackY++) {
                const tile = map[fallbackX][fallbackY];
                const isPassable = isTilePassable(tile);
                const notOccupied = !avoidPositions.some(pos => pos.x === fallbackX && pos.y === fallbackY);
                
                if (isPassable && notOccupied) {
                    x = fallbackX;
                    y = fallbackY;
                    placed = true;
                    break;
                }
            }
            if (placed) break;
        }
        
        if (!placed) {
            // Last resort fallback
            console.warn("No free tiles found, using center position");
            x = Math.floor(MAP_WIDTH / 2);
            y = Math.floor(MAP_HEIGHT / 2);
        }
    }
    
    return { x, y };
}

/**
 * Generic entity pickup that restores the original tile
 * Used when entities are picked up to restore the floor tile underneath
 * @param {Object} map - The level tile map
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} originalTile - The original tile to restore
 */
export function pickupEntityWithTileRestore(map, x, y, originalTile) {
    if (originalTile) {
        map[x][y] = originalTile;
    } else {
        // Fallback to random floor type if no original tile
        map[x][y] = randomFloorType();
    }
} 