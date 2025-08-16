import { findFreeTile, pickupEntityWithTileRestore } from './placement.js';
import { Events } from '../systems/eventBus.js';
import * as logger from '../systems/logger.js';

// TUNABLE: How much HP a single health potion restores
// Increase/decrease to change the potency of health potions
export const HEALTH_POTION_HEAL_AMOUNT = 5;

// Simple health potion entity and helpers

/**
 * Create one or more health potions placed on free tiles
 * @param {Object} map
 * @param {number} MAP_WIDTH
 * @param {number} MAP_HEIGHT
 * @param {Object} player
 * @param {Array} existingEntities - Entities to avoid when placing
 * @param {number} count - How many to create
 * @returns {Array} health potion entities
 */
export function createHealthPotions(map, MAP_WIDTH, MAP_HEIGHT, player, existingEntities = [], count = 1) {
    const potions = [];

    for (let i = 0; i < count; i++) {
        try {
            const { x, y } = findFreeTile(map, MAP_WIDTH, MAP_HEIGHT, player, [...existingEntities, ...potions]);
            const underTile = JSON.parse(JSON.stringify(map[x][y]));

            potions.push({
                id: `health_potion_${Date.now()}_${i}`,
                type: 'health_potion',
                title: 'Health Potion',
                description: 'A small glass vial of vivid red liquid. Drinking it restores health.',
                symbol: '!',
                color: '#FF0000',
                x,
                y,
                pickedUp: false,
                levelNumber: 1,
                underTile
            });
        } catch (error) {
            logger.error(`Failed to create health potion: ${error.message}`, error);
        }
    }

    return potions;
}

/**
 * Show interaction hint when standing on a potion
 */
export function checkHealthPotionInteraction(x, y, potions, messageBus = null) {
    const potion = potions.find(p => p.x === x && p.y === y && !p.pickedUp);
    if (potion) {
        const message = "You see a health potion. Press 'G' to drink it.";
        if (messageBus) {
            messageBus.emit(Events.MESSAGE_TYPED, { text: message, type: 'system' });
        } else {
            logger.warn('No message bus provided to checkHealthPotionInteraction, message not shown');
        }
        return potion;
    }
    return null;
}

/**
 * Try to pick up/drink a potion at the given position. Heals the player immediately.
 */
export function tryPickupHealthPotion(x, y, potions, map, MAP_WIDTH, MAP_HEIGHT, player, world = null) {
    const potion = potions.find(p => p.x === x && p.y === y && !p.pickedUp);
    if (!potion) return false;

    try {
        potion.pickedUp = true;
        pickupEntityWithTileRestore(map, potion.x, potion.y, potion.underTile);

        const before = player?.stats?.hp ?? 0;
        if (player && player.stats && typeof player.stats.heal === 'function') {
            player.stats.heal(HEALTH_POTION_HEAL_AMOUNT);
        }
        const after = player?.stats?.hp ?? before;

        logger.info(`Drank health potion (+${after - before} HP)`);

        if (world && world.messageBus) {
            const healed = after - before;
            const msg = healed > 0 ? `You drink the potion and recover ${healed} HP.` : 'You drink the potion, but feel no different.';
            world.messageBus.emit(Events.MESSAGE_TYPED, { text: msg, type: healed > 0 ? 'loot' : 'system' });
            world.requestRedraw();
        }

        return true;
    } catch (error) {
        logger.error(`Failed to drink health potion: ${error.message}`, error);
        return false;
    }
}


