import * as logger from '../systems/logger.js';
import { Events } from '../systems/eventBus.js';

/**
 * Determine if an attack is diagonal based on positions
 * @param {Object} attacker - Attacking entity
 * @param {Object} target - Target entity
 * @returns {boolean} - True if attack is diagonal
 */
function isDiagonalAttack(attacker, target) {
    const dx = Math.abs(target.x - attacker.x);
    const dy = Math.abs(target.y - attacker.y);
    return dx === 1 && dy === 1;
}

/**
 * Resolve melee combat between attacker and target
 * @param {Object} attacker - Attacking entity with stats and faction
 * @param {Object} target - Target entity with stats and faction  
 * @param {Object} world - World instance for services and messaging
 * @returns {Object} - Combat result with damage, log message, and death status
 */
export function resolveMelee(attacker, target, world) {
    // Determine attack type
    const isdiagonal = isDiagonalAttack(attacker, target);
    
    // Calculate damage: attacker power - target defense
    const baseDamage = attacker.stats.pow;
    const defense = target.stats.def;
    const damage = Math.max(1, baseDamage - defense); // Minimum 1 damage
    
    // Apply damage to target
    const died = target.stats.takeDamage(damage);
    
    // Create log message
    const attackerIsPlayer = attacker.isPlayer();
    const targetIsPlayer = target.isPlayer();
    
    let logMessage;
    const attackType = isdiagonal ? 'slash diagonally at' : 'attack';
    
    if (attackerIsPlayer) {
        logMessage = `You ${attackType} the monster for ${damage} damage!`;
    } else if (targetIsPlayer) {
        const monsterAttackType = isdiagonal ? 'slashes diagonally at' : 'attacks';
        logMessage = `The monster ${monsterAttackType} you for ${damage} damage!`;
    } else {
        const monsterAttackType = isdiagonal ? 'slashes diagonally at' : 'attacks';
        logMessage = `The monster ${monsterAttackType} the monster for ${damage} damage!`;
    }
    
    // Add death message if target died
    if (died) {
        if (targetIsPlayer) {
            logMessage += ' You die!';
        } else {
            logMessage += ' The monster dies!';
        }
    }
    
    // Emit message to UI (typed)
    if (world.messageBus) {
        world.messageBus.emit(Events.MESSAGE_TYPED, { text: logMessage, type: 'combat' });
        
        // If player died, emit game over event
        if (died && targetIsPlayer) {
            world.messageBus.emit(Events.GAME_OVER);
        }
    }
    
    const attackerName = attackerIsPlayer ? 'Player' : 'Monster';
    const targetName = targetIsPlayer ? 'Player' : 'Monster';
    const attackTypeText = isdiagonal ? ' (diagonal)' : '';
    logger.debug(`Combat: ${attackerName} hits ${targetName} for ${damage} damage${attackTypeText} (${target.stats.hp}/${target.stats.maxHp} HP remaining)`);
    
    return {
        damage: damage,
        message: logMessage,
        targetDied: died
    };
} 