/**
 * FOV (Field of Vision) System - PURE SERVICE
 * Map/level-agnostic visibility computation for multiple actors
 * Pure functions with no external state modification
 */

import * as logger from './logger.js';
import { isTileTransparent } from '../tiles/tileTypes.js';
import { determineLevelType } from '../levels/tileGeneration.js';

/**
 * Core FOV Service - Map/Level-Agnostic Visibility Computation
 */

/**
 * Compute visibility from a single origin point
 * @param {Object} fovInstance - Pre-configured ROT.FOV instance
 * @param {Object} origin - {x, y} origin point
 * @param {number} radius - Vision radius
 * @param {Set} [reuseSet] - Optional Set to fill (reduces GC)
 * @returns {Set} Set of visible coordinate keys "x,y"
 */
export function computeVisibility(fovInstance, origin, radius, reuseSet = null) {
    if (!fovInstance || !origin) {
        logger.error('computeVisibility: missing fovInstance or origin');
        return reuseSet || new Set();
    }

    const visibleTiles = reuseSet || new Set();
    if (reuseSet) {
        reuseSet.clear();
    }

    fovInstance.compute(origin.x, origin.y, radius, (x, y, r, visibility) => {
        if (visibility > 0) {
            visibleTiles.add(`${x},${y}`);
        }
    });

    // Always include origin position
    visibleTiles.add(`${origin.x},${origin.y}`);

    return visibleTiles;
}

/**
 * Compute visibility from multiple origins (player + lights)
 * @param {Array} origins - Array of {origin: {x,y}, radius: number}
 * @param {Function} isTransparent - (x, y) => boolean callback
 * @param {Object} [opts] - Options {reuseSet: Set}
 * @returns {Set} Union of all visible tiles
 */
export function computeMultiple(origins, isTransparent, opts = {}) {
    if (!origins || origins.length === 0) {
        return opts.reuseSet || new Set();
    }

    const visibleTiles = opts.reuseSet || new Set();
    if (opts.reuseSet) {
        opts.reuseSet.clear();
    }

    // Accept an optional FOV instance for reuse, otherwise create one
    const fov = opts.fovInstance || new ROT.FOV.PreciseShadowcasting(isTransparent);

    // Use a temporary set for each origin to avoid clearing the main set
    const tempSet = new Set();

    for (const {origin, radius} of origins) {
        if (origin && radius > 0) {
            // Clear temp set and compute visibility for this origin
            tempSet.clear();
            computeVisibility(fov, origin, radius, tempSet);
            
            // Add all visible tiles from this origin to the main set
            for (const tile of tempSet) {
                visibleTiles.add(tile);
            }
        }
    }

    return visibleTiles;
}

/**
 * Compute delta between two visibility sets
 * @param {Set} prev - Previous visible set
 * @param {Set} next - New visible set
 * @returns {Object} {lit: Set, dark: Set} - lit = newly visible, dark = no longer visible
 */
export function computeDelta(prev, next) {
    const lit = new Set();
    const dark = new Set();

    // Find newly lit tiles
    for (const tile of next) {
        if (!prev.has(tile)) {
            lit.add(tile);
        }
    }

    // Find newly dark tiles
    for (const tile of prev) {
        if (!next.has(tile)) {
            dark.add(tile);
        }
    }

    return { lit, dark };
}

/**
 * Convert visibility set to boolean mask array
 * @param {Set} visibleSet - Set of "x,y" coordinate keys
 * @param {number} width - Map width
 * @param {number} height - Map height
 * @returns {Array} 2D boolean array [x][y]
 */
export function toMask(visibleSet, width, height) {
    const mask = Array(width).fill(null).map(() => Array(height).fill(false));
    
    for (const key of visibleSet) {
        const [x, y] = key.split(',').map(Number);
        if (x >= 0 && x < width && y >= 0 && y < height) {
            mask[x][y] = true;
        }
    }
    
    return mask;
}

/**
 * Create a FOV instance for a specific transparency callback
 * Store one per level for performance
 * @param {Function} isTransparent - (x, y) => boolean callback
 * @returns {Object} ROT.FOV.PreciseShadowcasting instance
 */
export function createFOVInstance(isTransparent) {
    return new ROT.FOV.PreciseShadowcasting(isTransparent);
}



/**
 * Debug and Utility Functions
 */

/**
 * Get debug information about FOV computation
 * @param {Set} visibleTiles - Computed visible tiles
 * @param {Object} [origins] - Optional origins used for computation
 * @returns {Object} - Debug information
 */
export function getDebugInfo(visibleTiles, origins = null) {
    const info = {
        visibleCount: visibleTiles.size,
        visibleSample: Array.from(visibleTiles).slice(0, 5)
    };
    
    if (origins) {
        info.origins = origins.map(o => ({
            position: o.origin,
            radius: o.radius
        }));
    }
    
    return info;
}

