import { toggleInventory, isInventoryDisplayOpen, initializeInventoryUI } from '../ui/overlays/inventory.js';
import { initializeLevelIntroductionUI } from '../ui/overlays/levelIntro.js';
import { initializeSettingsUI } from '../ui/overlays/settings.js';
import { 
    MoveAction, 
    PickupAction, 
    ToggleInventoryAction, 
    WaitAction, 
    SaveGameAction, 
    LoadGameAction,
    RestartGameAction 
} from './actions.js';
import * as logger from './logger.js';
import { isGameOver } from '../game.js';
import { isAnyOpen as isAnyOverlayOpen } from '../ui/overlayManager.js';

// Flag to prevent duplicate input setup
let inputInitialized = false;

/**
 * Get the turn engine instance for input processing
 */
function getTurnEngine() {
    if (typeof window !== 'undefined' && window.turnEngineInstance) {
        return window.turnEngineInstance;
    }
    logger.error('Turn engine instance not available');
    return null;
}

export function setupInput() {
    // Prevent duplicate input listeners
    if (inputInitialized) {
        logger.warn('Input system already initialized, skipping');
        return;
    }
    
    logger.info('Initializing input system...');
    inputInitialized = true;
    
    // Initialize inventory UI
    initializeInventoryUI();
    
    // Initialize level introduction UI
    initializeLevelIntroductionUI();
    
    // Initialize settings UI
    initializeSettingsUI();
    
    window.addEventListener('keydown', async (event) => {
        const turnEngine = getTurnEngine();
        if (!turnEngine) {
            logger.error('Cannot process input: turn engine not available');
            return;
        }
        
        // Always allow 'i' to toggle inventory, even if inventory is open
        if (event.key.toLowerCase() === 'i') {
            event.preventDefault();
            const action = new ToggleInventoryAction();
            turnEngine.queuePlayerAction(action);
            return;
        }

        // Generic UI-block: if any overlay is open, block world-affecting inputs
        if (isAnyOverlayOpen()) {
            // Let 'i' path above handle toggling inventory; otherwise ignore
            return;
        }
        
        // Handle save/load commands first (with Ctrl modifier)
        if (event.ctrlKey || event.metaKey) { // metaKey for Mac Cmd key
            switch (event.key.toLowerCase()) {
                case 's':
                    event.preventDefault();
                    const saveAction = new SaveGameAction();
                    turnEngine.queuePlayerAction(saveAction);
                    return;
                case 'l':
                    event.preventDefault();
                    const loadAction = new LoadGameAction();
                    turnEngine.queuePlayerAction(loadAction);
                    return;
            }
        }
        
        // Handle pickup key
        if (event.key.toLowerCase() === 'g') {
            event.preventDefault();
            const pickupAction = new PickupAction();
            turnEngine.queuePlayerAction(pickupAction);
            return;
        }
        
        // Handle restart key (R) - only in game over state
        if (event.key.toLowerCase() === 'r') {
            event.preventDefault();
            // Check if we're in game over state before queuing restart action
            if (isGameOver()) {
                const restartAction = new RestartGameAction();
                turnEngine.queuePlayerAction(restartAction);
            }
            return;
        }
        
        // Enhanced movement keys supporting 8-directional movement
        let direction = null;
        switch (event.key) {
            // Orthogonal movement (WASD and arrows)
            case 'ArrowUp':
            case 'w':
            case 'W':
                direction = 'up';
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                direction = 'down';
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                direction = 'left';
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                direction = 'right';
                break;
                
            // Diagonal movement (number pad style)
            case '7':
            case 'Home':
                direction = 'up-left';
                break;
            case '9':
            case 'PageUp':
                direction = 'up-right';
                break;
            case '1':
            case 'End':
                direction = 'down-left';
                break;
            case '3':
            case 'PageDown':
                direction = 'down-right';
                break;
                
            // Alternative diagonal keys (QE for upper diagonals, ZC for lower)
            // Only handle these if no modifier keys are pressed
            case 'q':
            case 'Q':
                if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
                    direction = 'up-left';
                }
                break;
            case 'e':
            case 'E':
                if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
                    direction = 'up-right';
                }
                break;
            case 'z':
            case 'Z':
                if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
                    direction = 'down-left';
                }
                break;
            case 'c':
            case 'C':
                if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
                    direction = 'down-right';
                }
                break;
                
            case ' ':
                // Space key for waiting/passing turn
                direction = null;
                break;
            default:
                return; // Don't prevent default for other keys
        }
        
        if (direction) {
            // Prevent default behavior for movement keys
            event.preventDefault();
            
            // Create and queue the movement action
            const moveAction = new MoveAction(direction);
            turnEngine.queuePlayerAction(moveAction);
        } else if (event.key === ' ') {
            // Handle space key for waiting/passing turn
            event.preventDefault();
            const waitAction = new WaitAction();
            turnEngine.queuePlayerAction(waitAction);
        }
    });

    // Add event listeners to handle input focus state
    let inputFocused = true;
    
    // Handle window focus events
    window.addEventListener('blur', () => {
        inputFocused = false;
    });
    
    window.addEventListener('focus', () => {
        inputFocused = true;
    });
} 