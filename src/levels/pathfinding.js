// Pathfinding utilities using rot.js
import { isTilePassable } from '../tiles/index.js';

/**
 * Find a path between two points using A* algorithm
 * @param {Object} map - The game map
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Ending X coordinate
 * @param {number} endY - Ending Y coordinate
 * @param {Object} options - Options for pathfinding
 * @returns {Array} Array of {x, y} coordinates representing the path, or empty array if no path
 */
export function findPath(map, MAP_WIDTH, MAP_HEIGHT, startX, startY, endX, endY, options = {}) {
  const { topology = 4, includeStart = false } = options;
  
  // Create passability callback for rot.js
  const passableCallback = (x, y) => {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
    if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) return false; // walls
    return isTilePassable(map[x][y]);
  };
  
  // Use rot.js A* pathfinding
  const astar = new ROT.Path.AStar(endX, endY, passableCallback, { topology });
  
  const path = [];
  astar.compute(startX, startY, (x, y) => {
    if (!includeStart && x === startX && y === startY) return; // Skip starting position unless requested
    path.push({ x, y });
  });
  
  return path;
}

/**
 * Check if two points are connected (reachable)
 * @param {Object} map - The game map
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Ending X coordinate
 * @param {number} endY - Ending Y coordinate
 * @returns {boolean} True if points are connected
 */
export function arePointsConnected(map, MAP_WIDTH, MAP_HEIGHT, startX, startY, endX, endY) {
  if (!isTilePassable(map[startX][startY]) || !isTilePassable(map[endX][endY])) {
    return false;
  }
  
  const path = findPath(map, MAP_WIDTH, MAP_HEIGHT, startX, startY, endX, endY);
  return path.length > 0;
}

/**
 * Find the nearest passable tile to a given position
 * @param {Object} map - The game map
 * @param {number} MAP_WIDTH - Map width
 * @param {number} MAP_HEIGHT - Map height
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 * @param {number} maxDistance - Maximum search distance (default: 10)
 * @returns {Object|null} {x, y} of nearest passable tile, or null if none found
 */
export function findNearestPassableTile(map, MAP_WIDTH, MAP_HEIGHT, targetX, targetY, maxDistance = 10) {
  // Check if target is already passable
  if (isTilePassable(map[targetX][targetY])) {
    return { x: targetX, y: targetY };
  }
  
  // Search in expanding circles
  for (let distance = 1; distance <= maxDistance; distance++) {
    for (let x = Math.max(1, targetX - distance); x <= Math.min(MAP_WIDTH - 2, targetX + distance); x++) {
      for (let y = Math.max(1, targetY - distance); y <= Math.min(MAP_HEIGHT - 2, targetY + distance); y++) {
        // Only check tiles at the current distance (perimeter of square)
        if (Math.abs(x - targetX) === distance || Math.abs(y - targetY) === distance) {
          if (isTilePassable(map[x][y])) {
            return { x, y };
          }
        }
      }
    }
  }
  
  return null; // No passable tile found within range
} 