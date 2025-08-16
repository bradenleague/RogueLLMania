/**
 * Level class to manage per-level state including fog-of-war memory
 * This separates spatial memory from player entity logic
 */

import { generateBasicLayout } from "./generators/basicLevel.js";
import { generateCaveLayout } from "./generators/caveLevel.js";
import { generatePillaredHallLayout } from "./generators/pillaredHallLevel.js";
import { VisibilitySystem } from '../systems/visibilitySystem.js';
import { isTileTransparent } from '../tiles/tileTypes.js';
import * as logger from '../systems/logger.js';

export class Level {
    constructor(levelNumber, type = null) {
        this.levelNumber = levelNumber;
        this.type = type || this._determineLevelType(levelNumber);
        
        // Fog-of-war state - this is what should be serialized
        this.seenTiles = new Set();      // Tiles that have ever been seen (fog-of-war memory)
        this.visibleTiles = new Set();   // Currently visible tiles (recomputed each turn)
        
        // Level objects (could also be serialized)
        this.storyObject = null;
        this.staticObjects = [];
        this.portal = null;
        
        // Light sources - torches, lanterns, magical crystals, etc.
        this.lightSources = [];
        
        // Level generation is lazy - map data is generated when needed
        this.map = null;
        this.isGenerated = false;
        
        // VisibilitySystem - created when map is generated
        this.visibilitySystem = null;
        
        // logger.debug(`Created ${this.type} level ${levelNumber}`);
    }
    
    /**
     * Determine level type based on level number (matches existing logic)
     * @param {number} levelNumber - The level number
     * @returns {string} - 'basic' or 'cave'
     */
    _determineLevelType(levelNumber) {
        const isEvenLevel = levelNumber % 2 === 0;
        return isEvenLevel ? 'cave' : 'basic';
    }
    
    /**
     * Initialize VisibilitySystem for this level with external map data
     * Call this after the map has been generated externally
     * @param {Object} map - The generated map data
     * @param {number} MAP_WIDTH - Map width
     * @param {number} MAP_HEIGHT - Map height
     */
    initializeVisibilitySystem(map, MAP_WIDTH, MAP_HEIGHT) {
        if (this.visibilitySystem) {
            // logger.debug(`VisibilitySystem already exists for level ${this.levelNumber}`);
            return;
        }

        // Store reference to the map
        this.map = map;
        this.isGenerated = true;

        // Create VisibilitySystem for this level
        this.visibilitySystem = new VisibilitySystem(
            this,
            this._createTransparencyCallback(MAP_WIDTH, MAP_HEIGHT)
        );
        
        // logger.debug(`VisibilitySystem initialized for level ${this.levelNumber}`);
    }

    /**
     * Generate the level map if not already generated
     * @param {number} MAP_WIDTH - Map width
     * @param {number} MAP_HEIGHT - Map height
     * @returns {Object} - The generated map data
     */
    generateMap(MAP_WIDTH, MAP_HEIGHT) {
        if (this.isGenerated) {
            return this.map;
        }
        
        // logger.debug(`Generating ${this.type} level ${this.levelNumber}`);
        
        // Generate level tiles based on type
        let levelTiles;
        if (this.type === 'cave') {
            levelTiles = generateCaveLayout(MAP_WIDTH, MAP_HEIGHT, this.levelNumber);
        } else if (this.type === 'pillaredHall') {
            levelTiles = generatePillaredHallLayout(MAP_WIDTH, MAP_HEIGHT, this.levelNumber);
        } else {
            levelTiles = generateBasicLayout(MAP_WIDTH, MAP_HEIGHT, this.levelNumber);
        }
        
        this.map = levelTiles;
        this.isGenerated = true;
        
        // Create VisibilitySystem for this level
        this.visibilitySystem = new VisibilitySystem(
            this,
            this._createTransparencyCallback(MAP_WIDTH, MAP_HEIGHT)
        );
        
        // logger.debug(`Level ${this.levelNumber} generated with VisibilitySystem`);
        
        return this.map;
    }

    /**
     * Create transparency callback for this level's map
     * @param {number} MAP_WIDTH - Map width
     * @param {number} MAP_HEIGHT - Map height
     * @returns {Function} isTransparent(x, y) callback
     */
    _createTransparencyCallback(MAP_WIDTH, MAP_HEIGHT) {
        return (x, y) => {
            // Out of bounds is not transparent
            if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
                return false;
            }
            
            const tile = this.map[x] && this.map[x][y];
            if (!tile) {
                return false; // Empty/undefined tiles are not transparent
            }
            
            // Handle tile objects with properties
            return isTileTransparent(tile);
        };
    }
    
    /**
     * Update visibility for this level
     * @param {Set} newVisibleTiles - Set of currently visible tile keys "x,y"
     */
    updateVisibility(newVisibleTiles) {
        // Store current visibility
        this.visibleTiles = new Set(newVisibleTiles);
        
        // Add newly visible tiles to seen memory
        for (const tileKey of newVisibleTiles) {
            this.seenTiles.add(tileKey);
        }
        
        // logger.debug(`Level ${this.levelNumber}: ${this.visibleTiles.size} visible, ${this.seenTiles.size} total seen`);
    }
    
    /**
     * Check if a tile is currently visible
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} - True if currently visible
     */
    isVisible(x, y) {
        const key = `${x},${y}`;
        return this.visibleTiles.has(key);
    }
    
    /**
     * Check if a tile has ever been seen (for fog-of-war)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} - True if ever seen
     */
    hasSeenEver(x, y) {
        const key = `${x},${y}`;
        return this.seenTiles.has(key);
    }
    
    /**
     * Clear all visibility (useful for level transitions or resets)
     */
    clearVisibility() {
        this.visibleTiles.clear();
        // Note: seenTiles is preserved for fog-of-war memory
        if (this.visibilitySystem) {
            this.visibilitySystem.invalidateCache();
        }
        // logger.debug(`Cleared visibility for level ${this.levelNumber}`);
    }

    /**
     * Update visibility using the modern VisibilitySystem
     * @param {Array} actors - Array of actors with vision (typically just player)
     * @returns {Object} { visible: Set, delta: {lit: Set, dark: Set} }
     */
    updateVisibilityModern(actors = []) {
        if (!this.visibilitySystem) {
            logger.warn(`No VisibilitySystem for level ${this.levelNumber}`);
            return { visible: new Set(), delta: { lit: new Set(), dark: new Set() } };
        }

        return this.visibilitySystem.updateLevelVisibility(actors, this.lightSources);
    }

    /**
     * Check if one actor can see another using the VisibilitySystem
     * @param {Object} viewer - The actor doing the looking
     * @param {Object} target - The actor being looked at
     * @returns {boolean} True if viewer can see target
     */
    canActorSeeTarget(viewer, target) {
        if (!this.visibilitySystem) {
            return false;
        }
        return this.visibilitySystem.canActorSeeTarget(viewer, target);
    }

    /**
     * Get actors visible to a viewer (for AI)
     * @param {Object} viewer - The actor doing the looking
     * @param {Array} targets - Array of potential targets
     * @returns {Array} Array of visible targets
     */
    getVisibleActors(viewer, targets) {
        if (!this.visibilitySystem) {
            return [];
        }
        return this.visibilitySystem.getVisibleActors(viewer, targets);
    }
    
    /**
     * Add a light source to this level
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate  
     * @param {number} radius - Light radius
     * @param {string} type - Type of light source ('torch', 'lantern', 'crystal', etc.)
     */
    addLightSource(x, y, radius, type = 'torch') {
        const lightSource = { x, y, radius, type };
        this.lightSources.push(lightSource);
        // logger.debug(`Added ${type} light source at (${x}, ${y}) with radius ${radius} to level ${this.levelNumber}`);
        return lightSource;
    }
    
    /**
     * Remove a light source from this level
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} - True if a light source was removed
     */
    removeLightSource(x, y) {
        const initialLength = this.lightSources.length;
        this.lightSources = this.lightSources.filter(light => !(light.x === x && light.y === y));
        const removed = this.lightSources.length < initialLength;
        
        if (removed) {
            // logger.debug(`Removed light source at (${x}, ${y}) from level ${this.levelNumber}`);
        }
        
        return removed;
    }
    
    /**
     * Get all light sources on this level
     * @returns {Array} - Array of light source objects
     */
    getLightSources() {
        return [...this.lightSources]; // Return a copy to prevent external modification
    }
    
    /**
     * Find light sources within a certain distance of a point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} maxDistance - Maximum distance to search
     * @returns {Array} - Array of nearby light sources
     */
    getNearbyLightSources(x, y, maxDistance) {
        return this.lightSources.filter(light => {
            const distance = Math.sqrt(Math.pow(light.x - x, 2) + Math.pow(light.y - y, 2));
            return distance <= maxDistance;
        });
    }
    
    /**
     * Mark entire level as visible (for basic levels that should be fully discovered)
     * @param {number} MAP_WIDTH - Map width
     * @param {number} MAP_HEIGHT - Map height
     */
    discoverEntireLevel(MAP_WIDTH, MAP_HEIGHT) {
        // logger.debug(`Fully discovering level ${this.levelNumber} (${this.type})`);
        
        // Mark all tiles as both seen and visible
        for (let x = 0; x < MAP_WIDTH; x++) {
            for (let y = 0; y < MAP_HEIGHT; y++) {
                const key = `${x},${y}`;
                this.visibleTiles.add(key);
                this.seenTiles.add(key);
            }
        }
        
        // logger.debug(`Level ${this.levelNumber} fully discovered: ${this.seenTiles.size} tiles`);
    }
    
    /**
     * Get debug information about level visibility state
     * @returns {Object} - Debug information
     */
    getDebugInfo() {
        return {
            levelNumber: this.levelNumber,
            levelType: this.type,
            visibleTiles: this.visibleTiles.size,
            seenTiles: this.seenTiles.size,
            isGenerated: this.isGenerated,
            hasObjects: {
                storyObject: !!this.storyObject,
                staticObjects: this.staticObjects.length,
                portal: !!this.portal
            }
        };
    }
    
    /**
     * Serialize level for save/load functionality
     * @returns {Object} - Serialized level data
     */
    serialize() {
        return {
            levelNumber: this.levelNumber,
            type: this.type,
            seenTiles: Array.from(this.seenTiles),  // Convert Set to Array for JSON
            lightSources: [...this.lightSources],   // Save light sources
            // Note: visibleTiles is not serialized - it's recomputed on load
            // Level objects could also be serialized here if needed
            isGenerated: this.isGenerated
        };
    }
    
    /**
     * Restore level state from serialized data
     * @param {Object} data - Serialized level data
     */
    deserialize(data) {
        if (data.levelNumber !== undefined) this.levelNumber = data.levelNumber;
        if (data.type !== undefined) this.type = data.type;
        if (data.isGenerated !== undefined) this.isGenerated = data.isGenerated;
        
        if (data.seenTiles) {
            this.seenTiles = new Set(data.seenTiles); // Convert Array back to Set
            // logger.debug(`Restored level ${this.levelNumber}: ${this.seenTiles.size} previously seen tiles`);
        }
        
        // Restore light sources
        if (data.lightSources) {
            this.lightSources = [...data.lightSources];
            // logger.debug(`Restored level ${this.levelNumber}: ${this.lightSources.length} light sources`);
        }
        
        // visibleTiles will be recomputed when FOV runs
        this.visibleTiles.clear();
    }
} 