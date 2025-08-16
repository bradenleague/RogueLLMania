// Logging levels
export const LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

// Default configuration
let config = {
    level: LEVELS.INFO,
    turnMetricsInterval: 50, // Log metrics every N turns
    enableMetrics: true
};

// Metrics storage
const metrics = {
    turnStartTime: null,
    turnTimes: [],
    actionCounts: {},
    lastMetricsOutput: 0
};

// Format a log message with timestamp and optional turn number
function formatMessage(level, message, turn = null) {
    const timestamp = new Date().toISOString();
    const levelStr = `[${level}]`;
    const turnStr = turn !== null ? `[TURN ${turn}] ` : '';
    return `${timestamp} ${levelStr} ${turnStr}${message}`;
}

// Core logging functions
export function error(message, error = null) {
    if (config.level >= LEVELS.ERROR) {
        console.error(formatMessage('ERROR', message));
        if (error) console.error(error);
    }
}

export function warn(message, data = null) {
    if (config.level >= LEVELS.WARN) {
        console.log(formatMessage('WARN', message));
        if (data) {
            console.log('  Data:', data);
        }
    }
}

export function info(message, data = null) {
    if (config.level >= LEVELS.INFO) {
        console.log(formatMessage('INFO', message));
        if (data) {
            console.log('  Data:', data);
        }
    }
}

export function debug(message, data = null) {
    if (config.level >= LEVELS.DEBUG) {
        console.log(formatMessage('DEBUG', message));
        if (data) {
            console.log('  Data:', data);
        }
    }
}

export function trace(message) {
    if (config.level >= LEVELS.TRACE) {
        console.log(formatMessage('TRACE', message));
    }
}

// Turn tracking and metrics
export function startTurn(turn) {
    if (!config.enableMetrics) return;
    metrics.turnStartTime = performance.now();
}

export function endTurn(turn, action) {
    if (!config.enableMetrics) return;
    
    // Calculate turn duration
    const turnTime = performance.now() - metrics.turnStartTime;
    metrics.turnTimes.push(turnTime);
    
    // Keep only recent turn times
    if (metrics.turnTimes.length > 100) {
        metrics.turnTimes.shift();
    }
    
    // Track action counts
    if (action) {
        const actionType = action.constructor.name;
        metrics.actionCounts[actionType] = (metrics.actionCounts[actionType] || 0) + 1;
    }
    
    // Log turn completion at INFO level
    if (action) {
        info(`[TURN ${turn}] ${action.constructor.name} → CONSUMED`);
    }
    
    // Output metrics on interval
    if (turn - metrics.lastMetricsOutput >= config.turnMetricsInterval) {
        outputMetrics(turn);
        metrics.lastMetricsOutput = turn;
    }
}

// Output aggregated metrics
function outputMetrics(turn) {
    if (!config.enableMetrics) return;
    
    // Calculate average turn time
    const avgTurnTime = metrics.turnTimes.reduce((a, b) => a + b, 0) / metrics.turnTimes.length;
    
    // Calculate action distribution
    const totalActions = Object.values(metrics.actionCounts).reduce((a, b) => a + b, 0);
    const actionDistribution = Object.entries(metrics.actionCounts).map(([action, count]) => {
        return `${action}: ${Math.round((count / totalActions) * 100)}%`;
    }).join(', ');
    
    info(`[METRICS] Turn ${turn}:`);
    info(`  Avg turn time: ${avgTurnTime.toFixed(2)}ms`);
    info(`  Action distribution: ${actionDistribution}`);
}

// Configuration
export function configure(options) {
    config = { ...config, ...options };
}

// Reset metrics
export function resetMetrics() {
    metrics.turnTimes = [];
    metrics.actionCounts = {};
    metrics.lastMetricsOutput = 0;
    metrics.turnStartTime = null;
} 