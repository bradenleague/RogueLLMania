// Static objects that can be found and picked up in rooms
// CURRENTLY NOT USED
import { findRandomFloorPosition, pickupEntityWithTileRestore } from './placement.js';
import { addToInventory } from '../systems/gameState.js';
import { refreshInventoryDisplay } from '../ui/overlays/inventory.js';
import { Events } from '../systems/eventBus.js';
import * as logger from '../systems/logger.js';

// Predefined static objects
export const STATIC_OBJECT_DEFINITIONS = [
    {
        id: 'rusty_sword',
        title: 'Rusty Sword',
        description: 'An old iron sword with patches of rust along its blade. Despite its weathered appearance, it still feels balanced in your hand.',
        symbol: '/',
        color: '#8B4513' // Brown
    },
    {
        id: 'health_potion',
        title: 'Health Potion',
        description: 'A small glass vial containing a crimson liquid that seems to glow faintly from within.',
        symbol: '!',
        color: '#FF0000' // Red
    },
    {
        id: 'ancient_tome',
        title: 'Ancient Tome',
        description: 'A leather-bound book with strange symbols etched into its cover. The pages feel warm to the touch.',
        symbol: '?',
        color: '#4B0082' // Indigo
    },
    {
        id: 'golden_coin',
        title: 'Golden Coin',
        description: 'A heavy gold coin bearing the image of a forgotten ruler. It catches the light with an otherworldly gleam.',
        symbol: '$',
        color: '#FFD700' // Gold
    },
    {
        id: 'silver_key',
        title: 'Silver Key',
        description: 'An ornate silver key with intricate engravings. It feels important, though you\'re not sure what it unlocks.',
        symbol: '-',
        color: '#C0C0C0' // Silver
    },
    {
        id: 'magic_scroll',
        title: 'Magic Scroll',
        description: 'A rolled parchment tied with a blue ribbon. Ancient words in an unknown language are visible at its edges.',
        symbol: '=',
        color: '#0000FF' // Blue
    },
    {
        id: 'crystal_shard',
        title: 'Crystal Shard',
        description: 'A jagged piece of translucent crystal that pulses with inner light. It feels cold despite the warm chamber.',
        symbol: '*',
        color: '#00FFFF' // Cyan
    },
    {
        id: 'iron_shield',
        title: 'Iron Shield',
        description: 'A sturdy iron shield with dents and scratches that tell stories of past battles.',
        symbol: '[',
        color: '#696969' // Dim Gray
    }
];

// Create static objects for placement in a room
export function createStaticObjects(map, MAP_WIDTH, MAP_HEIGHT, player, avoidPositions = [], count = 3) {
    const staticObjects = [];
    const availableDefinitions = [...STATIC_OBJECT_DEFINITIONS];
    
    // Create the specified number of static objects
    for (let i = 0; i < Math.min(count, availableDefinitions.length); i++) {
        try {
            // Select a random object definition
            const randomIndex = Math.floor(Math.random() * availableDefinitions.length);
            const definition = availableDefinitions.splice(randomIndex, 1)[0];
            
            // Find a free position, avoiding player, existing objects, and other entities
            const allAvoidPositions = [
                ...avoidPositions,
                ...staticObjects.map(obj => ({ x: obj.x, y: obj.y }))
            ];
            
            const { x, y } = findRandomFloorPosition(map, MAP_WIDTH, MAP_HEIGHT, player, allAvoidPositions);
            
            // Store the original tile for potential restoration (but don't place on map)
            const originalTile = JSON.parse(JSON.stringify(map[x][y]));
            
            // Create the static object instance
            const staticObject = {
                id: `${definition.id}_${Date.now()}_${i}`, // Unique instance ID
                definitionId: definition.id,
                title: definition.title,
                description: definition.description,
                symbol: definition.symbol,
                color: definition.color,
                x: x,
                y: y,
                pickedUp: false,
                type: 'staticObject',
                levelNumber: 1, // Will be set properly when placed
                originalTile // Store the original tile
            };
            
            staticObjects.push(staticObject);
        } catch (error) {
            logger.error(`Failed to create static object: ${error.message}`, error);
        }
    }
    
    return staticObjects;
}

// Check if player is standing on a static object
export function checkStaticObjectInteraction(x, y, staticObjects, messageBus = null) {
    const objectAtPosition = staticObjects.find(obj => 
        obj.x === x && obj.y === y && !obj.pickedUp
    );
    
    if (objectAtPosition) {
        const message = "There's something here. Press 'G' to pick it up.";
        if (messageBus) {
            messageBus.emit(Events.MESSAGE_TYPED, { text: message, type: 'system' });
        } else {
            logger.warn('No message bus provided to checkStaticObjectInteraction, message not shown');
        }
        return objectAtPosition;
    }
    
    return null;
}

// Try to pick up static object at current position
export function tryPickupStaticObject(x, y, staticObjects, map, MAP_WIDTH, MAP_HEIGHT, player, world = null) {
    const objectAtPosition = staticObjects.find(obj => 
        obj.x === x && obj.y === y && !obj.pickedUp
    );
    
    if (objectAtPosition) {
        try {
            // Pick up the item
            objectAtPosition.pickedUp = true;
            // Restore the original tile using generic function
            pickupEntityWithTileRestore(map, objectAtPosition.x, objectAtPosition.y, objectAtPosition.originalTile);
            
            // Track pickup in inventory
            addToInventory({
                title: objectAtPosition.title,
                description: objectAtPosition.description,
                x: objectAtPosition.x,
                y: objectAtPosition.y,
                levelNumber: objectAtPosition.levelNumber || 1,
                type: 'staticObject'
            });
            
            // Log the pickup action
            logger.info(`Picked up ${objectAtPosition.title}`);
            
            const message = `You picked up the ${objectAtPosition.title}!`;
            if (world && world.messageBus) {
                world.messageBus.emit(Events.MESSAGE_TYPED, { text: message, type: 'loot' });
                world.messageBus.emit(Events.UI_DESCRIPTION, objectAtPosition.description, objectAtPosition.title);
                // Trigger redraw via direct call
                world.requestRedraw();
            } else {
                logger.warn('No world provided to tryPickupStaticObject, cannot show message or redraw');
            }
            
            // Refresh inventory display if open
            refreshInventoryDisplay();
            
            return true;
        } catch (error) {
            logger.error(`Failed to pick up ${objectAtPosition.title}: ${error.message}`, error);
            return false;
        }
    }
    
    return false;
} 