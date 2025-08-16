import { TurnResult } from '../../entities/actor.js';

/**
 * Base class for all monster AI behaviors
 */
export class BaseBrain {
    constructor() {
        this.name = 'base';
    }

    /**
     * Execute the AI behavior for this monster
     * @param {Monster} monster - The monster instance
     * @param {World} world - The world instance
     * @returns {TurnResult} - Result of the action
     */
    act(monster, world) {
        // Default behavior: do nothing
        return TurnResult.NOT_CONSUMED;
    }

    /**
     * Check if the monster can perceive the player using Manhattan distance
     * @param {Monster} monster - The monster instance
     * @param {Object} player - Player entity
     * @returns {boolean} - True if player is within perception radius
     */
    canPerceivePlayer(monster, player) {
        const manhattanDistance = Math.abs(monster.x - player.x) + Math.abs(monster.y - player.y);
        return manhattanDistance <= monster.perceptionRadius;
    }

    /**
     * Check if the monster has line-of-sight to a target
     * @param {Monster} monster - The monster instance
     * @param {World} world - The world instance
     * @param {Object} target - Target entity
     * @returns {boolean} - True if there's line of sight
     */
    hasLOS(monster, world, target) {
        if (world && typeof world.hasLOS === 'function') {
            return world.hasLOS(monster.x, monster.y, target.x, target.y);
        }
        // Fallback keeps current behavior (no LOS blocking) until provided.
        return true;
    }

    /**
     * Check adjacency (8-directional - includes diagonals)
     * @param {Monster} monster - The monster instance
     * @param {Object} target - Target entity
     * @returns {boolean} - True if adjacent
     */
    isAdjacent(monster, target) {
        const dx = Math.abs(monster.x - target.x);
        const dy = Math.abs(monster.y - target.y);
        
        // Adjacent if within 1 tile in any direction (including diagonals)
        return dx <= 1 && dy <= 1 && (dx + dy > 0);
    }
    
    /**
     * Check if adjacent in only orthogonal directions (4-directional)
     * @param {Monster} monster - The monster instance
     * @param {Object} target - Target entity
     * @returns {boolean} - True if orthogonally adjacent
     */
    isOrthogonallyAdjacent(monster, target) {
        const dx = Math.abs(monster.x - target.x);
        const dy = Math.abs(monster.y - target.y);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    }
    
    /**
     * Check if adjacent diagonally
     * @param {Monster} monster - The monster instance
     * @param {Object} target - Target entity
     * @returns {boolean} - True if diagonally adjacent
     */
    isDiagonallyAdjacent(monster, target) {
        const dx = Math.abs(monster.x - target.x);
        const dy = Math.abs(monster.y - target.y);
        return dx === 1 && dy === 1;
    }
}