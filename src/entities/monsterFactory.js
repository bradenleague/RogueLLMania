import { Monster } from './monster.js';
import { MONSTERS } from '../content/monsters.js';
import { createBrain } from '../ai/brains/index.js';
import { Stats } from '../combat/stats.js';
import { Faction } from '../combat/factions.js';
import * as logger from '../systems/logger.js';

/**
 * Factory for creating data-driven monster instances
 */
export class MonsterFactory {
    /**
     * Create a monster instance from a type definition
     * @param {string} typeId - Monster type ID from MONSTERS data
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Monster} - Configured monster instance
     */
    static create(typeId, x, y) {
        const template = MONSTERS[typeId];
        
        if (!template) {
            logger.warn(`Unknown monster type: ${typeId}, creating default chaser`);
            return MonsterFactory.create('chaser', x, y);
        }

        // Create the monster instance with template data
        const monster = new Monster(x, y, template.glyph, template.color);
        
        // Apply template properties
        monster.typeId = typeId;
        monster.name = template.name;
        monster.stats = new Stats(template.stats.hp, template.stats.pow, template.stats.def);
        monster.faction = Faction.ENEMY; // All monsters are enemies for now
        monster.perceptionRadius = template.perception;
        monster.speed = template.speed;
        monster.tags = [...(template.tags || [])];
        
        // Create and assign the AI brain
        monster.brain = createBrain(template.ai);
        
        // Update visual colors based on template
        monster.baseColor = template.color;
        monster.chaseColor = MonsterFactory.lightenColor(template.color);
        
        logger.debug(`Created ${template.name} (${typeId}) at (${x}, ${y}) with ${template.ai} AI`);
        
        return monster;
    }

    /**
     * Create a random monster from available types
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {Monster} - Random monster instance
     */
    static createRandom(x, y) {
        const types = Object.keys(MONSTERS);
        const randomType = types[Math.floor(Math.random() * types.length)];
        return MonsterFactory.create(randomType, x, y);
    }

    /**
     * Create multiple monsters of specified types and quantities
     * @param {Array} spawns - Array of {type, x, y} objects
     * @returns {Monster[]} - Array of monster instances
     */
    static createMultiple(spawns) {
        return spawns.map(spawn => MonsterFactory.create(spawn.type, spawn.x, spawn.y));
    }

    /**
     * Get all available monster types
     * @returns {string[]} - Array of monster type IDs
     */
    static getAvailableTypes() {
        return Object.keys(MONSTERS);
    }

    /**
     * Get monster template data by type
     * @param {string} typeId - Monster type ID
     * @returns {Object|null} - Monster template or null if not found
     */
    static getTemplate(typeId) {
        return MONSTERS[typeId] || null;
    }

    /**
     * Lighten a hex color for chase state
     * @param {string} color - Original hex color
     * @returns {string} - Lightened hex color
     */
    static lightenColor(color) {
        // Simple color lightening by increasing each RGB component
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substring(0, 2), 16) + 50);
        const g = Math.min(255, parseInt(hex.substring(2, 2), 16) + 50);
        const b = Math.min(255, parseInt(hex.substring(4, 2), 16) + 50);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * Create a monster spawn configuration for level generation
     * @param {number} levelNumber - Current level number
     * @param {number} count - Number of monsters to spawn
     * @returns {Object[]} - Array of spawn configurations {type, weight}
     */
    static createSpawnTable(levelNumber, count = 3) {
        const spawnTable = [];
        
        // Level-based spawn logic
        if (levelNumber <= 2) {
            // Early levels: mostly zombies, some chasers
            spawnTable.push(
                { type: 'zombie', weight: 3 },
                { type: 'chaser', weight: 1 }
            );
        } else {
            // Later levels: more variety and dangerous monsters
            spawnTable.push(
                { type: 'zombie', weight: 2 },
                { type: 'chaser', weight: 2 }
            );
        }
        
        return spawnTable;
    }

    /**
     * Select a random monster type from a spawn table
     * @param {Object[]} spawnTable - Array of {type, weight} objects
     * @returns {string} - Selected monster type
     */
    static selectFromSpawnTable(spawnTable) {
        const totalWeight = spawnTable.reduce((sum, entry) => sum + entry.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const entry of spawnTable) {
            random -= entry.weight;
            if (random <= 0) {
                return entry.type;
            }
        }
        
        // Fallback to first entry
        return spawnTable[0]?.type || 'chaser';
    }
}