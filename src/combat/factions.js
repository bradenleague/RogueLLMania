/**
 * Faction system for determining hostility between entities
 */
export const Faction = {
    PLAYER: 'player',
    ENEMY: 'enemy'
};

/**
 * Check if two factions are hostile to each other
 * @param {string} faction1 - First faction
 * @param {string} faction2 - Second faction
 * @returns {boolean} - True if factions are hostile
 */
export function areFactionsHostile(faction1, faction2) {
    return faction1 !== faction2;
} 