// Basic room generator that creates predictable clustered tile patterns
// Uses perlin noise to create natural-looking but readable areas
// Emphasizes exploration over navigation challenges

import { TileTypes } from '../../tiles/tileTypes.js';
import * as logger from '../../systems/logger.js';

// Threshold for how much of the room is the dominant tile type
const DOMINANT_TILE_THRESHOLD = -0.2;

// Helper function to get compatible tile types for clustering  
function getCompatibleTileTypes(dominantType) {
  const compatibility = {
    'grass': ['moss', 'dirt'],
    'dirt': ['sand', 'grass'],
    'cobblestone': ['moss', 'dirt'],
    'moss': ['grass', 'cobblestone'],
    'sand': ['dirt', 'cobblestone']
  };
  return compatibility[dominantType] || ['dirt', 'grass'];
}

// Utility: pick a clustered tile type based on noise, dominant, and compatible types
function pickClusteredTileType(noiseValue, dominantType, compatibleTypes) {
  if (noiseValue > DOMINANT_TILE_THRESHOLD) return dominantType;
  // Map noise to one of the compatible types
  const idx = Math.floor(((noiseValue + 1) / 2) * compatibleTypes.length) % compatibleTypes.length;
  return compatibleTypes[idx];
}

// Generate clustered tiles for a basic level with mostly one dominant type
export function generateBasicLayout(MAP_WIDTH, MAP_HEIGHT, levelNumber = 1) {
  const floorTypes = ['grass', 'dirt', 'cobblestone', 'moss', 'sand'];
  // Pick a dominant tile type for this level (based on level number for consistency)
  const dominantTypeIndex = levelNumber % floorTypes.length;
  const dominantType = floorTypes[dominantTypeIndex];
  
          // logger.debug(`Basic level ${levelNumber}: dominant type = ${dominantType}`);
  
  // Create a 2D array to store tile types
  const tileMap = {};
  // Generate base noise pattern
  const noiseScale = 0.15; // Controls cluster size (smaller = bigger clusters) - restored original
  const seed = levelNumber * 1000; // Consistent seed per level
  const simplex = new ROT.Noise.Simplex();
  
  let tilesCreated = 0;
  const tileTypeCounts = {};
  
  for (let x = 0; x < MAP_WIDTH; x++) {
    tileMap[x] = {};
    for (let y = 0; y < MAP_HEIGHT; y++) {
      // Skip walls - they'll be handled elsewhere
      if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
        continue;
      }
      // Get noise value for this position
      const noiseValue = simplex.get(x * noiseScale, y * noiseScale, seed);
      // Choose a secondary type that makes sense with the dominant type
      const secondaryTypes = getCompatibleTileTypes(dominantType);
      const selectedTileType = pickClusteredTileType(noiseValue, dominantType, secondaryTypes);
      tileMap[x][y] = TileTypes[selectedTileType];
      
      tilesCreated++;
      tileTypeCounts[selectedTileType] = (tileTypeCounts[selectedTileType] || 0) + 1;
    }
  }
  
      // logger.debug(`Basic level ${levelNumber}: created ${tilesCreated} tiles`, tileTypeCounts);
  
  return tileMap;
} 