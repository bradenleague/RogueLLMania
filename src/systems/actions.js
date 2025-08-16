/**
 * Action system implementing the Command Pattern
 * Each action encapsulates a single player action that can be performed
 * 
 * IMPORTANT: Actions handle core game logic directly and synchronously.
 * Events are ONLY used for UI/telemetry boundaries, not game flow.
 */

import { Events } from './eventBus.js';
import { resolveMelee } from '../combat/melee.js';
import { areFactionsHostile } from '../combat/factions.js';
import * as logger from './logger.js';

/**
 * Base class for all actions in the game
 */
export class Action {
    /**
     * Perform the action in the given world context
     * @param {World} world - The world context
     * @returns {boolean} - True if the action consumed a turn
     */
    perform(world) {
        logger.error('Action.perform() called on base class');
        return false;
    }
}

/**
 * Action for player movement
 */
export class MoveAction extends Action {
    constructor(direction) {
        super();
        this.direction = direction;
    }

    perform(world) {
        const player = world.player;
        const oldX = player.x;
        const oldY = player.y;
        
        // Calculate new position based on direction
        const { newX, newY } = this.calculateNewPosition(oldX, oldY, this.direction);
        
        // Invalid direction
        if (newX === oldX && newY === oldY) {
            logger.warn(`Invalid move direction: ${this.direction}`);
            return false;
        }

        // Check if there's a monster at the target position
        if (world.monsters && Array.isArray(world.monsters)) {
            const targetMonster = world.monsters.find(monster => 
                monster.x === newX && monster.y === newY && monster.stats.isAlive()
            );
            
            if (targetMonster && areFactionsHostile(player.faction, targetMonster.faction)) {
                // Attack the monster instead of moving
                const combatResult = resolveMelee(player, targetMonster, world);
                
                // If monster died, remove it from the world
                if (combatResult.targetDied) {
                    world.kill(targetMonster);
                }
                
                // logger.debug(`Combat: ${combatResult.damage} damage`);
                
                // UI boundary: trigger redraw to update display
                world.requestRedraw();
                
                return true; // Attack consumes turn
            }
        }

        // Check if diagonal movement is blocked by walls
        if (this.isDiagonalMove(this.direction)) {
            if (!this.canMoveDiagonally(world, oldX, oldY, newX, newY)) {
                // UI boundary: blocked diagonal move message
                world.messageBus.emit(Events.MESSAGE_TYPED, { text: "Diagonal path is blocked!", type: 'warn' });
                return false;
            }
        }

        // Core game logic: handle movement directly (no events)
        if (world.canMoveTo(newX, newY)) {
            // Check for portal interaction
            if (world.checkPortalInteraction(newX, newY)) {
                const nextLevelNumber = world.getCurrentLevel() + 1;

            // UI boundary: notify player of level transition
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: `Moving to level ${nextLevelNumber}...`, type: 'system' });

                // Core logic: begin level transition
                world.beginLevelTransition(nextLevelNumber);

                // Telemetry boundary: log level entry
                world.messageBus.emit(Events.LEVEL_ENTERED, nextLevelNumber);

                return true; // Consume turn
            }

            // Core logic: track movement directly
            world.trackPlayerMovement(newX, newY, oldX, oldY);

            // Core logic: check interactions directly
            world.checkInteractionsAt(newX, newY);

            // Core logic: update player position directly
            player.setPosition(newX, newY);
            
            // Recompute FOV after player movement
            world.recomputeFOV();
            
            // UI boundary: trigger redraw via direct call
            world.requestRedraw();

            return true; // Movement consumes a turn
        } else {
            // UI boundary: invalid move message
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: "Can't move there!", type: 'warn' });
            return false; // Invalid moves don't consume turns
        }
    }
    
    /**
     * Calculate new position based on direction
     * @param {number} x - Current X position
     * @param {number} y - Current Y position  
     * @param {string} direction - Movement direction
     * @returns {Object} - New position {newX, newY}
     */
    calculateNewPosition(x, y, direction) {
        let newX = x;
        let newY = y;
        
        switch (direction) {
            // Orthogonal movement
            case 'up': newY--; break;
            case 'down': newY++; break;
            case 'left': newX--; break;
            case 'right': newX++; break;
            
            // Diagonal movement
            case 'up-left': 
                newX--; 
                newY--; 
                break;
            case 'up-right': 
                newX++; 
                newY--; 
                break;
            case 'down-left': 
                newX--; 
                newY++; 
                break;
            case 'down-right': 
                newX++; 
                newY++; 
                break;
                
            default:
                // Invalid direction, return same position
                break;
        }
        
        return { newX, newY };
    }
    
    /**
     * Check if this is a diagonal move
     * @param {string} direction - Movement direction
     * @returns {boolean} - True if diagonal
     */
    isDiagonalMove(direction) {
        return ['up-left', 'up-right', 'down-left', 'down-right'].includes(direction);
    }
    
    /**
     * Check if diagonal movement is allowed (not blocked by adjacent walls)
     * @param {Object} world - World instance
     * @param {number} oldX - Starting X position
     * @param {number} oldY - Starting Y position
     * @param {number} newX - Target X position
     * @param {number} newY - Target Y position
     * @returns {boolean} - True if diagonal movement is allowed
     */
    canMoveDiagonally(world, oldX, oldY, newX, newY) {
        // Check if the two adjacent cells are passable
        // For diagonal movement, both orthogonal paths should be clear
        const canMoveHorizontally = world.canMoveTo(newX, oldY);
        const canMoveVertically = world.canMoveTo(oldX, newY);
        
        // Allow diagonal movement if at least one orthogonal path is clear
        // This prevents getting stuck in corners but still blocks impossible moves
        return canMoveHorizontally || canMoveVertically;
    }
}

/**
 * Action for picking up items
 */
export class PickupAction extends Action {
    perform(world) {
        // Try to pick up items at player's current position
        if (world.tryPickup()) {
            logger.info('Item picked up successfully');
            
            // UI boundary: trigger redraw to update display
            world.requestRedraw();
            return true; // Consume turn
        }
        
        // UI boundary: notify player that nothing was picked up
        world.messageBus.emit(Events.MESSAGE_TYPED, { text: 'Nothing to pick up here.', type: 'system' });
        // logger.debug('No items to pick up at current position');
        return false; // No turn consumed if nothing picked up
    }
}

/**
 * Action for toggling the inventory display
 */
export class ToggleInventoryAction extends Action {
    perform(world) {
        world.messageBus.emit(Events.UI_INVENTORY_TOGGLE);
        // logger.debug('Inventory display toggled');
        return false; // UI actions don't consume turns
    }
}

/**
 * Action for waiting/passing a turn
 */
export class WaitAction extends Action {
    perform(world) {
        // logger.debug('Player waiting/passing turn');
        return true; // Consume turn
    }
}

/**
 * Action for saving the game state
 */
export class SaveGameAction extends Action {
    perform(world) {
        try {
            // Note: saveGame() is still in game.js due to circular dependency avoidance
            import('../game.js').then(({ saveGame }) => {
                if (saveGame()) {
                    world.messageBus.emit(Events.MESSAGE_TYPED, { text: 'Game saved!', type: 'system' });
                    logger.info('Game state saved successfully');
                } else {
                    world.messageBus.emit(Events.MESSAGE_TYPED, { text: 'Failed to save game!', type: 'error' });
                    logger.error('Game save failed');
                }
            });
            return false; // Save doesn't consume a turn
        } catch (error) {
            logger.error('Failed to save game:', error);
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: 'Failed to save game!', type: 'error' });
            return false;
        }
    }
}

/**
 * Action for loading a saved game state
 */
export class LoadGameAction extends Action {
    perform(world) {
        try {
            // Note: loadGame() is still in game.js due to circular dependency avoidance
            import('../game.js').then(({ loadGame }) => {
                if (loadGame()) {
                    world.messageBus.emit(Events.MESSAGE_TYPED, { text: 'Game loaded!', type: 'system' });
                    logger.info('Game state loaded successfully');
                } else {
                    world.messageBus.emit(Events.MESSAGE_TYPED, { text: 'Failed to load game!', type: 'error' });
                    logger.error('Game load failed');
                }
            });
            return false; // Load doesn't consume a turn
        } catch (error) {
            logger.error('Failed to load game:', error);
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: 'Failed to load game!', type: 'error' });
            return false;
        }
    }
}

/**
 * Action for restarting the game
 */
export class RestartGameAction extends Action {
    perform(world) {
        try {
            // Note: restartGame() is in game.js due to circular dependency avoidance
            import('../game.js').then(({ restartGame, isGameOver }) => {
                // Only restart and log if we're in a game over state
                if (isGameOver()) {
                    restartGame();
                    logger.info('Game restart initiated');
                } else {
                    logger.debug('Restart attempted but game is not in game over state');
                }
            });
            return false; // Restart doesn't consume a turn
        } catch (error) {
            logger.error('Failed to restart game:', error);
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: 'Failed to restart game!', type: 'error' });
            return false;
        }
    }
} 