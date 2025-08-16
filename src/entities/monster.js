import { Actor, TurnResult } from './actor.js';
import { Stats } from '../combat/stats.js';
import { Faction } from '../combat/factions.js';
import { createBrain } from '../ai/brains/index.js';
import * as logger from '../systems/logger.js';

export class Monster extends Actor {
    constructor(x, y, glyph = 'm', color = '#ff0000') {
        super(x, y, glyph, color);
        
        // Data-driven properties (set by factory)
        this.typeId = 'unknown';
        this.name = 'Monster';
        this.speed = 1.0;
        this.tags = [];
        
        // Combat stats (defaults, usually overridden by factory)
        this.stats = new Stats(3, 1, 0); // HP=3, Power=1, Defense=0
        this.faction = Faction.ENEMY;
        
        // AI brain (delegates behavior)
        this.brain = createBrain('base'); // Default brain, usually overridden
        
        // Perception and AI state (used by brains)
        this.perceptionRadius = 6; // Manhattan distance "smell" radius
        this.isChasing = false; // Whether currently chasing the player
        this.lastKnownPlayerPos = null; // Last position where player was detected
        this.pathToPlayer = []; // Current path to player

        // LOS memory/decay
        this.searchTurns = 0;        // Turns remaining to investigate last known position
        this.maxSearchTurns = 6;     // How long the monster will search after losing LOS

        // Remember spawn (useful for future leash logic)
        this.spawn = { x, y };
        
        // Visual state
        this.baseColor = color; // Normal color
        this.chaseColor = color; // Chase color (usually set by factory)
    }
    
    /**
     * Determine if we have line-of-sight to a target. Prefer a world-provided
     * implementation. If none exists, fall back to "assume yes" so this
     * method is non-breaking until LOS is implemented in the world.
     */
    hasLOS(world, target) {
        if (world && typeof world.hasLOS === 'function') {
            return world.hasLOS(this.x, this.y, target.x, target.y);
        }
        // Fallback keeps current behavior (no LOS blocking) until provided.
        return true;
    }

    /**
     * Monster AI - delegates to the assigned brain
     */
    act(world) {
        if (!this.brain) {
            logger.warn(`Monster ${this.name} has no brain assigned`);
            return TurnResult.NOT_CONSUMED;
        }
        
        const result = this.brain.act(this, world);
        
        // Mark for batched redraw if the monster consumed a turn
        // This ensures the display updates after any monster action (movement, attack, etc.)
        if (result === TurnResult.CONSUMED && world && world.markDirty) {
            world.markDirty();
        }
        
        return result;
    }
    

    
    /**
     * Check if the monster can move to a specific position
     * @param {number} x - Target X coordinate
     * @param {number} y - Target Y coordinate
     * @param {Object} world - World instance
     * @returns {boolean} - True if movement is allowed
     */
    canMoveTo(x, y, world) {
        // Check if tile is passable
        if (!world.canMoveTo(x, y)) {
            return false;
        }
        
        // Check if player is at this position
        if (world.player && world.player.x === x && world.player.y === y) {
            return false;
        }
        
        // Check if another monster is at this position
        if (world.monsters && Array.isArray(world.monsters)) {
            for (const monster of world.monsters) {
                if (monster !== this && monster.x === x && monster.y === y) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Get the monster's movement speed
     * @returns {number} - The monster's speed
     */
    getSpeed() {
        return this.speed;
    }
    
    /**
     * Check if this actor is the player
     * @returns {boolean} - Always false for Monster class
     */
    isPlayer() {
        return false;
    }
    
    /**
     * Get the monster's current color based on its state
     * @returns {string} - Color string
     */
    getColor() {
        return this.isChasing ? this.chaseColor : this.baseColor;
    }
    
    /**
     * Serialize the monster state for save/load
     * @returns {Object} - Serialized monster data
     */
    serialize() {
        return {
            type: 'monster',
            typeId: this.typeId,
            name: this.name,
            x: this.x,
            y: this.y,
            symbol: this.symbol,
            color: this.color,
            stats: this.stats.serialize(),
            faction: this.faction,
            speed: this.speed,
            tags: [...this.tags],
            brainType: this.brain ? this.brain.name : 'base',
            perceptionRadius: this.perceptionRadius,
            isChasing: this.isChasing,
            lastKnownPlayerPos: this.lastKnownPlayerPos,
            pathToPlayer: this.pathToPlayer,
            searchTurns: this.searchTurns,
            maxSearchTurns: this.maxSearchTurns,
            spawn: this.spawn,
            baseColor: this.baseColor,
            chaseColor: this.chaseColor
        };
    }
    
    /**
     * Restore monster state from serialized data
     * @param {Object} data - Serialized monster data
     */
    deserialize(data) {
        // Restore basic properties
        if (data.typeId !== undefined) this.typeId = data.typeId;
        if (data.name !== undefined) this.name = data.name;
        if (data.x !== undefined) this.x = data.x;
        if (data.y !== undefined) this.y = data.y;
        if (data.symbol !== undefined) this.symbol = data.symbol;
        if (data.color !== undefined) this.color = data.color;
        if (data.faction !== undefined) this.faction = data.faction;
        if (data.speed !== undefined) this.speed = data.speed;
        if (data.tags !== undefined) this.tags = [...data.tags];
        
        // Restore combat stats
        if (data.stats) {
            this.stats.deserialize(data.stats);
        }
        
        // Restore brain
        if (data.brainType) {
            this.brain = createBrain(data.brainType);
        }
        
        // Restore AI state
        if (data.perceptionRadius !== undefined) this.perceptionRadius = data.perceptionRadius;
        if (data.isChasing !== undefined) this.isChasing = data.isChasing;
        if (data.lastKnownPlayerPos !== undefined) this.lastKnownPlayerPos = data.lastKnownPlayerPos;
        if (data.pathToPlayer !== undefined) this.pathToPlayer = data.pathToPlayer;
        if (data.searchTurns !== undefined) this.searchTurns = data.searchTurns;
        if (data.maxSearchTurns !== undefined) this.maxSearchTurns = data.maxSearchTurns;
        if (data.spawn !== undefined) this.spawn = data.spawn;
        
        // Restore visual state
        if (data.baseColor !== undefined) this.baseColor = data.baseColor;
        if (data.chaseColor !== undefined) this.chaseColor = data.chaseColor;
    }
} 