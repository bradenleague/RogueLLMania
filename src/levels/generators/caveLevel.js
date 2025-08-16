// Cave room generator using ROT.js cellular automata
// Generates organic, maze-like cave structures with varied floor types
// Emphasizes exploration and navigation challenges

import { TileTypes } from '../../tiles/tileTypes.js';
import { arePointsConnected } from '../pathfinding.js';
import * as logger from '../../systems/logger.js';

// Helper function to check if a tile is passable (for connectivity)
function isTilePassable(tile) {
    return tile && tile.props && tile.props.passable === true;
}

// Enhanced connectivity check that ensures all floor areas are reachable
function ensureConnectivity(tileMap, MAP_WIDTH, MAP_HEIGHT) {
  const centerX = Math.floor(MAP_WIDTH / 2);
  const centerY = Math.floor(MAP_HEIGHT / 2);
  
  // Ensure center area is passable
  for (let x = centerX - 2; x <= centerX + 2; x++) {
    for (let y = centerY - 2; y <= centerY + 2; y++) {
      if (x > 0 && x < MAP_WIDTH - 1 && y > 0 && y < MAP_HEIGHT - 1) {
        // Ensure the nested object exists
        if (!tileMap[x]) tileMap[x] = {};
        tileMap[x][y] = TileTypes.moss;
      }
    }
  }
  
  // Create corridors to corners to ensure connectivity
  const corners = [
    {x: 3, y: 3},
    {x: MAP_WIDTH - 4, y: 3},
    {x: 3, y: MAP_HEIGHT - 4},
    {x: MAP_WIDTH - 4, y: MAP_HEIGHT - 4}
  ];
  
  corners.forEach(corner => {
    // Create a winding path from center to corner
    createWindingPath(tileMap, MAP_WIDTH, MAP_HEIGHT, centerX, centerY, corner.x, corner.y);
  });
}

// Create a winding path between two points
function createWindingPath(tileMap, MAP_WIDTH, MAP_HEIGHT, startX, startY, endX, endY) {
  let currentX = startX;
  let currentY = startY;
  
  while (currentX !== endX || currentY !== endY) {
    // Make the current position passable
    if (currentX > 0 && currentX < MAP_WIDTH - 1 && currentY > 0 && currentY < MAP_HEIGHT - 1) {
      // Ensure the nested object exists
      if (!tileMap[currentX]) tileMap[currentX] = {};
      tileMap[currentX][currentY] = TileTypes.cobblestone;
    }
    
    // Move towards target with some randomness for winding effect
    const dx = endX - currentX;
    const dy = endY - currentY;
    
    if (ROT.RNG.getUniform() < 0.7) {
      // 70% chance to move towards target
      if (Math.abs(dx) > Math.abs(dy)) {
        currentX += dx > 0 ? 1 : -1;
      } else {
        currentY += dy > 0 ? 1 : -1;
      }
    } else {
      // 30% chance for random movement (creates winding)
      const directions = [{dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}];
      const randomDir = directions[Math.floor(ROT.RNG.getUniform() * directions.length)];
      const newX = currentX + randomDir.dx;
      const newY = currentY + randomDir.dy;
      
      if (newX > 0 && newX < MAP_WIDTH - 1 && newY > 0 && newY < MAP_HEIGHT - 1) {
        currentX = newX;
        currentY = newY;
      }
    }
  }
}

// Generate cave-like levels using rot.js cellular automata and advanced features
export function generateCaveLayout(MAP_WIDTH, MAP_HEIGHT, levelNumber = 1) {
          // logger.debug(`Cave level ${levelNumber}: starting generation`);
  
  // Set up deterministic random seed for consistent generation
  ROT.RNG.setSeed(levelNumber * 1000);
  
  // Create a 2D array to store tile types
  const tileMap = {};
  
  // Initialize the tileMap structure
  for (let x = 0; x < MAP_WIDTH; x++) {
    tileMap[x] = {};
  }
  
  // Use rot.js Cellular automata to create organic cave structure
  const cellular = new ROT.Map.Cellular(MAP_WIDTH, MAP_HEIGHT, {
    born: [4, 5, 6, 7, 8], // A wall is born if it has 4+ wall neighbors
    survive: [2, 3, 4, 5], // A wall survives if it has 2-5 wall neighbors
    topology: 8 // 8-connected neighbors
  });
  
  // Set initial random state (40% walls, 60% floors for caves)
  cellular.randomize(0.4);
  
  // Run several iterations to create organic cave-like structures
  for (let i = 0; i < 5; i++) {
    cellular.create();
  }
  
  // Convert cellular automata result to our tile system
  const floorNoise = new ROT.Noise.Simplex();
  const floorTypes = ['moss', 'cobblestone', 'dirt'];
  const noiseScale = 0.15; // Controls cluster size
  let tilesCreated = 0;
  const tileTypeCounts = {};
  
  cellular.create((x, y, value) => {
    if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
      // Keep walls around the edges
      return;
    }
    if (value === 0) {
      // Floor - use noise to cluster floor types
      const n = floorNoise.get(x * noiseScale, y * noiseScale, levelNumber * 1000);
      let floorType;
      if (n < -0.2) floorType = 'moss';
      else if (n < 0.2) floorType = 'dirt';
      else floorType = 'cobblestone';
      tileMap[x][y] = TileTypes[floorType];
      tileTypeCounts[floorType] = (tileTypeCounts[floorType] || 0) + 1;
      tilesCreated++;
    } else {
      // This would be a wall in the cellular automata, but we'll make it floor
      // since our outer walls handle the boundaries
      tileMap[x][y] = TileTypes.moss; // Default cave floor
      tileTypeCounts['moss'] = (tileTypeCounts['moss'] || 0) + 1;
      tilesCreated++;
    }
  });
  
          // logger.debug(`Cave level ${levelNumber}: created ${tilesCreated} base tiles`, tileTypeCounts);
  
  // Ensure we have some passable areas by creating connected regions
  ensureConnectivity(tileMap, MAP_WIDTH, MAP_HEIGHT);
  
  // Apply environmental storytelling through tile placement
  applyEnvironmentalDetails(tileMap, MAP_WIDTH, MAP_HEIGHT, levelNumber);
  
  return tileMap;
}

// Add environmental storytelling details to cave levels
function applyEnvironmentalDetails(tileMap, MAP_WIDTH, MAP_HEIGHT, levelNumber) {
          // logger.debug(`Cave level ${levelNumber}: applying environmental details`);
  
  // Seed for consistent environmental details per level
  ROT.RNG.setSeed(levelNumber * 2000);
  
  let waterTilesAdded = 0;
  let mossTilesAdded = 0;
  let sandTilesAdded = 0;
  
  // Add sophisticated water features using Simplex noise for realistic placement
  if (levelNumber >= 2) {
    waterTilesAdded = addWaterFeatures(tileMap, MAP_WIDTH, MAP_HEIGHT, levelNumber);
            // logger.debug(`Cave level ${levelNumber}: added ${waterTilesAdded} water tiles using noise-based placement`);
  }
  
  // Add more moss in deeper levels (gives sense of progression)
  if (levelNumber > 2) {
    for (let x = 1; x < MAP_WIDTH - 1; x++) {
      for (let y = 1; y < MAP_HEIGHT - 1; y++) {
        if (isTilePassable(tileMap[x][y]) && ROT.RNG.getUniform() < 0.15) {
          tileMap[x][y] = TileTypes.moss;
          mossTilesAdded++;
        }
      }
    }
  }
  
  // Add interesting cave features like mineral deposits
  const caveFeatures = addCaveFeatures(tileMap, MAP_WIDTH, MAP_HEIGHT, levelNumber);
  sandTilesAdded = caveFeatures.sandTiles;
  
          // logger.debug(`Cave level ${levelNumber} environmental details: ${waterTilesAdded} water, ${mossTilesAdded} moss, ${sandTilesAdded} sand tiles added`);
}

// Add water features using Simplex noise for realistic placement  
function addWaterFeatures(tileMap, MAP_WIDTH, MAP_HEIGHT, levelNumber) {
  const simplex = new ROT.Noise.Simplex();
  const waterThreshold = 0.3; // Higher values = less water
  const scale = 0.1; // Noise scale - smaller = larger features
  let waterTilesAdded = 0;
  
  for (let x = 2; x < MAP_WIDTH - 2; x++) {
    for (let y = 2; y < MAP_HEIGHT - 2; y++) {
      if (!tileMap[x] || !tileMap[x][y] || !isTilePassable(tileMap[x][y])) continue;
      
      // Get noise value for this position
      const noiseValue = simplex.get(x * scale, y * scale);
      
      // Create water in low-lying areas (negative noise values)
      if (noiseValue < -waterThreshold) {
        // Test if adding water here would break connectivity
        const originalTile = tileMap[x][y];
        tileMap[x][y] = TileTypes.water;
        
        const centerX = Math.floor(MAP_WIDTH / 2);
        const centerY = Math.floor(MAP_HEIGHT / 2);
        
        // Check connectivity to center and corners
        const connected = arePointsConnected(tileMap, MAP_WIDTH, MAP_HEIGHT, centerX, centerY, 3, 3) &&
                         arePointsConnected(tileMap, MAP_WIDTH, MAP_HEIGHT, centerX, centerY, MAP_WIDTH - 4, 3);
        
        if (!connected) {
          // Revert if it breaks connectivity
          tileMap[x][y] = originalTile;
        } else {
          waterTilesAdded++;
          // Expand water feature slightly for more interesting shapes
          waterTilesAdded += expandWaterFeature(tileMap, MAP_WIDTH, MAP_HEIGHT, x, y, noiseValue);
        }
      }
    }
  }
  
  return waterTilesAdded;
}

// Expand water features to create pools and streams
function expandWaterFeature(tileMap, MAP_WIDTH, MAP_HEIGHT, centerX, centerY, intensity) {
  const expansionRadius = Math.floor(Math.abs(intensity) * 3) + 1;
  let expandedTiles = 0;
  
  for (let dx = -expansionRadius; dx <= expansionRadius; dx++) {
    for (let dy = -expansionRadius; dy <= expansionRadius; dy++) {
      const x = centerX + dx;
      const y = centerY + dy;
      
      if (x <= 1 || x >= MAP_WIDTH - 2 || y <= 1 || y >= MAP_HEIGHT - 2) continue;
      
      const distance = Math.sqrt(dx * dx + dy * dy);
      const probability = Math.max(0, 1 - (distance / expansionRadius));
      
      if (ROT.RNG.getUniform() < probability * 0.6) {
        const originalTile = tileMap[x][y];
        if (!isTilePassable(originalTile)) continue;
        
        tileMap[x][y] = TileTypes.water;
        
        // Quick connectivity check - if this breaks paths, revert
        const centerMapX = Math.floor(MAP_WIDTH / 2);
        const centerMapY = Math.floor(MAP_HEIGHT / 2);
        
        if (!arePointsConnected(tileMap, MAP_WIDTH, MAP_HEIGHT, centerMapX, centerMapY, 3, 3)) {
          tileMap[x][y] = originalTile;
        } else {
          expandedTiles++;
        }
      }
    }
  }
  
  return expandedTiles;
}

// Add interesting cave features like mineral deposits
function addCaveFeatures(tileMap, MAP_WIDTH, MAP_HEIGHT, levelNumber) {
  const numFeatures = 2 + Math.floor(ROT.RNG.getUniform() * 3); // 2-4 features
  let sandTiles = 0;
  
  for (let i = 0; i < numFeatures; i++) {
    const x = 3 + Math.floor(ROT.RNG.getUniform() * (MAP_WIDTH - 6));
    const y = 3 + Math.floor(ROT.RNG.getUniform() * (MAP_HEIGHT - 6));
    
    if (tileMap[x] && tileMap[x][y] && isTilePassable(tileMap[x][y])) {
      // Create small clusters of different cave tiles
      const featureTypes = ['sand', 'cobblestone', 'dirt'];
      const featureType = featureTypes[Math.floor(ROT.RNG.getUniform() * featureTypes.length)];
      
      // Create 2x2 or 3x3 feature clusters
      const size = ROT.RNG.getUniform() < 0.5 ? 1 : 2;
      
      for (let dx = 0; dx <= size; dx++) {
        for (let dy = 0; dy <= size; dy++) {
          const fx = x + dx;
          const fy = y + dy;
          
          if (fx < MAP_WIDTH - 1 && fy < MAP_HEIGHT - 1) {
            // Only replace if it's passable or doesn't exist yet
            if (!tileMap[fx][fy] || isTilePassable(tileMap[fx][fy])) {
              tileMap[fx][fy] = TileTypes[featureType];
              if (featureType === 'sand') sandTiles++;
            }
          }
        }
      }
    }
  }
  
  return { sandTiles };
} 