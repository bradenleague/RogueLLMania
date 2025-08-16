import * as logger from './logger.js';
import { initializeMessageLog, appendMessage } from '../ui/messageLog.js';
import { toggleInventory } from '../ui/overlays/inventory.js';

/**
 * Event Bus system for decoupled communication between game systems
 * Handles UI boundaries and telemetry events only
 */

/**
 * Event constants to prevent typos and provide centralized event names
 * ONLY use these for UI boundaries and telemetry, NOT core game logic
 */
export const Events = {
    // UI Events
    MESSAGE: 'ui:message',
    MESSAGE_TYPED: 'ui:message:typed', // { text, type }
    UI_INVENTORY_TOGGLE: 'ui:inventory:toggle',
    UI_DESCRIPTION: 'ui:description:show',
    UI_DESCRIPTION_CLEAR: 'ui:description:clear',
    
    // Game State Events
    GAME_OVER: 'game:over',
    
    // Telemetry/Logging Events
    LEVEL_ENTERED: 'telemetry:level:entered',
    ITEM_PICKED_UP: 'telemetry:item:picked_up',
    TURN_COMPLETED: 'telemetry:turn:completed',
    ERROR_OCCURRED: 'telemetry:error:occurred'
};

/**
 * Event Bus class for decoupled communication between game systems
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
        // logger.debug('Event bus initialized');
    }

    /**
     * Add a listener for an event
     * @param {string} event - Event name to listen for
     * @param {Function} callback - Function to call when event occurs
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        // logger.debug(`Event listener added: ${event}`);
    }

    /**
     * Remove a listener for an event
     * @param {string} event - Event name to remove listener from
     * @param {Function} callback - Function to remove
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        
        if (index !== -1) {
            callbacks.splice(index, 1);
            // logger.debug(`Event listener removed: ${event}`);
        }
        
        // Clean up empty listener arrays
        if (callbacks.length === 0) {
            this.listeners.delete(event);
        }
    }

    /**
     * Emit an event to all listeners
     * @param {string} event - Event name to emit
     * @param {...any} args - Arguments to pass to listeners
     */
    emit(event, ...args) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            // Create a copy of the callbacks array to avoid issues if listeners modify the array
            const callbacksCopy = [...callbacks];
            callbacksCopy.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    logger.error(`Event listener error for "${event}":`, error);
                }
            });
            // logger.debug(`Event emitted: ${event}`);
        }
    }
}

// Singleton instance
let eventBus = null;

/**
 * Get the global event bus instance
 * @returns {EventBus} - The event bus instance
 */
export function getEventBus() {
    if (!eventBus) {
        eventBus = new EventBus();
    }
    return eventBus;
}

/**
 * Initialize event listeners for common game systems
 * Only UI/telemetry boundaries - keep core game logic direct!
 * @param {EventBus} bus - Event bus instance to set up
 */
export function initializeEventListeners(bus) {
    // Ensure message log ready
    try { initializeMessageLog(); } catch {}
    // UI event listeners
    bus.on(Events.MESSAGE, (message) => {
        appendMessage(String(message || ''));
    });
    bus.on(Events.MESSAGE_TYPED, (payload) => {
        // payload: { text, type }
        appendMessage(payload);
    });

    bus.on(Events.UI_INVENTORY_TOGGLE, () => {
        toggleInventory();
    });

    bus.on(Events.UI_DESCRIPTION, (description, title) => {
        // Route description to message log with hierarchy: bold title, italic description
        const safeTitle = escapeHtml(String(title || ''));
        const safeDesc = escapeHtml(String(description || ''));
        const html = title
            ? `<strong>${safeTitle}</strong><br><em>${safeDesc}</em>`
            : `<em>${safeDesc}</em>`;
        appendMessage({ html, type: 'info' });
    });

    bus.on(Events.UI_DESCRIPTION_CLEAR, () => {
        // No-op now that description area is removed; could insert a separator if desired
    });

    // Telemetry/logging events
    bus.on(Events.LEVEL_ENTERED, (levelNumber) => {
        logger.info(`Level ${levelNumber} entered`);
    });

    bus.on(Events.ITEM_PICKED_UP, (itemName, itemType) => {
        logger.info(`Item picked up: ${itemName} (${itemType})`);
    });

    bus.on(Events.TURN_COMPLETED, (turnNumber) => {
        // logger.debug(`Turn ${turnNumber} completed`);
    });

    bus.on(Events.ERROR_OCCURRED, (error, context) => {
        logger.error(`${context}:`, error);
    });

    // Game state events
    bus.on(Events.GAME_OVER, () => {
        // This will be handled by the game module
        logger.info('Game over event received');
    });

    logger.info('Event system ready');
} 

function escapeHtml(s = '') {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}