import { incrementTurn, getTurn } from './gameState.js';
import { TurnResult } from '../entities/actor.js';
import { Events, getEventBus } from './eventBus.js';
import * as logger from './logger.js';

/**
 * Turn-based engine using ROT.Scheduler.Speed and ROT.Engine
 * Manages all actors and their turns using ROT.Engine.start()
 */
export class TurnEngine {
    constructor() {
        this.scheduler = new ROT.Scheduler.Speed();
        this.engine = new ROT.Engine(this.scheduler);
        this.actors = new Set();
        this.isRunning = false;
        this.playerActor = null;
        this.world = null; // Reference to world for passing to actors
        this.actorWrapperMap = new Map(); // Map original actors to their wrapped versions
        
        // Override the engine's lock/unlock to add logging
        const originalLock = this.engine.lock.bind(this.engine);
        const originalUnlock = this.engine.unlock.bind(this.engine);
        
        this.engine.lock = () => {
            originalLock();
        };
        
        this.engine.unlock = () => {
            originalUnlock();
        };
    }

    /**
     * Add an actor to the turn system
     * @param {Actor} actor - The actor to add
     */
    addActor(actor) {
        this.actors.add(actor);
        
        // Wrap the actor's act method to handle turn incrementing and error catching
        const originalAct = actor.act.bind(actor);
        const wrappedActor = {
            act: () => {
                const turn = getTurn();
                logger.startTurn(turn);
                
                try {
                    // Pass world reference to actor's act method
                    const result = originalAct(this.world);
                    
                    // Only increment turn if the action was consumed
                    if (result === TurnResult.CONSUMED) {
                        incrementTurn();
                        const currentTurn = getTurn();
                        
                        // Log turn completion and emit event
                        logger.endTurn(currentTurn, actor._pendingAction);
                        const eventBus = getEventBus();
                        eventBus.emit(Events.TURN_COMPLETED, currentTurn);
                    } else {
                        // Turn not consumed, continue waiting for input
                    }
                    
                    return result;
                } catch (error) {
                    logger.error(`Error processing turn for ${actor.constructor.name}:`, error);
                    // Don't increment turn on error
                    return TurnResult.NOT_CONSUMED;
                }
            },
            getSpeed: () => actor.getSpeed(),
            isPlayer: () => actor.isPlayer(),
            serialize: () => actor.serialize()
        };
        
        this.scheduler.add(wrappedActor, true); // true means recurring
        
        // Keep track of the mapping for removal
        this.actorWrapperMap.set(actor, wrappedActor);
        
        if (actor.isPlayer()) {
            this.playerActor = actor;
        }
        
        // logger.debug(`Added actor: ${actor.constructor.name} at speed ${actor.getSpeed()}`);
    }

    /**
     * Remove an actor from the turn system
     * @param {Actor} actor - The actor to remove
     */
    removeActor(actor) {
        this.actors.delete(actor);
        
        // Remove the wrapped actor from the scheduler
        const wrappedActor = this.actorWrapperMap.get(actor);
        if (wrappedActor) {
            this.scheduler.remove(wrappedActor);
            this.actorWrapperMap.delete(actor);
            // logger.debug(`Removed wrapped actor from scheduler: ${actor.constructor.name}`);
        } else {
            logger.warn(`Could not find wrapped actor for removal: ${actor.constructor.name}`);
        }
        
        if (actor === this.playerActor) {
            this.playerActor = null;
        }
        
        // logger.debug(`Removed actor: ${actor.constructor.name}`);
    }

    /**
     * Get all actors in the system
     * @returns {Set<Actor>}
     */
    getActors() {
        return new Set(this.actors);
    }

    /**
     * Get the player actor
     * @returns {Actor|null}
     */
    getPlayer() {
        return this.playerActor;
    }

    /**
     * Start the turn engine
     */
    start() {
        if (this.isRunning) {
            logger.warn('Turn engine already running');
            return;
        }
        
        this.isRunning = true;
        logger.info('Turn engine started');
        this.engine.start();
    }

    /**
     * Stop the turn engine
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('Turn engine already stopped');
            return;
        }
        
        this.isRunning = false;
        logger.info('Turn engine stopped');
        this.engine.lock();
    }

    /**
     * Check if the player has a pending action
     * @returns {boolean}
     */
    hasPlayerAction() {
        return this.playerActor?.hasPendingAction?.() || false;
    }

    /**
     * Queue an action for the player actor
     * @param {Action} action - The action to queue
     */
    queuePlayerAction(action) {
        if (!this.playerActor) {
            logger.error('No player actor available for action queueing');
            return;
        }
        
        this.playerActor.queueAction(action);
        // logger.debug(`Queued action for player: ${action.constructor.name}`);
        this.engine.unlock();
    }

    /**
     * Get the current turn number
     * @returns {number}
     */
    getCurrentTurn() {
        return getTurn();
    }

    /**
     * Reset the turn engine (useful for loading games)
     */
    reset() {
        this.stop();
        
        // Clear all actors using proper removal
        for (const actor of Array.from(this.actors)) {
            this.removeActor(actor);
        }
        this.actors.clear();
        this.actorWrapperMap.clear();
        this.playerActor = null;
        
        // Create new scheduler and engine
        this.scheduler = new ROT.Scheduler.Speed();
        this.engine = new ROT.Engine(this.scheduler);
        
        // Re-apply the lock/unlock overrides
        const originalLock = this.engine.lock.bind(this.engine);
        const originalUnlock = this.engine.unlock.bind(this.engine);
        
        this.engine.lock = () => {
            originalLock();
        };
        
        this.engine.unlock = () => {
            originalUnlock();
        };
    }

    /**
     * Pause the engine (like stop but preserves state)
     */
    pause() {
        if (this.isRunning) {
            this.engine.lock();
            // logger.debug('Engine paused');
        }
    }

    /**
     * Resume the engine (if it was paused)
     */
    resume() {
        if (this.isRunning) {
            this.engine.unlock();
            // logger.debug('Engine resumed');
        }
    }

    /**
     * Lock the engine
     */
    lock() {
        this.engine.lock();
    }

    /**
     * Unlock the engine
     */
    unlock() {
        this.engine.unlock();
    }
    
    /**
     * Set the world reference for passing to actors
     * @param {World} world - The world instance
     */
    setWorld(world) {
        this.world = world;
        // logger.debug('Turn engine world reference set');
    }
}

/**
 * Initialize the turn engine with a player actor
 * @param {Actor} player - The player actor
 * @param {World} world - The world instance (optional, can be set later)
 * @returns {TurnEngine} - The initialized turn engine
 */
export function initializeTurnEngine(player, world = null) {
    const turnEngine = new TurnEngine();
    turnEngine.addActor(player);
    
    if (world) {
        turnEngine.setWorld(world);
    }
    
    // Make the turn engine globally available (needed for input system)
    if (typeof window !== 'undefined') {
        window.turnEngineInstance = turnEngine;
    }
    
    logger.info('Turn engine initialized');
    return turnEngine;
} 