import { initializeGameSystems } from './systems/gameInitialization.js';
import { initRenderer, render } from './systems/renderer.js';
import { setupInput } from './systems/input.js';
import { Events, getEventBus } from './systems/eventBus.js';
import { resetTurn } from './systems/gameState.js';
import { generateLevel } from './levels/levelGeneration.js';
import { initiateLevelIntroductionSequence } from './systems/levelIntroduction.js';
import * as logger from './systems/logger.js';
import { initializeUI } from './ui/index.js';
import { updateHUD } from './ui/hud.js';

// Game state
let map = {};
let player = null;
let world = null;  // Add world reference
let storyObject = null;
let staticObjects = [];
let portal = null;
let currentLevelNumber = 1;
let display = null;
let messageBus = null;
let gameOver = false;

// Constants
export let MAP_WIDTH = 40;
export let MAP_HEIGHT = 20;

/**
 * Start the game (called from start screen)
 */
export async function startGame() {
    // Check if already initialized
    if (display) {
        logger.info('Game already initialized, skipping');
        return;
    }

    // Hide start screen
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.style.display = 'none';
    }

    // Show game container
    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer) {
        gameContainer.style.display = 'inline-block';
    }

    await init();
}

/**
 * Initialize the game
 */
async function init() {
    // Create the ROT.js display
    display = new ROT.Display({
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        fontSize: 24,
        fontFamily: 'Courier New, monospace'
    });
    
    // Add the display canvas to the game container
    document.getElementById('gameContainer').appendChild(display.getContainer());
    
    // Initialize the renderer
    initRenderer(display);

    // Responsive: size the display to fit available space
    applyResponsiveDisplaySize();
    
    // Initialize the full game system
    const gameSystemsResult = initializeGameSystems({
        map,
        playerX: 1,
        playerY: 1,
        currentLevel: 1,
        MAP_WIDTH,    // Pass MAP dimensions to world
        MAP_HEIGHT
    }, draw);
    
    // Store references
    world = gameSystemsResult.world;
    player = gameSystemsResult.player;
    messageBus = getEventBus();
    
    // Initialize UI modules (overlay manager, HUD, overlays)
    initializeUI({ turnEngine: gameSystemsResult.turnEngine });

    // Set up game over event listener
    messageBus.on(Events.GAME_OVER, handleGameOver);
    
    // Reset turn counter for new game
    resetTurn();
    
    // Generate the initial level
    await loadLevel(1);
    
    // Set up keyboard input
    setupInput();
    
    // Initial draw
    logger.info('Drawing initial game state');
    draw();
    
    // Start the turn engine after a short delay to ensure rendering is complete
    setTimeout(() => {
        gameSystemsResult.turnEngine.start();
        logger.info('Turn engine started');
    }, 100);

    // Listen for window resizes and adjust display
    window.addEventListener('resize', () => {
        applyResponsiveDisplaySize();
        draw();
    });
}

// Resize handling: choose a fontSize that fits both width and height
function applyResponsiveDisplaySize() {
    if (!display) return;
    const viewport = document.querySelector('.viewport');
    // Aim for 4:3 inner content area; compute available center column width exactly from grid template (middle column)
    const centerWidth = viewport ? Math.min(viewport.clientWidth, 1280) : window.innerWidth;
    // Deduct right rail fixed width + gap to compute remaining space for game column
    const gap = 24; // matches var(--space-4)
    // Read actual ui-column width to avoid overlap when it shrinks
    const uiColumn = document.querySelector('.ui-column');
    const rightRail = uiColumn ? uiColumn.getBoundingClientRect().width : 360;
    const gameAreaWidth = Math.max(480, centerWidth - (rightRail + gap));
    // Enforce 4:3 area for the game column
    const gameWidth = Math.floor(gameAreaWidth);
    const gameHeight = Math.floor((gameWidth / 4) * 3);

    // Approx monospace aspect ratio: width ≈ 0.6 of font size
    const fontSizeByWidth = Math.max(12, Math.floor(gameWidth / (MAP_WIDTH * 0.6)));
    // Allow slightly smaller font for very short heights (e.g., 600px) to keep the right rail within view
    const heightAllowance = window.innerHeight < 640 ? 0.94 : 1.0;
    const fontSizeByHeight = Math.max(12, Math.floor((gameHeight * heightAllowance) / MAP_HEIGHT));
    let fontSize = Math.min(fontSizeByWidth, fontSizeByHeight, 30);

    // Snap to steps (avoid blur). Also honor devicePixelRatio.
    const step = 2; // multiple of 2 looks crisp in most mono fonts
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    fontSize = Math.floor(fontSize / step) * step;
    fontSize = Math.max(12, fontSize);
    display.setOptions({ fontSize });
                // Ensure the container width reflects the actual canvas width for layout alignment
    try {
        const canvas = display.getContainer();
        if (canvas && canvas instanceof HTMLElement) {
            const canvasWidth = canvas.clientWidth || (MAP_WIDTH * fontSize * 0.6);
            const wrapper = document.getElementById('gameContainer');
            if (wrapper) {
                const wrapperWidth = Math.ceil(canvasWidth);
                const widthPx = `${wrapperWidth}px`;
                wrapper.style.width = widthPx;
                            // Match instructions width to canvas
                            const instr = document.getElementById('instructions');
                            if (instr) instr.style.width = widthPx;
            }
        }
    } catch {}
}

/**
 * Handle game over state
 */
function handleGameOver() {
    if (gameOver) {
        return; // Already handled
    }
    
    gameOver = true;
    logger.info('Game over - player has died');
    
    // Stop the turn engine
    if (world && world.turnEngine) {
        world.turnEngine.stop();
    }
    
    // Show game over message with restart instructions
    messageBus.emit(Events.MESSAGE_TYPED, { text: 'GAME OVER! You have died!', type: 'error' });
    
    // Show persistent game over message in log
    messageBus.emit(Events.UI_DESCRIPTION,
        'Your adventure has come to an end...  Press R to restart or Press L to load a saved game',
        '💀 GAME OVER 💀'
    );
}

/**
 * Restart the game
 */
export function restartGame() {
    if (!gameOver) {
        return;
    }
    
    logger.info('Restarting game');
    gameOver = false;
    
    // Reset game state
    currentLevelNumber = 1;
    resetTurn();
    
    // Clear the map
    for (let x in map) {
        delete map[x];
    }
    
    // Clear all level instances and their fog-of-war state
    if (world) {
        world.clearAllLevels();
    }
    
    // Reset player health and position
    if (player) {
        player.stats.hp = player.stats.maxHp;
        player.setPosition(Math.floor(MAP_WIDTH / 2), MAP_HEIGHT - 2);
    }
    
    // Load the first level
    loadLevel(1).then(() => {
        // Start the turn engine
        if (world && world.turnEngine) {
            world.turnEngine.start();
        }
        messageBus.emit(Events.MESSAGE_TYPED, { text: 'New game started!', type: 'system' });
    });
}

/**
 * Draw the current game state
 */
// Track player-specific moves to avoid duplicate logs
let lastLoggedPlayerPos = null;

export function draw() {
    // Only log once per player move (when player position changes)
    const currentPlayerPos = player ? `${player.x},${player.y}` : null;
    if (currentPlayerPos && currentPlayerPos !== lastLoggedPlayerPos) {
        lastLoggedPlayerPos = currentPlayerPos;
        logger.debug('Player moved', {
            globalTurn: world?.turnEngine?.getCurrentTurn?.() || 0,
            playerPos: player ? { x: player.x, y: player.y } : null,
            currentLevel: currentLevelNumber
        });
    }
    
    render({ 
        map,
        player, 
        storyObject, 
        portal, 
        staticObjects,
        currentLevelNumber, 
        MAP_WIDTH, 
        MAP_HEIGHT,
        world  // Pass world to renderer
    });

    // Update HUD after render
    try {
        if (player && player.stats) {
            updateHUD({ hp: player.stats.hp, maxHp: player.stats.maxHp, level: currentLevelNumber });
        } else {
            updateHUD({ hp: 0, maxHp: 0, level: currentLevelNumber });
        }
    } catch {}
}

/**
 * Load a level by number
 * @param {number} levelNumber - The level number to load
 */
export async function loadLevel(levelNumber) {
    try {
        logger.info(`Loading level ${levelNumber}`);
        
        // Clear any previous UI descriptions
        messageBus.emit(Events.UI_DESCRIPTION_CLEAR);
        
        // Reset player position to bottom center (as if walking in from below)
        player.setPosition(Math.floor(MAP_WIDTH / 2), MAP_HEIGHT - 2);
        
        // Clear the existing map
        for (let x in map) {
            delete map[x];
        }
        // Generate the level using the renamed generateLevel function
        const levelData = await generateLevel(map, MAP_WIDTH, MAP_HEIGHT, player, levelNumber, world);
        
        // Update game state
        portal = levelData.portal;
        storyObject = levelData.storyObject;
        staticObjects = levelData.staticObjects || [];
        const monsters = levelData.monsters || [];
        currentLevelNumber = levelNumber;
        
        // Add monsters to turn engine
        if (world && world.turnEngine) {
            // Clear any existing monsters from turn engine
            for (const actor of world.turnEngine.getActors()) {
                if (!actor.isPlayer()) {
                    world.turnEngine.removeActor(actor);
                }
            }
            
            // Add new monsters to turn engine
            for (const monster of monsters) {
                world.turnEngine.addActor(monster);
            }
            logger.debug(`Added ${monsters.length} monsters to turn engine`);
        }
        
        // Update the world state with the new level data
        if (world) {
            world.update({
                map,
                portal: portal,
                storyObject: storyObject,
                staticObjects: staticObjects,
                monsters: monsters,
                currentLevel: currentLevelNumber
            });
            logger.debug('World state updated with new level data');
            
            // Place torches on the newly generated level
            world.placeTorchesOnCurrentLevel();
            
            // Initialize FOV for the new level AFTER placing torches
            world.initializeFOV();
        }
        
        // Redraw the game after FOV is initialized
        draw();
        
        // Initiate the level introduction sequence (waits for story object, then shows introduction)
        initiateLevelIntroductionSequence(map, MAP_WIDTH, MAP_HEIGHT, levelNumber, monsters, staticObjects, storyObject, world);
        
        logger.info(`Level ${levelNumber} loaded successfully`);
    } catch (error) {
        logger.error(`Failed to load level ${levelNumber}:`, error);
        messageBus.emit(Events.MESSAGE_TYPED, { text: 'Failed to load level!', type: 'error' });
    }
}

/**
 * Save the current game state to localStorage
 * @returns {boolean} - Whether the save was successful
 */
export function saveGame() {
    try {
        const gameState = {
            map: map,
            player: player.serialize(),
            currentLevel: currentLevelNumber,
            storyObject: storyObject,
            staticObjects: staticObjects,
            portal: portal,
            world: world ? world.serialize() : null
        };
        
        localStorage.setItem('gameState', JSON.stringify(gameState));
        
        messageBus.emit(Events.MESSAGE_TYPED, { text: `Game saved! You are in chamber ${currentLevelNumber}.`, type: 'system' });
        
        logger.info('Game state saved successfully');
        return true;
    } catch (error) {
        logger.error('Failed to save game state:', error);
        messageBus.emit(Events.MESSAGE_TYPED, { text: 'Failed to save game!', type: 'error' });
        return false;
    }
}

/**
 * Load a saved game state
 * @returns {boolean} - Whether the load was successful
 */
export function loadGame() {
    try {
        const savedState = localStorage.getItem('gameState');
        if (!savedState) {
            logger.warn('No saved game state found');
            messageBus.emit(Events.MESSAGE_TYPED, { text: 'No saved game found!', type: 'warn' });
            return false;
        }
        
        const gameState = JSON.parse(savedState);
        
        // Validate required data
        if (!gameState.player || !gameState.currentLevel) {
            logger.error('Invalid save data format');
            messageBus.emit(Events.MESSAGE_TYPED, { text: 'Save file is corrupted!', type: 'error' });
            return false;
        }
        
        // Clear the existing map
        for (let x in map) {
            delete map[x];
        }
        // Restore game state
        for (let x in gameState.map) {
            map[x] = { ...gameState.map[x] };
        }
        
        currentLevelNumber = gameState.currentLevel;
        
        // Restore player position and properties
        player.deserialize(gameState.player);
        
        // Ensure player has world reference (critical for combat)
        if (world) {
            player.setWorld(world);
            logger.debug('Player world reference restored');
        }
        
        // Restore world state (including level fog-of-war data)
        if (world && gameState.world) {
            world.deserialize(gameState.world);
            logger.debug('World state restored from save data');
        }
        
        // Restore entities from saved data
        storyObject = gameState.storyObject || null;
        staticObjects = gameState.staticObjects || [];
        portal = gameState.portal || null;
        
        // Log entity restoration for debugging
        logger.debug('Restored entities:', {
            storyObject: storyObject ? { x: storyObject.x, y: storyObject.y, pickedUp: storyObject.pickedUp } : null,
            portal: portal ? { x: portal.x, y: portal.y } : null,
            staticObjectCount: staticObjects.length,
            monstersCount: world.monsters ? world.monsters.length : 0,
            lightSourcesCount: world.currentLevelInstance ? world.currentLevelInstance.getLightSources().length : 0
        });
        
        // Update the world state with loaded entities
        if (world) {
            world.update({
                map,
                portal: portal,
                storyObject: storyObject,
                staticObjects: staticObjects,
                monsters: world.monsters || [], // Use monsters from world's deserialization
                currentLevel: currentLevelNumber
            });
            logger.debug('World state updated with loaded game data');
            
            // Re-add monsters to turn engine after loading
            if (world && world.turnEngine) {
                // Clear ALL existing non-player actors from turn engine (including any duplicates)
                const actors = Array.from(world.turnEngine.getActors());
                for (const actor of actors) {
                    if (!actor.isPlayer()) {
                        world.turnEngine.removeActor(actor);
                    }
                }
                
                // Add loaded monsters to turn engine
                if (world.monsters && world.monsters.length > 0) {
                    for (const monster of world.monsters) {
                        world.turnEngine.addActor(monster);
                    }
                    logger.debug(`Restored ${world.monsters.length} monsters to turn engine`);
                } else {
                    logger.debug('No monsters to restore to turn engine');
                }
            }
            
            // Initialize visibility system for loaded level if needed
            if (world.currentLevelInstance && !world.currentLevelInstance.visibilitySystem) {
                world.currentLevelInstance.initializeVisibilitySystem(map, MAP_WIDTH, MAP_HEIGHT);
                logger.debug('Initialized visibility system for loaded level');
            }
            
            // Recompute FOV for loaded game
            world.recomputeFOV();
        }
        
        // Clear any existing UI
        messageBus.emit(Events.UI_DESCRIPTION_CLEAR);
        
        // Redraw the game
        draw();
        
        // Show success message
        messageBus.emit(Events.MESSAGE_TYPED, { text: `Game loaded! You are in chamber ${currentLevelNumber}.`, type: 'system' });
        
        logger.info('Game state loaded successfully');
        return true;
    } catch (error) {
        logger.error('Failed to load game state:', error);
        messageBus.emit(Events.MESSAGE_TYPED, { text: 'Failed to load game!', type: 'error' });
        return false;
    }
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
    window.gameDebug = {
        saveGame,
        loadGame,
        loadLevel,
        draw,
        restartGame,
        startGame,
        get currentLevel() { return currentLevelNumber; },
        get player() { return player; },
        get world() { return world; },
        get map() { return map; },
        get gameOver() { return gameOver; }
    };
}

// Export game over state for external access
export function isGameOver() {
    return gameOver;
} 