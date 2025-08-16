/**
 * VisibilitySystem - Clean layer for "player vision + lights"
 * 
 * Layer responsibilities:
 * - Level: owns grid, visibleTiles, seenTiles, lights[]
 * - VisibilitySystem: owns FOV instance, cache per-actor, helpers
 * - Actor: just visionRadius (if any)
 */

import { 
    computeVisibility, 
    computeMultiple, 
    computeDelta, 
    createFOVInstance 
} from './fov.js';
import * as logger from './logger.js';

export class VisibilitySystem {
    constructor(level, transparencyCallback) {
        this.level = level;
        this.transparencyCallback = transparencyCallback;
        this.fovInstance = createFOVInstance(transparencyCallback);
        
        // Cache visibility per actor to avoid recomputation
        this.actorVisibilityCache = new Map();
        
        // Reusable sets for GC optimization
        this.tempSets = {
            actor: new Set(),
            combined: new Set(),
            delta: { prev: new Set(), next: new Set() }
        };
        
        // logger.debug(`VisibilitySystem created for level ${level.levelNumber}`);
    }

    /**
     * Compute visibility for a single actor
     * @param {Object} actor - Actor with visionRadius property
     * @returns {Set} Visible tiles for this actor
     */
    computeForActor(actor) {
        // Get actor's vision radius (handles both direct property and getter method)
        const visionRadius = actor.getVisionRadius ? actor.getVisionRadius() : actor.visionRadius;
        
        if (!visionRadius || visionRadius <= 0) {
            return new Set();
        }

        const key = `${actor.x},${actor.y},${visionRadius}`;
        
        // Check cache first
        if (this.actorVisibilityCache.has(key)) {
            return this.actorVisibilityCache.get(key);
        }

        // Compute fresh visibility
        this.tempSets.actor.clear();
        const visible = computeVisibility(
            this.fovInstance,
            { x: actor.x, y: actor.y },
            visionRadius,
            this.tempSets.actor
        );

        // Cache result (copy the set to avoid reference issues)
        const cached = new Set(visible);
        this.actorVisibilityCache.set(key, cached);

        return cached;
    }

    /**
     * Compute union of visibility from multiple sources
     * @param {Array} actors - Array of actors with visionRadius
     * @param {Array} lights - Array of light sources from level
     * @returns {Set} Combined visible tiles
     */
    computeUnion(actors = [], lights = []) {
        // If no actors provided, fall back to lights-only union
        if (!actors || actors.length === 0) {
            const lightOrigins = [];
            for (const light of lights) {
                if (light.radius && light.radius > 0) {
                    lightOrigins.push({ origin: { x: light.x, y: light.y }, radius: light.radius });
                }
            }
            if (lightOrigins.length === 0) return new Set();
            this.tempSets.combined.clear();
            return computeMultiple(lightOrigins, this.transparencyCallback, { reuseSet: this.tempSets.combined });
        }

        // 1) Compute union of visibility for all actors within their own radius (baseline visibility)
        const playerVisible = new Set();
        for (const actor of actors) {
            const actorVisible = this.computeForActor(actor);
            for (const tile of actorVisible) playerVisible.add(tile);
        }

        // 2) Compute a line-of-sight mask for actors without radius limit (so lit tiles beyond radius can be seen)
        const losMask = new Set();
        // Determine a large radius that covers the map
        const mapWidth = Array.isArray(this.level.map) ? this.level.map.length : 0;
        const mapHeight = mapWidth > 0 && Array.isArray(this.level.map[0]) ? this.level.map[0].length : 0;
        const maxRadius = Math.max(mapWidth, mapHeight) || 100; // safe fallback
        for (const actor of actors) {
            this.tempSets.actor.clear();
            const losFull = computeVisibility(
                this.fovInstance,
                { x: actor.x, y: actor.y },
                maxRadius,
                this.tempSets.actor
            );
            for (const tile of losFull) losMask.add(tile);
        }

        // 3) Compute visibility contributed by ALL light sources (respecting obstacles from the light's perspective)
        let lightsVisible = new Set();
        const lightOrigins = [];
        for (const light of lights) {
            if (light.radius && light.radius > 0) {
                lightOrigins.push({ origin: { x: light.x, y: light.y }, radius: light.radius });
            }
        }
        if (lightOrigins.length > 0) {
            this.tempSets.combined.clear();
            lightsVisible = computeMultiple(lightOrigins, this.transparencyCallback, { reuseSet: this.tempSets.combined });
        }

        // 4) Final visibility: player's own vision + (lights union intersected with player's LOS mask)
        const result = new Set(playerVisible);
        for (const tile of lightsVisible) {
            if (losMask.has(tile)) result.add(tile);
        }
        return result;
    }

    /**
     * Update level visibility with change detection
     * @param {Array} actors - Array of actors (typically just player)
     * @param {Array} lights - Array of light sources (from level)
     * @returns {Object} { visible: Set, delta: {lit: Set, dark: Set} }
     */
    updateLevelVisibility(actors = [], lights = []) {
        // Store previous visibility for delta computation
        this.tempSets.delta.prev.clear();
        for (const tile of this.level.visibleTiles) {
            this.tempSets.delta.prev.add(tile);
        }

        // Compute new visibility
        const newVisible = this.computeUnion(actors, lights);

        // Calculate what changed
        const delta = computeDelta(this.tempSets.delta.prev, newVisible);

        // Update level's visibility
        this.level.visibleTiles.clear();
        for (const tile of newVisible) {
            this.level.visibleTiles.add(tile);
            this.level.seenTiles.add(tile); // Add to memory
        }

        // logger.debug(`Visibility updated: ${newVisible.size} visible, ${delta.lit.size} newly lit, ${delta.dark.size} newly dark`);

        return { visible: newVisible, delta };
    }

    /**
     * Check if one actor can see another
     * @param {Object} viewer - The actor doing the looking
     * @param {Object} target - The actor being looked at
     * @returns {boolean} True if viewer can see target
     */
    canActorSeeTarget(viewer, target) {
        // Get viewer's vision radius (handles both direct property and getter method)
        const visionRadius = viewer.getVisionRadius ? viewer.getVisionRadius() : viewer.visionRadius;
        
        if (!visionRadius || visionRadius <= 0) {
            return false;
        }

        const viewerVisible = this.computeForActor(viewer);
        const targetKey = `${target.x},${target.y}`;
        return viewerVisible.has(targetKey);
    }

    /**
     * Get nearby visible actors for AI purposes
     * @param {Object} viewer - The actor doing the looking
     * @param {Array} targets - Array of potential targets
     * @returns {Array} Array of visible targets
     */
    getVisibleActors(viewer, targets) {
        const viewerVisible = this.computeForActor(viewer);
        return targets.filter(target => {
            const targetKey = `${target.x},${target.y}`;
            return viewerVisible.has(targetKey);
        });
    }

    /**
     * Clear caches when actors move
     */
    invalidateCache() {
        this.actorVisibilityCache.clear();
    }

    /**
     * Get debug information about current visibility state
     * @returns {Object} Debug info
     */
    getDebugInfo() {
        return {
            levelNumber: this.level.levelNumber,
            cacheSize: this.actorVisibilityCache.size,
            visibleTiles: this.level.visibleTiles.size,
            seenTiles: this.level.seenTiles.size,
            lightSources: this.level.getLightSources().length
        };
    }
}
