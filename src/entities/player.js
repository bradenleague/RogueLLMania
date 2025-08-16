import { Actor, TurnResult } from './actor.js';
import { Stats } from '../combat/stats.js';
import { Faction } from '../combat/factions.js';
import * as logger from '../systems/logger.js';

export class Player extends Actor {
    constructor(x, y, visionRadius = 3) {
        super(x, y, '@', '#fff');
        this._actionQueue = [];
        this._pendingAction = null;
        this._world = null;
        
        // Combat stats
        this.stats = new Stats(10, 2, 0); // HP=10, Power=2, Defense=0
        this.faction = Faction.PLAYER;
        
        // Vision properties (radius only - visibility state moved to Room)
        this.visionRadius = visionRadius;
    }

    /**
     * Set the vision radius for this player
     * @param {number} radius - The vision radius
     */
    setVisionRadius(radius) {
        this.visionRadius = Math.max(1, radius);
        // logger.debug(`Player vision radius set to ${this.visionRadius}`);
    }

    /**
     * Get the current vision radius
     * @returns {number} - The current vision radius
     */
    getVisionRadius() {
        // Check for per-room vision settings from world if available
        if (this._world && this._world.getRoomVisionRadius) {
            const roomRadius = this._world.getRoomVisionRadius();
            if (roomRadius !== null) {
                return roomRadius;
            }
        }
        return this.visionRadius;
    }

    /**
     * Set the world reference for this player
     * @param {World} world - The world instance
     */
    setWorld(world) {
        this._world = world;
        // logger.debug('Player world reference set');
    }

    /**
     * Queue an action to be processed on the player's next turn
     * @param {Action} action - The action to queue
     */
    queueAction(action) {
        this._actionQueue.push(action);
        // logger.debug(`Action queued: ${action.constructor.name}`);
    }

    /**
     * Check if there are any pending actions queued or waiting
     * @returns {boolean} - True if an action is pending
     */
    hasPendingAction() {
        return !!this._pendingAction || this._actionQueue.length > 0;
    }

    /**
     * Called by the ROT.Engine when it's the player's turn
     * Processes the next queued action synchronously
     * @returns {TurnResult} - Whether the turn was consumed
     */
    act() {
        // Flush any batched redraws from monster turns at the start of player turn
        if (this._world && this._world.flushRedraw) {
            this._world.flushRedraw();
        }
        
        // If we have a pending action, process it
        if (this._pendingAction) {
            const action = this._pendingAction;
            this._pendingAction = null;
            
            const turnConsumed = this._processAction(action);
            return turnConsumed ? TurnResult.CONSUMED : TurnResult.NOT_CONSUMED;
        }
        
        // If we have more actions in queue, process the next one
        if (this._actionQueue.length > 0) {
            const action = this._actionQueue.shift();
            const turnConsumed = this._processAction(action);
            return turnConsumed ? TurnResult.CONSUMED : TurnResult.NOT_CONSUMED;
        }
        
        // If no actions are queued, lock the engine and wait for player input
        // logger.debug('No actions queued, locking engine for input');
        
        // Get the turn engine and lock it
        if (this._world && this._world.turnEngine) {
            this._world.turnEngine.lock();
        }
        
        return TurnResult.NOT_CONSUMED;
    }

    /**
     * Process a specific action using the command pattern
     * @param {Action} action - The action to process
     * @returns {boolean} - True if the action consumed a turn
     */
    _processAction(action) {
        if (!this._world) {
            logger.error('No world reference available for action processing');
            return false;
        }

        try {
            // Call the action's perform method with the world context
            const turnConsumed = action.perform(this._world);
            return turnConsumed;
        } catch (error) {
            logger.error(`Error processing action ${action.constructor.name}:`, error);
            return false; // Don't consume turn on error
        }
    }

    /**
     * Get the player's movement speed
     * @returns {number} - The player's speed
     */
    getSpeed() {
        return 1; // Slightly higher than monsters to ensure turn priority
    }

    /**
     * Check if this actor is the player
     * @returns {boolean} - Always true for Player class
     */
    isPlayer() {
        return true;
    }

    /**
     * Serialize the player state
     * @returns {Object} - Serialized player data
     */
    serialize() {
        return {
            x: this.x,
            y: this.y,
            type: 'player',
            visionRadius: this.visionRadius,
            stats: this.stats.serialize(),
            faction: this.faction
            // Note: visibility is now stored in Level objects
        };
    }

    /**
     * Restore player state from serialized data
     * @param {Object} data - Serialized player data
     */
    deserialize(data) {
        if (data.x !== undefined) this.x = data.x;
        if (data.y !== undefined) this.y = data.y;
        if (data.visionRadius !== undefined) this.visionRadius = data.visionRadius;
        
        // Restore combat stats
        if (data.stats) {
            this.stats.deserialize(data.stats);
        }
        if (data.faction !== undefined) {
            this.faction = data.faction;
        }

    }


} 