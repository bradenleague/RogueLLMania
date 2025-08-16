// Artifact content data for procedural generation and storytelling
// This file contains all the strings, templates, and data tables used for artifact generation
// Designers can modify these values to change the tone, style, and variety of artifacts

// Dynamic prompt templates for LLM generation
export const PROMPT_TEMPLATES = {
    spatial: [
        "In the {position} of this chamber, you discover a mysterious artifact. {proximity} {description_request}",
        "Tucked away {position}, a strange object catches your eye. {proximity} {description_request}",
        "Your exploration leads you to an artifact resting {position}. {proximity} {description_request}"
    ],
    
    discovery: [
        "This is your first discovery in this strange place - what secrets does it hold?",
        "Another artifact reveals itself to you - each one seems different from the last.",
        "You've found several of these mysterious objects now - this one feels particularly significant."
    ],
    
    approach: [
        "You approached it {movement_style}, drawn by an inexplicable pull.",
        "After {movement_style} through the chamber, you finally reach it.",
        "Your {movement_style} exploration has led you to this moment of discovery."
    ]
};

// Procedural generation tables
export const ARTIFACT_MATERIALS = {
    metals: [
      "iron", "bronze", "brass", "steel", "wrought iron", "blackened steel",
      "copper", "tin", "lead", "pewter", "silvered brass", "oxidized iron"
    ],
  
    finishes: [
      "pitted", "riveted", "slag‑scored", "verdigris‑stained", "oil‑sheen",
      "hammer‑marked", "gear‑toothed", "smoke‑blackened", "etched", "frosted",
      "soot‑veiled", "arc‑scorched"
    ],
  
    forms: [
      "tablet", "engine", "idol", "plaque", "reliquary", "cog", "scepter", "mask",
      "key", "torc", "spindle", "chalice", "lens", "crown", "manifold", "pendant"
    ],
  
    motifs: [
      "cogwork filigree", "spiraling runes", "chain‑link inlay", "smokestack relief",
      "lattice etchings", "anvil sigils", "vented fins", "glyphic studs",
      "pressure seals", "fractured helix", "turbine crests", "circuit lattice"
    ],
  
    adjectives: [
      "rusted", "war‑forged", "cold", "ashen", "forgemarked", "anvil‑born",
      "slag‑glazed", "smoldering", "forgotten", "dread‑etched", "vaulted", "brittle"
    ],
  
    powers: [
      "stores the echo of footsteps in stone",
      "bends weight and stills the air",
      "drinks heat and exhales frost",
      "coaxes sleeping rock to shift",
      "threads iron filings into lines of force",
      "bleeds a dull light that remembers",
      "muffles sound until silence rings",
      "whispers lost schematics in sleep",
      "tolls an hour that never struck",
      "binds the breath of furnaces past",
      "repels rust with invisible tongues",
      "draws maps in ash and memory"
    ],
  
    titleParts: {
      left: [
        "Rust", "Gear", "Anvil", "Verdigris", "Smokestack", "Iron", "Slag", "Chain", "Spark", "Foundry",
        "Copper", "Ash", "Turbine", "Vault", "Cinder", "Mech", "Forge", "Bronze", "Filigree", "Cog",
        "Grime", "Manifold", "Boiler", "Obsidian", "Crucible", "Weld", "Thrumming", "Flux", "Wreck",
        "Fracture", "Chisel", "Gutter", "Dross", "Lantern", "Blast"
      ],
      right: [
        "Choir", "Heart", "Oracle", "Sigil", "Engine", "Hymn", "Tablet", "Crown", "Eye", "Relic",
        "Core", "Canticle", "Spindle", "Circuit", "Tome", "Gaze", "Matrix", "Scripture", "Beacon", "Vessel",
        "Warden", "Index", "Seal", "Conduit", "Mnemonic", "Litany", "Fractal", "Pact", "Chime",
        "Rite", "Crypt", "Band", "Loam", "Whisper", "Skein"
      ]
    }
  };

// Tile-specific themes and descriptions
export const TILE_THEMES = {
    moss: {
        themes: "Themes: organic, living, damp, regrowth, nature, water, green.",
        environmentDescription: "The artifact is partially hidden in thick, damp moss, its surface beaded with droplets of water."
    },
    grass: {
        themes: "Themes: growth, renewal, softness, nature, green, life.",
        environmentDescription: "Blades of soft grass curl around the base of the artifact, as if nature itself is cradling it."
    },
    dirt: {
        themes: "Themes: earth, burial, age, dust, brown, hidden, decay.",
        environmentDescription: "It is half-buried in dusty earth, as though the ground has tried to reclaim it over centuries."
    },
    cobblestone: {
        themes: "Themes: ancient, civilization, endurance, stone, history, grey.",
        environmentDescription: "It rests atop ancient cobblestones, their worn surfaces whispering of forgotten footsteps."
    },
    stone: {
        themes: "Themes: ancient, sturdy, cold, unyielding, endurance, grey.",
        environmentDescription: "The artifact sits on cold, hard stone, echoing the chamber's ancient silence."
    },
    water: {
        themes: "Themes: fluidity, reflection, depth, blue, mystery, change.",
        environmentDescription: "It glimmers just above the surface of still water, reflections dancing across its form."
    },
    sand: {
        themes: "Themes: shifting, time, buried, golden, desert, dryness.",
        environmentDescription: "Half-buried in shifting sand, only a glint reveals its presence."
    }
};

// Position-based proximity descriptions
export const PROXIMITY_DESCRIPTIONS = {
    corner: "The walls seem to have protected it from the elements.",
    wall: "It seems deliberately placed against the stone.",
    center: "It sits prominently, impossible to miss.",
    open: "It rests quietly on the ancient floor."
};

// Material biases based on tile types (for more contextual generation)
export const MATERIAL_BIASES = {
    water: {
        probability: 0.6,
        materials: ["bronze", "brass", "blackened steel"]
    },
    stone: {
        probability: 0.6,
        materials: ["iron", "steel", "wrought iron"]
    },
    cobblestone: {
        probability: 0.6,
        materials: ["iron", "steel", "wrought iron"]
    }
};

// Environmental context based on surrounding tiles (3x3 area analysis)
export const ENVIRONMENTAL_INFLUENCES = {
    // When water is nearby (even if not directly under)
    nearWater: {
        probability: 0.4,
        materials: ["bronze", "brass"],
        finishBonus: ["verdigris‑stained", "oil‑sheen"],
        powerHints: ["reflects depths", "echoes with moisture", "weeps condensation"]
    },
    
    // When surrounded mostly by stone/walls
    enclosed: {
        probability: 0.5,
        materials: ["wrought iron", "blackened steel"],
        finishBonus: ["hammer‑marked", "forge‑born"],
        powerHints: ["resonates with stone", "anchored to bedrock", "sleeps in shadow"]
    },
    
    // When in mixed/transitional areas
    transitional: {
        probability: 0.3,
        materials: ["steel", "iron"],
        finishBonus: ["slag‑scored", "gear‑toothed"],
        powerHints: ["bridges elements", "shifts with surroundings", "adapts to touch"]
    }
};

// Example artifact descriptions for LLM reference
export const EXAMPLE_ARTIFACTS = {
    organic: {
        title: "Whispering Root",
        description: "A gnarled length of petrified wood, its surface veined with brittle filaments of ochre crystal, juts from the soil like a finger forgotten by time. When touched, it hums faintly, stirring the dust around it—as if remembering the voices of things buried too deep to rise."
    },
    stone: {
        title: "Echo Tablet", 
        description: "Set squarely in the heart of the chamber, atop a mosaic of worn, time-smoothed cobblestones, rests a flat slab of grey stone—its surface unnaturally pristine amid the ancient decay. The air around it is still, reverent, as if the very floor remembers what once was; those who linger hear whispers rise from the stone, not spoken aloud, but stirred from deep beneath the ground."
    }
};

// Loading and UI messages
export const UI_MESSAGES = {
    interaction: "There's something here. Press 'G' to pick it up.",
    pickupSuccess: "You picked up the item!",
    pickupFailed: "Failed to pick up the item!",
    debugMode: "[DEBUG MODE] Instantly created debug artifact."
};

// Debug artifact data
export const DEBUG_ARTIFACT = {
    title: "DEBUG ARTIFACT OF TESTING",
    description: "This is a DEBUG description! No LLM was harmed in the making of this artifact.\n\nIt glows with the power of developer productivity."
};