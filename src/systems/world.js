/**
 * World/Services object that provides all game functionality to actions
 * Now manages Level instances with per-level fog-of-war state
 */
import { isTilePassable } from '../tiles/index.js';
import { trackPlayerMovement } from './gameState.js';
import { checkForInteraction, tryPickupItem } from '../entities/storyObject.js';
import { checkHealthPotionInteraction, tryPickupHealthPotion } from '../entities/healthPotion.js';
import { determineLevelType } from '../levels/tileGeneration.js';
import { Level } from '../levels/level.js';
import { placeTorchesOnLevel } from '../levels/entityPlacement.js';
import { Monster } from '../entities/monster.js'; // Import Monster synchronously
import * as logger from './logger.js';
import { Events } from './eventBus.js';

export class World {
    constructor() {
        // Core references
        this.player = null;
        this.map = null;
        this.messageBus = null;
        this.drawFunction = null; // Direct reference to draw function
        
        // Game state
        this.currentLevel = 1;
        this.storyObject = null;
        this.staticObjects = [];
        this.portal = null;
        this.monsters = []; // Track monsters in the current level
        
        // Level management - NEW!
        this.levels = new Map(); // Map of levelNumber -> Level instance
        this.currentLevelInstance = null;
        
        // Constants for map dimensions (should be injected eventually)
        this.MAP_WIDTH = 40;  // TODO: Make this configurable
        this.MAP_HEIGHT = 20;
        
        // Batched rendering system
        this.needsRedraw = false;
    }

    /**
     * Initialize the world with all necessary references
     * @param {Object} config - Configuration object with all references
     */
    initialize({
        player,
        map,
        messageBus,
        turnEngine,
        drawFunction,
        currentLevel = 1,
        storyObject = null,
        staticObjects = [],
        portal = null,
        monsters = [],
        MAP_WIDTH = 40,
        MAP_HEIGHT = 20
    }) {
        this.player = player;
        this.map = map;
        this.messageBus = messageBus;
        this.turnEngine = turnEngine;
        this.drawFunction = drawFunction;
        this.currentLevel = currentLevel;
        this.storyObject = storyObject;
        this.staticObjects = staticObjects;
        this.portal = portal;
        this.monsters = monsters;
        this.MAP_WIDTH = MAP_WIDTH;
        this.MAP_HEIGHT = MAP_HEIGHT;
        
        // Initialize current level instance
        this.currentLevelInstance = this.getOrCreateLevel(currentLevel);
        
        // logger.debug('World initialized');
    }

    /**
     * Update world state (called when level changes, etc.)
     * @param {Object} updates - Object containing updated state
     */
    update(updates) {
        const oldLevel = this.currentLevel;
        
        // Log what's being updated for debugging
        // logger.debug(`[WORLD UPDATE] Updating world with:`, {
        //     hasMap: !!(updates.map),
        //     hasMonsters: !!(updates.monsters),
        //     monstersCount: updates.monsters ? updates.monsters.length : 0,
        //     currentLevel: updates.currentLevel
        // });
        
        Object.assign(this, updates);
        
        // Debug: Check if monsters were actually assigned
        if (updates.monsters !== undefined) {
            // logger.debug(`[WORLD UPDATE] Monsters updated: ${this.monsters.length} monsters now in world`);
        }
        
        // If currentLevel is being updated, always update the level instance
        // (even if it's the same level number, we might need to reinitialize)
        if (updates.currentLevel !== undefined) {
            // logger.debug(`[WORLD UPDATE] Updating level instance to level ${updates.currentLevel}`);
            this.currentLevelInstance = this.getOrCreateLevel(updates.currentLevel);
            
            // Initialize VisibilitySystem with the current map data if map exists
            if (this.map && this.MAP_WIDTH && this.MAP_HEIGHT) {
                this.currentLevelInstance.initializeVisibilitySystem(this.map, this.MAP_WIDTH, this.MAP_HEIGHT);
            }
            
            // logger.debug(`[WORLD UPDATE] Level instance updated - has ${this.currentLevelInstance.seenTiles.size} seen tiles`);
        }
        
        // logger.debug('World state updated');
    }

    /**
     * Get or create a Level instance for the given level number
     * @param {number} levelNumber - Level number
     * @returns {Level} - Level instance
     */
    getOrCreateLevel(levelNumber) {
        if (!this.levels.has(levelNumber)) {
            const level = new Level(levelNumber);
            this.levels.set(levelNumber, level);
            // logger.debug(`Level ${levelNumber} created`);
        } else {
            // logger.debug(`Level ${levelNumber} reused`);
        }
        return this.levels.get(levelNumber);
    }

    /**
     * Get the current level instance for external use (e.g., renderer)
     * @returns {Level} - Current level instance
     */
    getCurrentLevelInstance() {
        return this.currentLevelInstance;
    }

    /**
     * Clear all level instances and their fog-of-war state
     * Used when restarting the game to ensure fresh exploration
     */
    clearAllLevels() {
        this.levels.clear();
        this.currentLevelInstance = null;
        logger.debug('All level instances and fog-of-war state cleared');
    }

    /**
     * Initialize FOV for the current level
     * Uses the new pure FOV service and Level-based state management
     */
    initializeFOV() {
        if (!this.currentLevelInstance || !this.player) {
            logger.error('Cannot initialize FOV: missing level or player');
            return;
        }

        // logger.debug(`[FOV INIT] Starting FOV init for level ${this.currentLevel} - player at (${this.player.x}, ${this.player.y})`);
        
        // Clear level visibility when entering (simulates "entering a new level")
        this.currentLevelInstance.clearVisibility();
        // logger.debug(`[FOV INIT] Cleared visibility`);
        
        // Use the new VisibilitySystem for modern FOV computation
        if (this.currentLevelInstance.visibilitySystem) {
            const visibilityResult = this.currentLevelInstance.updateVisibilityModern([this.player]);
            const levelType = determineLevelType(this.currentLevel);
            const shouldFullyDiscover = (levelType === 'basic');
            

            
            // Handle level-specific fog of war policies
            if (shouldFullyDiscover) {
                // For basic levels: discover all tiles for fog of war memory, but limit current visibility

                for (let x = 0; x < this.MAP_WIDTH; x++) {
                    for (let y = 0; y < this.MAP_HEIGHT; y++) {
                        const key = `${x},${y}`;
                        this.currentLevelInstance.seenTiles.add(key);
                    }
                }

            } else {
                // Cave/pillared levels: seenTiles already updated by VisibilitySystem

            }
        } else {
            logger.error(`[FOV INIT] No VisibilitySystem available for level ${this.currentLevel}`);
            return;
        }
        
        // logger.debug(`[FOV INIT] FOV initialization complete for level ${this.currentLevel}`);
    }

    /**
     * Recompute FOV after player movement
     * Uses the new VisibilitySystem with fallback to legacy
     */
    recomputeFOV() {
        if (!this.currentLevelInstance || !this.player) {
            logger.error('Cannot recompute FOV: missing level or player');
            return;
        }

        // logger.debug(`[FOV RECOMPUTE] Recomputing FOV for level ${this.currentLevel} - player at (${this.player.x}, ${this.player.y})`);
        
        // Note: Monsters are considered for visibility calculation if present
        
        // Use the new VisibilitySystem for modern FOV computation
        if (this.currentLevelInstance.visibilitySystem) {
            const visibilityResult = this.currentLevelInstance.updateVisibilityModern([this.player]);
            const levelType = determineLevelType(this.currentLevel);
            const shouldFullyDiscover = (levelType === 'basic');
            

            
            // Handle level-specific fog of war policies
            if (shouldFullyDiscover) {
                // For basic levels: seenTiles should already be fully populated from initialization
                // VisibilitySystem handles current visibility automatically
            } else {
                // Cave/pillared levels: VisibilitySystem handles both current and seen tiles
            }
            
            // Handle visibility changes for effects/animations
            if (visibilityResult.delta.lit.size > 0) {
                // logger.debug(`[FOV RECOMPUTE] Player discovered ${visibilityResult.delta.lit.size} new areas`);
                // Future: trigger discovery effects, sounds, etc.
            }
        } else {
            logger.error(`[FOV RECOMPUTE] No VisibilitySystem available for level ${this.currentLevel}`);
            return;
        }
    }

    /**
     * Get current level number
     * @returns {number} - Current level number
     */
    getCurrentLevel() {
        return this.currentLevel;
    }

    // ===== FOV METHODS =====

    /**
     * Check if the player can move to a position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} - True if movement is allowed
     */
    canMoveTo(x, y) {
        // Bounds check
        if (x < 0 || x >= this.MAP_WIDTH || y < 0 || y >= this.MAP_HEIGHT) {
            return false;
        }

        const tile = this.map[x] && this.map[x][y];
        if (!tile) {
            return false;
        }

        // Handle tile objects with passability properties
        return isTilePassable(tile);
    }

    /**
     * Check for portal interaction at given coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} - True if portal interaction occurs
     */
    checkPortalInteraction(x, y) {
        return this.portal && this.portal.x === x && this.portal.y === y;
    }

    /**
     * Track player movement (delegates to gameState)
     * @param {number} newX - New X position
     * @param {number} newY - New Y position
     * @param {number} oldX - Old X position
     * @param {number} oldY - Old Y position
     */
    trackPlayerMovement(newX, newY, oldX, oldY) {
        trackPlayerMovement(newX, newY, oldX, oldY);
    }

    /**
     * Check for interactions at the given position (shows messages only, doesn't pick up)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    checkInteractionsAt(x, y) {
        // Check story object interaction (just show message)
        if (this.storyObject) {
            checkForInteraction(x, y, this.storyObject, this.map, this.MAP_WIDTH, this.MAP_HEIGHT, this.player, this);
        }
        
        // Check health potion interactions (just show message)
        checkHealthPotionInteraction(x, y, this.staticObjects, this.messageBus);
    }

    /**
     * Try to pick up an item at the player's current position (called when 'G' is pressed)
     * @returns {boolean} - True if something was picked up
     */
    tryPickup() {
        const playerX = this.player.x;
        const playerY = this.player.y;
        let pickedUpSomething = false;

        // Try story object first
        if (this.storyObject && this.storyObject.x === playerX && this.storyObject.y === playerY && !this.storyObject.pickedUp) {
            tryPickupItem(playerX, playerY, this.storyObject, this.map, this.MAP_WIDTH, this.MAP_HEIGHT, this.player, this);
            pickedUpSomething = true;
        }
        
        // Try health potions
        const potion = this.staticObjects.find(obj => obj.x === playerX && obj.y === playerY && !obj.pickedUp);
        if (potion) {
            tryPickupHealthPotion(playerX, playerY, this.staticObjects, this.map, this.MAP_WIDTH, this.MAP_HEIGHT, this.player, this);
            pickedUpSomething = true;
        }

        if (!pickedUpSomething) {
            this.messageBus.emit(Events.MESSAGE_TYPED, { text: "There's nothing here to pick up.", type: 'system' });
        }

        return pickedUpSomething;
    }

    /**
     * Kill an actor - remove from turn engine and level entities
     * @param {Actor} actor - The actor to kill
     */
    kill(actor) {
        // Remove from turn engine
        if (this.turnEngine) {
            this.turnEngine.removeActor(actor);
        }
        
        // Remove from current level's entity list if it maintains one
        if (this.currentLevelInstance && this.currentLevelInstance.entities) {
            const index = this.currentLevelInstance.entities.indexOf(actor);
            if (index !== -1) {
                this.currentLevelInstance.entities.splice(index, 1);
            }
        }
        
        // If it's a monster, remove from monsters array 
        if (this.monsters && Array.isArray(this.monsters)) {
            const index = this.monsters.indexOf(actor);
            if (index !== -1) {
                this.monsters.splice(index, 1);
            }
        }
        
        // logger.debug(`Killed ${actor.constructor.name} at (${actor.x}, ${actor.y})`);
    }

    /**
     * Request a redraw of the game display
     * Replaces the old event-based GAME_DRAW system with direct function call
     */
    requestRedraw() {
        if (this.drawFunction) {
            this.drawFunction();
        } else {
            logger.warn('No draw function available for redraw request');
        }
    }

    /**
     * Mark that the display needs to be redrawn (batched rendering)
     * Use this instead of requestRedraw() for non-critical updates
     */
    markDirty() {
        this.needsRedraw = true;
    }

    /**
     * Execute a batched redraw if one is pending
     * Should be called at natural batching boundaries (end of turn cycles)
     */
    flushRedraw() {
        if (this.needsRedraw) {
            this.needsRedraw = false;
            if (this.drawFunction) {
                this.drawFunction();
            } else {
                logger.warn('No draw function available for batched redraw flush');
            }
        }
    }

    /**
     * Begin transition to the specified level, pausing the turn engine during load
     * @param {number} nextLevel - Level number to load
     */
    async beginLevelTransition(nextLevel) {
        if (this.turnEngine) {
            this.turnEngine.pause();
        }

        await this.loadLevel(nextLevel);
        this.initializeFOV();

        if (this.turnEngine) {
            this.turnEngine.resume();
        }
    }

    /**
     * Load a new level
     * @param {number} levelNumber - Level number to load
     */
    loadLevel(levelNumber) {
        // Note: Still using dynamic import to avoid circular dependency with game.js
        // This returns the underlying loadLevel promise for awaiting.
        return import('../game.js').then(({ loadLevel }) => {
            return loadLevel(levelNumber);
        });
    }

    // ===== SERIALIZATION =====

    /**
     * Serialize world state for save/load functionality
     * @returns {Object} - Serialized world data
     */
    serialize() {
        const serializedLevels = {};
        
        // Serialize all level instances
        for (const [levelNumber, level] of this.levels.entries()) {
            serializedLevels[levelNumber] = level.serialize();
        }
        
        // Serialize monsters
        const serializedMonsters = this.monsters.map(monster => monster.serialize());
        
        return {
            currentLevel: this.currentLevel,
            levels: serializedLevels,
            monsters: serializedMonsters
        };
    }

    /**
     * Restore world state from serialized data
     * @param {Object} data - Serialized world data
     */
    deserialize(data) {
        if (data.currentLevel !== undefined) {
            this.currentLevel = data.currentLevel;
        }

        if (data.levels) {
            // Restore level instances
            this.levels.clear();
            for (const [levelNumber, levelData] of Object.entries(data.levels)) {
                const level = new Level(parseInt(levelNumber));
                level.deserialize(levelData);
                this.levels.set(parseInt(levelNumber), level);
            }

            // Update current level instance
            this.currentLevelInstance = this.getOrCreateLevel(this.currentLevel);
            
            // logger.debug(`Restored ${this.levels.size} levels from save data`);
        }
        
        // Restore monsters
        if (data.monsters) {
            this.monsters = [];
            for (const monsterData of data.monsters) {
                const monster = new Monster(monsterData.x, monsterData.y);
                monster.deserialize(monsterData);
                this.monsters.push(monster);
            }
            // logger.debug(`Restored ${this.monsters.length} monsters from save data`);
        }
    }
    
    /**
     * Place torch light sources on the current level
     * Should be called after level generation is complete
     */
    placeTorchesOnCurrentLevel() {
        if (!this.currentLevelInstance || !this.map || !this.player) {
            logger.warn('Cannot place torches: missing level instance, map, or player');
            return;
        }
        
        // Check if torches are already placed on this level
        if (this.currentLevelInstance.getLightSources().length > 0) {
            // logger.debug(`Level ${this.currentLevel} already has ${this.currentLevelInstance.getLightSources().length} light sources`);
            return;
        }
        
        placeTorchesOnLevel(
            this.map, 
            this.MAP_WIDTH, 
            this.MAP_HEIGHT, 
            this.currentLevelInstance, 
            this.currentLevel, 
            this.player
        );
        
        // logger.debug(`Placed torches on level ${this.currentLevel}`);
    }
}

// ===== SINGLETON PATTERN =====

let worldInstance = null;

/**
 * Get the singleton world instance
 * @returns {World} - The world instance
 */
export function getWorld() {
    if (!worldInstance) {
        worldInstance = new World();
    }
    return worldInstance;
}

/**
 * Initialize the world singleton
 * @param {Object} config - Configuration object
 * @returns {World} - The initialized world instance
 */
export function initializeWorld(config) {
    const world = getWorld();
    world.initialize(config);
    return world;
} 