import { TileTypes, randomWallType } from "../tiles/tileTypes.js";
import { generateBasicLayout } from "./generators/basicLevel.js";
import { generateCaveLayout } from "./generators/caveLevel.js";
import { generatePillaredHallLayout } from "./generators/pillaredHallLevel.js";
import * as logger from '../systems/logger.js';

/**
 * Determines the type of level based on the level number
 * @param {number} levelNumber - The current level number
 * @returns {string} - The level type ('basic', 'cave', or 'pillaredHall')
 */
export function determineLevelType(levelNumber) {
    // Cycle through three level types: basic -> cave -> pillaredHall
    const typeIndex = levelNumber % 3;
    switch (typeIndex) {
        case 1: return 'basic';      // Levels 1, 4, 7, 10...
        case 2: return 'cave';       // Levels 2, 5, 8, 11...
        case 0: return 'pillaredHall'; // Levels 3, 6, 9, 12...
        default: return 'basic';
    }
}

/**
 * Generates the interior tile layout for a level (without border walls)
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height  
 * @param {number} levelNumber - Level number for deterministic generation
 * @returns {Object} - 2D tile map with generated interior tiles
 */
export function generateLevelTiles(MAP_WIDTH, MAP_HEIGHT, levelNumber) {
    const levelType = determineLevelType(levelNumber);
    
    // logger.debug(`Generating level ${levelNumber} (${levelType})`);
    
    // Generate level tiles based on type
    let levelTiles;
    if (levelType === 'cave') {
        levelTiles = generateCaveLayout(MAP_WIDTH, MAP_HEIGHT, levelNumber);
    } else if (levelType === 'pillaredHall') {
        levelTiles = generatePillaredHallLayout(MAP_WIDTH, MAP_HEIGHT, levelNumber);
    } else {
        levelTiles = generateBasicLayout(MAP_WIDTH, MAP_HEIGHT, levelNumber);
    }
    
    return { levelTiles, levelType };
}

/**
 * Creates a complete tile map with borders and interior tiles
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {number} levelNumber - Level number for generation
 * @returns {Object} - Complete 2D tile map ready for use
 */
export function createCompleteTileMap(MAP_WIDTH, MAP_HEIGHT, levelNumber) {
    const { levelTiles, levelType } = generateLevelTiles(MAP_WIDTH, MAP_HEIGHT, levelNumber);
    
    // logger.debug(`Generated tiles for level ${levelNumber}, applying to map...`);
    let tilesGenerated = 0;
    let tilesUndefined = 0;
    
    // Create the complete map with borders
    const map = {};
    for (let x = 0; x < MAP_WIDTH; x++) {
        map[x] = {};
        for (let y = 0; y < MAP_HEIGHT; y++) {
            if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
                map[x][y] = randomWallType(); // wall tile
            } else {
                if (levelTiles[x] && levelTiles[x][y]) {
                    map[x][y] = levelTiles[x][y]; // use generated level tile
                    tilesGenerated++;
                } else {
                    map[x][y] = TileTypes.dirt; // fallback tile (changed from randomFloorType for consistency)
                    tilesUndefined++;
                }
            }
        }
    }
    
    // logger.debug(`Level ${levelNumber} tiles: ${tilesGenerated} generated, ${tilesUndefined} undefined (fell back to default)`);
    
    return { map, levelType, tilesGenerated, tilesUndefined };
} 