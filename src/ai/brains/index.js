import { BaseBrain } from './baseBrain.js';
import { ChaserBrain } from './chaserBrain.js';
import { ZombieBrain } from './zombieBrain.js';

/**
 * Registry of all available AI brains
 */
const BRAIN_REGISTRY = {
    'base': BaseBrain,
    'chaser': ChaserBrain,
    'zombie': ZombieBrain,
};

/**
 * Create a brain instance by name
 * @param {string} brainName - Name of the brain to create
 * @returns {BaseBrain} - Brain instance
 */
export function createBrain(brainName) {
    const BrainClass = BRAIN_REGISTRY[brainName];
    
    if (!BrainClass) {
        console.warn(`Unknown brain type: ${brainName}, falling back to base brain`);
        return new BaseBrain();
    }
    
    return new BrainClass();
}

/**
 * Get all available brain names
 * @returns {string[]} - Array of brain names
 */
export function getAvailableBrains() {
    return Object.keys(BRAIN_REGISTRY);
}

/**
 * Register a new brain type
 * @param {string} name - Brain name
 * @param {class} BrainClass - Brain class constructor
 */
export function registerBrain(name, BrainClass) {
    BRAIN_REGISTRY[name] = BrainClass;
}

// Export individual brains for direct import if needed
export { BaseBrain, ChaserBrain, ZombieBrain };