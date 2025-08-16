/**
 * Game Initialization System
 * Centralized initialization for the action/command pattern system
 */

import { Player } from '../entities/player.js';
import { initializeTurnEngine } from './turnEngine.js';
import { getEventBus, initializeEventListeners } from './eventBus.js';
import { getWorld, initializeWorld } from './world.js';

import * as logger from './logger.js';

/**
 * Initialize the entire game system with proper dependency injection
 * @param {Object} gameContext - Game context containing map, objects, etc.
 * @param {Function} drawFunction - Optional draw function for direct rendering
 * @returns {Object} - Initialized game systems
 */
export function initializeGameSystems(gameContext, drawFunction = null) {
    // Configure logger: check for --log-level argument passed from main process
    let level = logger.LEVELS.DEBUG;
    
    // Check process.argv for log level (passed from main process)
    if (typeof process !== 'undefined' && process.argv) {
        for (const arg of process.argv) {
            if (arg.startsWith('--log-level=')) {
                let lvl = arg.split('=')[1];
                // Accept both string (DEBUG) and numeric (3) values
                if (!isNaN(lvl)) {
                    level = Number(lvl);
                } else {
                    lvl = lvl.toUpperCase();
                    if (logger.LEVELS[lvl] !== undefined) {
                        level = logger.LEVELS[lvl];
                    }
                }
                break;
            }
        }
    }
    
    // Also check environment variable as fallback
    if (typeof process !== 'undefined' && process.env && process.env.LOG_LEVEL) {
        let lvl = process.env.LOG_LEVEL;
        // Accept both string (DEBUG) and numeric (3) values
        if (!isNaN(lvl)) {
            level = Number(lvl);
        } else {
            lvl = lvl.toUpperCase();
            if (logger.LEVELS[lvl] !== undefined) {
                level = logger.LEVELS[lvl];
            }
        }
    }
    
    logger.configure({
        level,
        turnMetricsInterval: 50, // Log metrics every 50 turns
        enableMetrics: true
    });
    
    // Log the configured level for debugging
    logger.info(`Logger level: ${Object.keys(logger.LEVELS).find(k => logger.LEVELS[k] === level)}`);
    
    logger.info('Initializing game systems...');
    
    // 1. Initialize Event Bus
    const messageBus = getEventBus();
    initializeEventListeners(messageBus);
    
    // 2. Create Player
    const player = new Player(gameContext.playerX || 1, gameContext.playerY || 1);
    
    // 3. Initialize Turn Engine (without world initially)
    const turnEngine = initializeTurnEngine(player);
    
    // 4. Initialize World with all services and references
    const world = initializeWorld({
        player: player,
        map: gameContext.map,
        messageBus: messageBus,
        turnEngine: turnEngine,
        drawFunction: drawFunction,
        currentLevel: gameContext.currentLevel || 1,
        storyObject: gameContext.storyObject,
        staticObjects: gameContext.staticObjects || [],
        portal: gameContext.portal,
        monsters: gameContext.monsters || [],
        MAP_WIDTH: gameContext.MAP_WIDTH || 40,
        MAP_HEIGHT: gameContext.MAP_HEIGHT || 20
    });
    
    // 5. Connect world to turn engine (CRITICAL for monster AI!)
    turnEngine.setWorld(world);
    
    // 6. Connect player to world (CRITICAL!)
    player.setWorld(world);
    
    // 7. Add batched redraw system (CRITICAL for performance!)
    // Instead of flushing on every TURN_COMPLETED (which happens per actor),
    // we'll flush redraws when the player's turn starts (which happens once per cycle)
    
    // 8. Connect turn engine to world for debugging
    if (typeof window !== 'undefined') {
        window.turnEngineInstance = turnEngine;
    }
    
    logger.info('Game systems initialized');
    
    return {
        player,
        turnEngine,
        world,
        messageBus
    };
}