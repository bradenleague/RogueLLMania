import { BaseBrain } from './baseBrain.js';
import { TurnResult } from '../../entities/actor.js';
import { findPath } from '../../levels/pathfinding.js';
import { areFactionsHostile } from '../../combat/factions.js';
import { resolveMelee } from '../../combat/melee.js';
import * as logger from '../../systems/logger.js';

/**
 * Slow, shambling undead AI that moves predictably toward the player
 * Less sophisticated than chaser - doesn't investigate as thoroughly
 */
export class ZombieBrain extends BaseBrain {
    constructor() {
        super();
        this.name = 'zombie';
    }

    /**
     * Execute the zombie AI behavior
     * @param {Monster} monster - The monster instance
     * @param {World} world - The world instance
     * @returns {TurnResult} - Result of the action
     */
    act(monster, world) {
        if (!world || !world.player) {
            logger.warn('Monster cannot act: missing world or player');
            return TurnResult.NOT_CONSUMED;
        }

        const player = world.player;

        // If adjacent, try to attack
        if (this.isAdjacent(monster, player)) {
            monster.isChasing = false; // Stop path chase while adjacent
            monster.pathToPlayer = []; // Clear path when in melee
            return this.attackPlayer(monster, world, player);
        }

        // Perception gate: first radius, then LOS
        const inRadius = this.canPerceivePlayer(monster, player);
        const inLOS = inRadius && this.hasLOS(monster, world, player);

        if (inLOS) {
            // We see the player: shamble toward them
            monster.lastKnownPlayerPos = { x: player.x, y: player.y };
            monster.searchTurns = Math.max(1, Math.floor(monster.maxSearchTurns / 2)); // Zombies give up faster
            return this.shambleToward(monster, world, player);
        }

        // Not in LOS. Zombies have shorter memory and give up easier
        if (monster.lastKnownPlayerPos && monster.searchTurns > 0) {
            monster.searchTurns--;
            const moved = this.shambleTowardLastKnown(monster, world);
            if (moved === TurnResult.CONSUMED) {
                return moved;
            }
        }

        // Give up faster than chasers - clear state and just stand around
        monster.isChasing = false;
        monster.pathToPlayer = [];
        monster.lastKnownPlayerPos = null;
        
        // Zombies rarely wander - they mostly just stand still unless they sense something
        if (Math.random() < 0.3) { // 30% chance to make a random move
            return this.shambleRandomly(monster, world);
        }
        
        return TurnResult.CONSUMED; // Just wait/groan
    }

    /**
     * Simple direct movement toward player (no pathfinding complexity)
     * @param {Monster} monster - The monster instance
     * @param {Object} world - World instance
     * @param {Object} player - Player entity
     * @returns {TurnResult} - Result of the action
     */
    shambleToward(monster, world, player) {
        // Simple movement: pick the direction that gets us closer
        const dx = player.x - monster.x;
        const dy = player.y - monster.y;
        
        let moveX = 0, moveY = 0;
        
        // Prefer moving toward the larger distance first
        if (Math.abs(dx) > Math.abs(dy)) {
            moveX = dx > 0 ? 1 : -1;
        } else if (Math.abs(dy) > 0) {
            moveY = dy > 0 ? 1 : -1;
        }
        
        const newX = monster.x + moveX;
        const newY = monster.y + moveY;
        
        // Try to move in the preferred direction
        if (monster.canMoveTo(newX, newY, world)) {
            monster.x = newX;
            monster.y = newY;
            monster.isChasing = true;
            return TurnResult.CONSUMED;
        }
        
        // If blocked, try the other axis
        if (moveX !== 0) {
            moveX = 0;
            moveY = dy > 0 ? 1 : -1;
        } else {
            moveY = 0;
            moveX = dx > 0 ? 1 : -1;
        }
        
        const altX = monster.x + moveX;
        const altY = monster.y + moveY;
        
        if (monster.canMoveTo(altX, altY, world)) {
            monster.x = altX;
            monster.y = altY;
            monster.isChasing = true;
            return TurnResult.CONSUMED;
        }
        
        // If both direct paths are blocked, fall back to wandering
        return this.shambleRandomly(monster, world);
    }

    /**
     * Move toward last known position (simpler than chaser investigation)
     * @param {Monster} monster - The monster instance
     * @param {Object} world - World instance
     * @returns {TurnResult} - Result of the action
     */
    shambleTowardLastKnown(monster, world) {
        if (!monster.lastKnownPlayerPos) {
            return TurnResult.NOT_CONSUMED;
        }

        const target = monster.lastKnownPlayerPos;

        // If we're already there, clear memory immediately
        if (monster.x === target.x && monster.y === target.y) {
            monster.lastKnownPlayerPos = null;
            return TurnResult.NOT_CONSUMED;
        }

        // Simple movement toward last known position (no complex pathfinding)
        const dx = target.x - monster.x;
        const dy = target.y - monster.y;
        
        let moveX = 0, moveY = 0;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            moveX = dx > 0 ? 1 : -1;
        } else if (Math.abs(dy) > 0) {
            moveY = dy > 0 ? 1 : -1;
        }
        
        const newX = monster.x + moveX;
        const newY = monster.y + moveY;
        
        if (monster.canMoveTo(newX, newY, world)) {
            monster.x = newX;
            monster.y = newY;
            
            // If we reached the target, clear memory
            if (monster.x === target.x && monster.y === target.y) {
                monster.lastKnownPlayerPos = null;
            }
            return TurnResult.CONSUMED;
        }

        // Could not move toward target; give up
        monster.lastKnownPlayerPos = null;
        return TurnResult.NOT_CONSUMED;
    }

    /**
     * Attack the player if adjacent
     * @param {Monster} monster - The monster instance
     * @param {Object} world - World instance
     * @param {Object} player - Player entity
     * @returns {TurnResult} - Result of the action
     */
    attackPlayer(monster, world, player) {
        // Check if factions are hostile
        if (!areFactionsHostile(monster.faction, player.faction)) {
            return TurnResult.NOT_CONSUMED;
        }
        
        // Resolve melee combat
        const combatResult = resolveMelee(monster, player, world);
        
        // Mark for batched redraw to update display after monster attack
        if (world.markDirty) {
            world.markDirty();
        }
        
        return TurnResult.CONSUMED;
    }

    /**
     * Slow, infrequent random movement
     * @param {Monster} monster - The monster instance
     * @param {Object} world - World instance
     * @returns {TurnResult} - Result of the action
     */
    shambleRandomly(monster, world) {
        const directions = [
            { dx: 0,  dy: -1 }, // North
            { dx: 1,  dy: 0 },  // East
            { dx: 0,  dy: 1 },  // South
            { dx: -1, dy: 0 }   // West
        ];
        
        // Find all passable adjacent tiles
        const validMoves = [];
        for (const dir of directions) {
            const newX = monster.x + dir.dx;
            const newY = monster.y + dir.dy;
            
            if (monster.canMoveTo(newX, newY, world)) {
                validMoves.push({ x: newX, y: newY });
            }
        }
        
        // If no valid moves, just wait
        if (validMoves.length === 0) {
            return TurnResult.CONSUMED;
        }
        
        // Pick a random valid move
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
        
        // Move to the selected position
        monster.x = randomMove.x;
        monster.y = randomMove.y;
        
        return TurnResult.CONSUMED;
    }
}