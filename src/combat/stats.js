/**
 * Simple statistics class for combat system
 */
export class Stats {
    constructor(hp = 5, pow = 1, def = 0) {
        this.maxHp = hp;
        this.hp = hp;
        this.pow = pow; // Power/Attack strength
        this.def = def; // Defense
    }
    
    /**
     * Take damage, reducing HP
     * @param {number} damage - Amount of damage to take
     * @returns {boolean} - True if the entity died (HP <= 0)
     */
    takeDamage(damage) {
        this.hp = Math.max(0, this.hp - damage);
        return this.hp <= 0;
    }
    
    /**
     * Heal HP up to max
     * @param {number} amount - Amount to heal
     */
    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
    
    /**
     * Check if the entity is alive
     * @returns {boolean} - True if HP > 0
     */
    isAlive() {
        return this.hp > 0;
    }
    
    /**
     * Get current HP as a fraction of max HP
     * @returns {number} - Value between 0 and 1
     */
    getHpRatio() {
        return this.maxHp > 0 ? this.hp / this.maxHp : 0;
    }
    
    /**
     * Serialize stats for save/load
     * @returns {Object} - Serialized stats data
     */
    serialize() {
        return {
            maxHp: this.maxHp,
            hp: this.hp,
            pow: this.pow,
            def: this.def
        };
    }
    
    /**
     * Restore stats from serialized data
     * @param {Object} data - Serialized stats data
     */
    deserialize(data) {
        if (data.maxHp !== undefined) this.maxHp = data.maxHp;
        if (data.hp !== undefined) this.hp = data.hp;
        if (data.pow !== undefined) this.pow = data.pow;
        if (data.def !== undefined) this.def = data.def;
    }
} 