/**
 * Turn result constants - returned by actor.act() to indicate if turn was consumed
 */
export const TurnResult = { 
    CONSUMED: true, 
    NOT_CONSUMED: false 
};

/**
 * Base Actor interface for the turn-based system
 * All actors in the game should implement this interface
 * 
 * NOTE: Actors should remain ignorant of FOV/rendering details.
 * They should ask the world questions like "can I see the player?" 
 * or "where can I move?" rather than computing visibility themselves.
 */
export class Actor {
    constructor(x = 0, y = 0, symbol = '?', color = '#fff') {
        this.x = x;
        this.y = y;
        this.symbol = symbol;
        this.color = color;
    }

    /**
     * Called by the ROT.Engine when it's this actor's turn
     * Must be implemented by all actors
     * @param {Object} world - World/game state passed to actor
     * @returns {boolean} TurnResult indicating if the turn was consumed
     */
    act(world) {
        throw new Error('act() method must be implemented by all actors');
    }

    /**
     * Get the actor's current speed for the scheduler
     * Baseline = 1, actors can diverge from this
     * @returns {number}
     */
    getSpeed() {
        return 1; // Normalized baseline speed
    }

    /**
     * Check if this actor is the player
     * @returns {boolean}
     */
    isPlayer() {
        return false;
    }

    /**
     * Serialize actor for save/load
     * @returns {any}
     */
    serialize() {
        return {
            type: this.constructor.name.toLowerCase(),
            x: this.x,
            y: this.y,
            symbol: this.symbol,
            color: this.color
        };
    }

    /**
     * Get actor position
     * @returns {{x: number, y: number}}
     */
    getPosition() {
        return { x: this.x, y: this.y };
    }

    /**
     * Set actor position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
} 