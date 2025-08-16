// Pillared Hall generator that creates large open halls with strategic pillar placement
// Combines open space exploration with tactical vision-blocking elements
// Uses pillars and varied floor types to create interesting tactical gameplay

import { TileTypes, randomOpaqueTileType } from '../../tiles/tileTypes.js';
import * as logger from '../../systems/logger.js';

// Configuration for pillar placement
const PILLAR_DENSITY = 0.08; // Percentage of interior space that should be pillars
const MIN_PILLAR_DISTANCE = 4; // Minimum distance between pillars
const BORDER_BUFFER = 3; // Minimum distance from walls for pillar placement

// Hall patterns - different arrangements for variety
const HALL_PATTERNS = {
  symmetric: { 
    name: 'Symmetric Halls',
    pillarsPerSection: 2,
    arrangement: 'grid'
  },
  scattered: {
    name: 'Scattered Pillars', 
    pillarsPerSection: 3,
    arrangement: 'random'
  },
  corridors: {
    name: 'Pillar Corridors',
    pillarsPerSection: 4,
    arrangement: 'lines'
  }
};

// Helper function to calculate distance between two points
function getDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Check if a position is valid for pillar placement
function isValidPillarPosition(x, y, existingPillars, MAP_WIDTH, MAP_HEIGHT) {
  // Check bounds with buffer
  if (x < BORDER_BUFFER || x >= MAP_WIDTH - BORDER_BUFFER || 
      y < BORDER_BUFFER || y >= MAP_HEIGHT - BORDER_BUFFER) {
    return false;
  }
  
  // Check distance from existing pillars
  for (const pillar of existingPillars) {
    if (getDistance(x, y, pillar.x, pillar.y) < MIN_PILLAR_DISTANCE) {
      return false;
    }
  }
  
  return true;
}

// Generate pillar positions based on pattern type
function generatePillarPositions(MAP_WIDTH, MAP_HEIGHT, pattern, levelNumber) {
  const pillars = [];
  const maxPillars = Math.floor((MAP_WIDTH - 2 * BORDER_BUFFER) * (MAP_HEIGHT - 2 * BORDER_BUFFER) * PILLAR_DENSITY);
  const seed = levelNumber * 2000; // Consistent seed per level
  
          // logger.debug(`Generating pillars for ${pattern.name}, max pillars: ${maxPillars}`);
  
  if (pattern.arrangement === 'grid') {
    // Create a semi-regular grid with some randomness
    const gridSpacing = Math.floor(Math.sqrt((MAP_WIDTH * MAP_HEIGHT) / maxPillars));
    ROT.RNG.setSeed(seed);
    
    for (let x = BORDER_BUFFER + gridSpacing; x < MAP_WIDTH - BORDER_BUFFER; x += gridSpacing) {
      for (let y = BORDER_BUFFER + gridSpacing; y < MAP_HEIGHT - BORDER_BUFFER; y += gridSpacing) {
        // Add some randomness to grid positions
        const offsetX = Math.floor(ROT.RNG.getUniform() * 5) - 2; // -2 to 2
        const offsetY = Math.floor(ROT.RNG.getUniform() * 5) - 2; // -2 to 2
        const pillarX = x + offsetX;
        const pillarY = y + offsetY;
        
        if (isValidPillarPosition(pillarX, pillarY, pillars, MAP_WIDTH, MAP_HEIGHT) && 
            pillars.length < maxPillars) {
          pillars.push({ x: pillarX, y: pillarY });
        }
      }
    }
  } else if (pattern.arrangement === 'lines') {
    // Create pillar lines/corridors
    ROT.RNG.setSeed(seed);
    const numLines = Math.floor(maxPillars / 8);
    
    for (let line = 0; line < numLines; line++) {
      const isVertical = ROT.RNG.getUniform() > 0.5;
      
      if (isVertical) {
        const x = BORDER_BUFFER + Math.floor(ROT.RNG.getUniform() * (MAP_WIDTH - 2 * BORDER_BUFFER));
        const startY = BORDER_BUFFER + Math.floor(ROT.RNG.getUniform() * (MAP_HEIGHT / 2 - BORDER_BUFFER));
        const endY = MAP_HEIGHT / 2 + Math.floor(ROT.RNG.getUniform() * (MAP_HEIGHT - MAP_HEIGHT / 2 - BORDER_BUFFER));
        
        for (let y = startY; y <= endY; y += MIN_PILLAR_DISTANCE) {
          if (isValidPillarPosition(x, y, pillars, MAP_WIDTH, MAP_HEIGHT) && 
              pillars.length < maxPillars) {
            pillars.push({ x, y });
          }
        }
      } else {
        const y = BORDER_BUFFER + Math.floor(ROT.RNG.getUniform() * (MAP_HEIGHT - 2 * BORDER_BUFFER));
        const startX = BORDER_BUFFER + Math.floor(ROT.RNG.getUniform() * (MAP_WIDTH / 2 - BORDER_BUFFER));
        const endX = MAP_WIDTH / 2 + Math.floor(ROT.RNG.getUniform() * (MAP_WIDTH - MAP_WIDTH / 2 - BORDER_BUFFER));
        
        for (let x = startX; x <= endX; x += MIN_PILLAR_DISTANCE) {
          if (isValidPillarPosition(x, y, pillars, MAP_WIDTH, MAP_HEIGHT) && 
              pillars.length < maxPillars) {
            pillars.push({ x, y });
          }
        }
      }
    }
  } else {
    // Random scattered placement
    ROT.RNG.setSeed(seed);
    let attempts = 0;
    const maxAttempts = maxPillars * 10;
    
    while (pillars.length < maxPillars && attempts < maxAttempts) {
      const x = BORDER_BUFFER + Math.floor(ROT.RNG.getUniform() * (MAP_WIDTH - 2 * BORDER_BUFFER));
      const y = BORDER_BUFFER + Math.floor(ROT.RNG.getUniform() * (MAP_HEIGHT - 2 * BORDER_BUFFER));
      
      if (isValidPillarPosition(x, y, pillars, MAP_WIDTH, MAP_HEIGHT)) {
        pillars.push({ x, y });
      }
      attempts++;
    }
  }
  
          // logger.debug(`Generated ${pillars.length} pillars using ${pattern.arrangement} arrangement`);
  return pillars;
}

// Generate floor tiles with variety
function generateFloorTiles(MAP_WIDTH, MAP_HEIGHT, levelNumber) {
  const floorTypes = ['cobblestone', 'dirt', 'moss', 'sand'];
  // Pick dominant floor type based on level
  const dominantTypeIndex = Math.floor(levelNumber / 2) % floorTypes.length;
  const dominantType = floorTypes[dominantTypeIndex];
  
          // logger.debug(`Pillared hall level ${levelNumber}: dominant floor = ${dominantType}`);
  
  const tileMap = {};
  const noiseScale = 0.12; // Slightly larger clusters than basic levels
  const seed = levelNumber * 3000;
  const simplex = new ROT.Noise.Simplex();
  
  let tilesCreated = 0;
  
  for (let x = 0; x < MAP_WIDTH; x++) {
    tileMap[x] = {};
    for (let y = 0; y < MAP_HEIGHT; y++) {
      // Skip border walls
      if (x === 0 || x === MAP_WIDTH - 1 || y === 0 || y === MAP_HEIGHT - 1) {
        continue;
      }
      
      // Generate noise-based floor variety
      const noiseValue = simplex.get(x * noiseScale, y * noiseScale, seed);
      let selectedType = dominantType;
      
      // Use noise to occasionally place other floor types
      if (noiseValue > 0.3) {
        const altTypes = floorTypes.filter(t => t !== dominantType);
        const altIndex = Math.floor(((noiseValue + 1) / 2) * altTypes.length) % altTypes.length;
        selectedType = altTypes[altIndex];
      }
      
      tileMap[x][y] = TileTypes[selectedType];
      tilesCreated++;
    }
  }
  
          // logger.debug(`Generated ${tilesCreated} floor tiles for pillared hall`);
  return tileMap;
}

// Main generation function for pillared hall levels
export function generatePillaredHallLayout(MAP_WIDTH, MAP_HEIGHT, levelNumber = 1) {
  logger.debug(`Generating pillared hall level ${levelNumber}`);
  
  // Choose hall pattern based on level number
  const patternKeys = Object.keys(HALL_PATTERNS);
  const patternIndex = Math.floor(levelNumber / 3) % patternKeys.length;
  const selectedPattern = HALL_PATTERNS[patternKeys[patternIndex]];
  
  logger.debug(`Using pattern: ${selectedPattern.name}`);
  
  // Generate base floor tiles
  const tileMap = generateFloorTiles(MAP_WIDTH, MAP_HEIGHT, levelNumber);
  
  // Generate and place pillars
  const pillars = generatePillarPositions(MAP_WIDTH, MAP_HEIGHT, selectedPattern, levelNumber);
  
  // Place pillars on the map
  pillars.forEach(pillar => {
    if (tileMap[pillar.x]) {
      // Randomly choose between pillar and stone for variety
      const useStone = Math.random() > 0.7;
      tileMap[pillar.x][pillar.y] = useStone ? TileTypes.stone : TileTypes.pillar;
    }
  });
  
  logger.debug(`Pillared hall level ${levelNumber} complete: ${pillars.length} pillars placed`);
  
  return tileMap;
} 