import { BaseBrain } from './baseBrain.js';
import { TurnResult } from '../../entities/actor.js';
import { findPath } from '../../levels/pathfinding.js';
import { areFactionsHostile } from '../../combat/factions.js';
import { resolveMelee } from '../../combat/melee.js';
import * as logger from '../../systems/logger.js';

/**
 * Aggressive AI that actively chases and attacks the player
 */
export class ChaserBrain extends BaseBrain {
    constructor() {
        super();
        this.name = 'chaser';
    }

    /**
     * Execute the chaser AI behavior
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
            // We see the player: update memory and chase
            monster.lastKnownPlayerPos = { x: player.x, y: player.y };
            monster.searchTurns = monster.maxSearchTurns; // reset investigation timer
            return this.chasePlayer(monster, world, player);
        }

        // Not in LOS. If we recently saw the player, investigate the last known tile
        if (monster.lastKnownPlayerPos && monster.searchTurns > 0) {
            monster.searchTurns--;
            const moved = this.investigateLastKnown(monster, world);
            if (moved === TurnResult.CONSUMED) {
                return moved;
            }
            // If we couldn't move toward it, fall through to wandering
        }

        // Give up: clear chase state and wander
        monster.isChasing = false;
        monster.pathToPlayer = [];
        if (monster.searchTurns <= 0) {
            monster.lastKnownPlayerPos = null;
        }
        return this.wanderRandomly(monster, world);
    }

    /**
     * Chase the player using A* pathfinding
     * @param {Monster} monster - The monster instance
     * @param {Object} world - World instance
     * @param {Object} player - Player entity
     * @returns {TurnResult} - Result of the action
     */
    chasePlayer(monster, world, player) {
        // Update last known player position
        monster.lastKnownPlayerPos = { x: player.x, y: player.y };

        // If we don't have a path or the target has moved, recalculate path
        if (monster.pathToPlayer.length === 0 ||
            monster.pathToPlayer[monster.pathToPlayer.length - 1].x !== player.x ||
            monster.pathToPlayer[monster.pathToPlayer.length - 1].y !== player.y) {

            monster.pathToPlayer = findPath(
                world.map,
                world.MAP_WIDTH,
                world.MAP_HEIGHT,
                monster.x,
                monster.y,
                player.x,
                player.y,
                { includeStart: false }
            );
        }

        // If we have a path, move along it
        if (monster.pathToPlayer.length > 0) {
            const nextStep = monster.pathToPlayer[0];

            // Check if the next step is still valid
            if (monster.canMoveTo(nextStep.x, nextStep.y, world)) {
                monster.x = nextStep.x;
                monster.y = nextStep.y;
                monster.pathToPlayer.shift(); // Remove the step we just took
                monster.isChasing = true;
                return TurnResult.CONSUMED;
            } else {
                // Path is blocked, recalculate
                monster.pathToPlayer = [];
                monster.isChasing = false;
                return TurnResult.CONSUMED;
            }
        } else {
            // No path found, fall back to wandering
            monster.isChasing = false;
            return this.wanderRandomly(monster, world);
        }
    }

    /**
     * Move one step toward the last known player position
     * @param {Monster} monster - The monster instance
     * @param {Object} world - World instance
     * @returns {TurnResult} - Result of the action
     */
    investigateLastKnown(monster, world) {
        if (!monster.lastKnownPlayerPos) {
            return TurnResult.NOT_CONSUMED;
        }

        const target = monster.lastKnownPlayerPos;

        // If we're already there, clear memory
        if (monster.x === target.x && monster.y === target.y) {
            monster.lastKnownPlayerPos = null;
            return TurnResult.NOT_CONSUMED;
        }

        const path = findPath(
            world.map,
            world.MAP_WIDTH,
            world.MAP_HEIGHT,
            monster.x,
            monster.y,
            target.x,
            target.y,
            { includeStart: false }
        );

        if (path && path.length > 0) {
            const nextStep = path[0];
            if (monster.canMoveTo(nextStep.x, nextStep.y, world)) {
                monster.x = nextStep.x;
                monster.y = nextStep.y;
                
                // If we reached the target, clear memory
                if (monster.x === target.x && monster.y === target.y) {
                    monster.lastKnownPlayerPos = null;
                }
                return TurnResult.CONSUMED;
            }
        }

        // Could not path or blocked; abandon the search
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
     * Move to a random adjacent passable tile, or wait if surrounded
     * @param {Monster} monster - The monster instance
     * @param {Object} world - World instance
     * @returns {TurnResult} - Result of the action
     */
    wanderRandomly(monster, world) {
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
        
        // If no valid moves, wait (surrounded)
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