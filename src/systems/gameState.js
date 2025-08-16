// Centralized game state management
import * as logger from './logger.js';

// Track game state for dynamic prompts and progression
let gameState = {
    artifactsFound: 0,
    playerMoves: 0,
    gameStartTime: Date.now(),
    lastPlayerPosition: { x: 1, y: 1 },
    movementHistory: [],
    currentLevel: 1,
    inventory: [],  // Array to hold picked up items
    turn: 0  // Current turn number for time-based effects
};

// Updated function to track player movement for dynamic prompts
export function trackPlayerMovement(newX, newY, oldX, oldY) {
    gameState.playerMoves++;
    gameState.movementHistory.push({
        dx: newX - oldX,
        dy: newY - oldY,
        timestamp: Date.now()
    });
    
    // Keep only recent movement history
    if (gameState.movementHistory.length > 10) {
        gameState.movementHistory.shift();
    }
    
    gameState.lastPlayerPosition = { x: oldX, y: oldY };
}

// Increment artifacts found counter
export function incrementArtifactsFound() {
    gameState.artifactsFound++;
}

// Helper function to add an item to the inventory for persistent tracking
export function addToInventory(item) {
    const inventoryItem = {
        title: item.title,
        description: item.description,
        timestamp: Date.now(),
        levelNumber: item.levelNumber || gameState.currentLevel
    };
    
    gameState.inventory.push(inventoryItem);
            // logger.debug(`Added to inventory: ${item.title} from level ${inventoryItem.levelNumber}`);
}

// Get inventory contents
export function getInventory() {
    return [...gameState.inventory];
}

// Update inventory item by level number and position (for story objects)
export function updateInventoryItem(levelNumber, x, y, newTitle, newDescription) {
    const itemIndex = gameState.inventory.findIndex(item => 
        item.levelNumber === levelNumber && 
        item.x === x && 
        item.y === y
    );
    
    if (itemIndex !== -1) {
        gameState.inventory[itemIndex].title = newTitle;
        gameState.inventory[itemIndex].description = newDescription;
        // logger.debug(`Updated inventory item: ${newTitle} from level ${levelNumber}`);
        return true;
    }
    
    return false;
}

// Export game state for potential use in other modules
export function getGameState() {
    return { ...gameState };
}

// Turn management functions
export function getTurn() {
    return gameState.turn;
}

export function incrementTurn() {
    gameState.turn++;
            // logger.debug(`[GameState] Turn incremented to: ${gameState.turn}`);
}

export function setTurn(turnNumber) {
    gameState.turn = turnNumber;
            // logger.debug(`[GameState] Turn set to: ${gameState.turn}`);
}

export function resetTurn() {
    gameState.turn = 0;
            // logger.debug(`[GameState] Turn reset to: ${gameState.turn}`);
} 