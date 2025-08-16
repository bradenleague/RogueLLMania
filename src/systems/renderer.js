/**
 * Rendering system
 * Renders the game state to the ROT.js display
 * Now uses Room-based visibility instead of Player visibility methods
 */

import * as logger from './logger.js';

let display = null;

/**
 * Initialize the renderer with a ROT.js display
 * @param {ROT.Display} rotDisplay - The ROT.js display object
 */
export function initRenderer(rotDisplay) {
    display = rotDisplay;
    // logger.debug('Renderer initialized');
}

/**
 * Convert tile color tint to color string
 * Handles both array format [r, g, b] and string format for backward compatibility
 * @param {string|Array} tint - The color tint (string name or RGB array)
 * @returns {string} - CSS color string
 */
function tintToColor(tint) {
    // Handle array format [r, g, b] (legacy)
    if (Array.isArray(tint) && tint.length >= 3) {
        const [r, g, b] = tint;
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Handle string format (new)
    if (typeof tint === 'string') {
        const tintMap = {
            'brown': '#8B4513',
            'gray': '#808080',
            'grey': '#808080',
            'green': '#228B22',
            'blue': '#4169E1',
            'yellow': '#FFD700',
            'red': '#DC143C',
            'purple': '#800080',
            'cyan': '#00CED1',
            'orange': '#FF8C00',
            'pink': '#FF69B4',
            'white': '#F5F5F5',
            'black': '#2F2F2F'
        };
        
        return tintMap[tint.toLowerCase()] || '#666';
    }
    
    // Fallback for unknown formats
    return '#666';
}

/**
 * Dim a color for fog-of-war effect
 * @param {string} color - Original color (hex or rgb format)
 * @param {number} factor - Dimming factor (0-1)
 * @returns {string} - Dimmed color
 */
function dimColor(color, factor) {
    // Handle rgb() format colors
    if (color.startsWith('rgb(')) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            
            const dimmedR = Math.floor(r * factor);
            const dimmedG = Math.floor(g * factor);
            const dimmedB = Math.floor(b * factor);
            
            return `rgb(${dimmedR}, ${dimmedG}, ${dimmedB})`;
        }
    }
    
    // Handle hex format colors
    if (color.startsWith('#')) {
        // Convert hex to RGB, then dim
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        
        const dimmedR = Math.floor(r * factor);
        const dimmedG = Math.floor(g * factor);
        const dimmedB = Math.floor(b * factor);
        
        return `rgb(${dimmedR}, ${dimmedG}, ${dimmedB})`;
    }
    
    // Fallback for unknown formats
    return color;
}

/**
 * Main render function that takes the game state and draws it
 * @param {Object} state - The current game state
 */
export function render(state) {
    const { map, player, storyObject, portal, staticObjects = [], currentLevelNumber, MAP_WIDTH, MAP_HEIGHT, world } = state;
    
    if (!display) {
        logger.error('No display object available!');
        return;
    }

    // Get current level for visibility checks
    const currentLevel = world ? world.getCurrentLevelInstance() : null;
    if (!currentLevel) {
        logger.error('No current level available for rendering!');
        return;
    }
    
    // Debug: log visibility state on render
    const debugInfo = currentLevel.getDebugInfo();
    // logger.debug(`[RENDER] Rendering level ${debugInfo.levelNumber}: ${debugInfo.visibleTiles} visible, ${debugInfo.seenTiles} seen`);

    // Clear the display
    display.clear();
    
    // Draw the map tiles with fog-of-war
    for (let x = 0; x < MAP_WIDTH; x++) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            const tile = map[x] && map[x][y];
            let color = '#666'; // default fallback color
            let symbol = '?'; // default fallback symbol
            let foregroundColor = 'rgba(255,255,255,0.5)'; // default foreground
            
            // Check visibility state using Level instead of Player
            const isCurrentlyVisible = currentLevel.isVisible(x, y);
            const hasBeenSeen = currentLevel.hasSeenEver(x, y);
            
            // Skip tiles that have never been seen
            if (!hasBeenSeen) {
                display.draw(x, y, ' ', '#000', '#000'); // Draw black/empty
                continue;
            }
            
            // Handle tile objects with color tints
            if (tile && tile.char && tile.colorTint) {
                symbol = tile.char;
                color = tintToColor(tile.colorTint);
            }
            
            // Apply fog-of-war effect to colors
            if (!isCurrentlyVisible) {
                // Dim colors for fog-of-war (previously seen but not currently visible)
                color = dimColor(color, 0.3); // Darken background
                foregroundColor = 'rgba(128,128,128,0.4)'; // Dim foreground
            }
            
            display.draw(x, y, symbol, foregroundColor, color);
        }
    }
    
    // Draw static objects that haven't been picked up (only if visible)
    if (staticObjects) {
        staticObjects.forEach(obj => {
            if (!obj.pickedUp && currentLevel.isVisible(obj.x, obj.y)) {
                display.draw(obj.x, obj.y, obj.symbol || '*', obj.color || '#fff');
            }
        });
    }
    
    // Draw light sources (torches, lanterns, crystals) if visible or seen
    const lightSources = currentLevel.getLightSources();
    if (lightSources && lightSources.length > 0) {
        lightSources.forEach(light => {
            if (currentLevel.hasSeenEver(light.x, light.y)) {
                let lightSymbol = '♦'; // default light symbol
                let lightColor = '#ff8800'; // default orange
                
                // Different symbols and colors for different light types
                switch (light.type) {
                    case 'torch':
                        lightSymbol = '♦';
                        lightColor = '#ff8800'; // orange flame
                        break;
                    case 'lantern':
                        lightSymbol = '♦';
                        lightColor = '#ffff00'; // yellow light
                        break;
                    case 'crystal':
                        lightSymbol = '♦';
                        lightColor = '#00ffff'; // cyan crystal
                        break;
                    case 'magical_beacon':
                        lightSymbol = '♦';
                        lightColor = '#ff00ff'; // magenta magic
                        break;
                    default:
                        lightSymbol = '♦';
                        lightColor = '#ffffff'; // white default
                }
                
                // Dim the light source if not currently visible
                if (!currentLevel.isVisible(light.x, light.y)) {
                    lightColor = dimColor(lightColor, 0.3);
                }
                
                display.draw(light.x, light.y, lightSymbol, lightColor);
            }
        });
    }
    
    // Draw the story object if it hasn't been picked up (only if visible)
    if (storyObject && !storyObject.pickedUp && currentLevel.isVisible(storyObject.x, storyObject.y)) {
        display.draw(storyObject.x, storyObject.y, '&', '#ff00ff'); // bright magenta
    }
    
    // Draw the portal (only if has been seen)
    if (portal && currentLevel.hasSeenEver(portal.x, portal.y)) {
        let portalColor = '#8B4513'; // brown portal
        if (!currentLevel.isVisible(portal.x, portal.y)) {
            portalColor = dimColor(portalColor, 0.3); // Dim if not currently visible
        }
        display.draw(portal.x, portal.y, '+', portalColor);
    }
    
    // Draw monsters (only if visible and alive)
    if (world && world.monsters && Array.isArray(world.monsters)) {
        // logger.debug(`[RENDER] Found ${world.monsters.length} monsters to potentially render`);
        world.monsters.forEach((monster, index) => {
            const isAlive = monster.stats.isAlive();
            const isVisible = currentLevel.isVisible(monster.x, monster.y);
            // logger.debug(`[RENDER] Monster ${index}: pos(${monster.x},${monster.y}) alive=${isAlive} visible=${isVisible}`);
            
            if (isAlive && isVisible) {
                // Use getColor() method to get dynamic color based on monster state
                const monsterColor = monster.getColor ? monster.getColor() : monster.color;
                display.draw(monster.x, monster.y, monster.symbol, monsterColor);
                // logger.debug(`[RENDER] Drew monster at (${monster.x}, ${monster.y}) with color ${monsterColor}`);
            }
        });
    } else {
        const worldExists = !!world;
        const monstersExists = !!(world && world.monsters);
        const monstersIsArray = !!(world && world.monsters && Array.isArray(world.monsters));
        // logger.debug(`[RENDER] Monster render check failed: world=${worldExists} monsters=${monstersExists} isArray=${monstersIsArray}`);
    }
    
    // Draw the player last so they're always visible
    if (player) {
        // Check if player is alive and adjust display accordingly
        let playerColor = '#ffff00'; // bright yellow normally
        
        // If player has stats and is injured, make them more red
        if (player.stats) {
            const hpRatio = player.stats.getHpRatio();
            if (hpRatio < 0.5) {
                // Injured player - more red tint
                const redIntensity = Math.floor((1 - hpRatio) * 255);
                playerColor = `rgb(255, ${255 - redIntensity}, 0)`;
            }
            
            // If player is dead, make them dark red
            if (!player.stats.isAlive()) {
                playerColor = '#8B0000'; // dark red for dead
            }
        }
        
        display.draw(player.x, player.y, '@', playerColor);
    }
    
    // HUD and level indicators are handled by DOM now
} 