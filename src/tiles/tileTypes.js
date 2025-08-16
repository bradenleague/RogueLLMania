// Tile system - defines different tile types with visual and gameplay properties

export const TileTypes = {
  stone: { 
    char: '#', 
    colorTint: [60, 65, 70], 
    props: { hard: true, solid: true, passable: false, transparent: false } 
  },
  grass: { 
    char: '"', 
    colorTint: [80, 110, 80], 
    props: { soft: true, organic: true, passable: true, transparent: true } 
  },
  dirt: { 
    char: '.', 
    colorTint: [120, 90, 60], 
    props: { dusty: true, soft: true, passable: true, transparent: true } 
  },
  water: { 
    char: '~', 
    colorTint: [60, 70, 120], 
    props: { wet: true, liquid: true, passable: false, transparent: true } 
  },
  cobblestone: { 
    char: '.', 
    colorTint: [90, 90, 100], 
    props: { hard: true, ancient: true, passable: true, transparent: true } 
  },
  moss: { 
    char: '"', 
    colorTint: [70, 100, 70], 
    props: { soft: true, damp: true, organic: true, passable: true, transparent: true } 
  },
  sand: { 
    char: '.', 
    colorTint: [180, 160, 100], 
    props: { granular: true, shifting: true, passable: true, transparent: true } 
  },
  pillar: {
    char: '#',
    colorTint: [75, 75, 85],
    props: { hard: true, solid: true, passable: false, transparent: false }
  }
};

// Helper function to get a random floor tile type
export function randomFloorType() {
  const floorTypes = ['grass', 'dirt', 'cobblestone', 'moss', 'sand'];
  return TileTypes[floorTypes[Math.floor(Math.random() * floorTypes.length)]];
}



// Helper function to get a random wall tile type  
export function randomWallType() {
  const wallTypes = ['stone'];
  return TileTypes[wallTypes[Math.floor(Math.random() * wallTypes.length)]];
}

// Helper function to get a random opaque tile type
export function randomOpaqueTileType() {
  const opaqueTypes = ['stone', 'pillar'];
  return TileTypes[opaqueTypes[Math.floor(Math.random() * opaqueTypes.length)]];
}

// Helper function to check if a tile is passable
export function isTilePassable(tile) {
  return tile && tile.props && tile.props.passable === true;
}

// Helper function to check if a tile is transparent (doesn't block vision)
export function isTileTransparent(tile) {
  return tile && tile.props && tile.props.transparent === true;
}

// Helper function to get tile context for LLM prompts
export function getTileContextDescription(tile) {
  if (!tile || !tile.props) return "";
  
  const descriptors = [];
  if (tile.props.soft) descriptors.push("soft");
  if (tile.props.hard) descriptors.push("hard"); 
  if (tile.props.dusty) descriptors.push("dusty");
  if (tile.props.wet) descriptors.push("wet");
  if (tile.props.organic) descriptors.push("organic");
  if (tile.props.ancient) descriptors.push("ancient");
  if (tile.props.damp) descriptors.push("damp");
  if (tile.props.granular) descriptors.push("granular");
  if (tile.props.shifting) descriptors.push("shifting");
  if (tile.props.transparent === false) descriptors.push("opaque");
  
  return descriptors.join(", ");
} 