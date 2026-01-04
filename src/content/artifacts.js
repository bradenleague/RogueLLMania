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
// AESTHETIC: Scavengers Reign meets Numenera - alien biology, incomprehensible technology,
// symbiotic relationships, billion-year-old purpose, things that remember or respond
export const TILE_THEMES = {
    moss: {
        // Moss as living membrane, symbiotic organism, something that metabolizes
        themes: "symbiotic, metabolic, breathing substrate, living membrane, host-organism, slow digestion",
        environmentDescription: "The moss has grown around it in deliberate patterns—or perhaps the artifact taught the moss how to grow."
    },
    grass: {
        // Grass as sensing network, collective organism, substrate intelligence
        themes: "root-networked, sensing, collective whisper, substrate-aware, blade-antenna, field-mind",
        environmentDescription: "The grass bends toward the artifact even without wind, each blade oriented like an antenna receiving something you cannot hear."
    },
    dirt: {
        // Dirt as compressed time, burial memory, geological intention
        themes: "burial-deep, sediment-memory, compressed ages, fossil-intention, deliberate interment, loam-secret",
        environmentDescription: "The earth here feels intentional—not eroded into place but arranged, as if something buried this and expected it to be found."
    },
    cobblestone: {
        // Cobblestone as ancient purpose, builder-unknown geometry, path-memory
        themes: "purpose-built, geometry-meant, path-remembering, builder-unknown, pattern-logic, worn-intention",
        environmentDescription: "The cobblestones form a subtle pattern around it, worn by feet that walked here before feet existed."
    },
    stone: {
        // Stone as planetary bone, deep-time witness, pressure-formed patience
        themes: "planetary-bone, pressure-formed, deep-time witness, mountain-fragment, elemental patience, tectonic memory",
        environmentDescription: "The stone beneath it is older than language—it has waited for this artifact, or the artifact has waited for you to find it here."
    },
    water: {
        // Water as threshold, reflection of elsewhere, depth that lies
        themes: "threshold-state, depth-liar, reflection-elsewhere, surface-membrane, fluid boundary, drowned perspective",
        environmentDescription: "The water's surface shows the artifact twice—once as it is, once as it might be, and the two images do not quite match."
    },
    sand: {
        // Sand as erosion-clock, particle memory, time ground fine
        themes: "erosion-measured, particle-scattered, wind-sorted, time-granular, desert-entropy, dust-becoming",
        environmentDescription: "The sand flows around the artifact like a stream parting around a stone, though there is no wind to move it."
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
// These power hints should feel like strange, half-understood phenomena
export const ENVIRONMENTAL_INFLUENCES = {
    // When water is nearby - threshold states, reflections, fluid boundaries
    nearWater: {
        probability: 0.4,
        materials: ["bronze", "brass"],
        finishBonus: ["verdigris‑stained", "oil‑sheen"],
        powerHints: [
            "shows you standing somewhere you haven't reached yet",
            "makes the water forget how to reflect",
            "drinks from depths that aren't there"
        ]
    },

    // When surrounded mostly by stone/walls - pressure, patience, deep time
    enclosed: {
        probability: 0.5,
        materials: ["wrought iron", "blackened steel"],
        finishBonus: ["hammer‑marked", "pressure‑formed"],
        powerHints: [
            "remembers when these walls were molten",
            "makes the stone hum at frequencies bones understand",
            "has been waiting here longer than the chamber has existed"
        ]
    },

    // When in mixed/transitional areas - boundaries, thresholds, change
    transitional: {
        probability: 0.3,
        materials: ["steel", "iron"],
        finishBonus: ["slag‑scored", "gear‑toothed"],
        powerHints: [
            "exists more strongly at the edges of things",
            "translates between materials that shouldn't understand each other",
            "marks the place where one thing becomes another"
        ]
    }
};

// Seeded weirdness injection - picked deterministically based on coordinates
// These add variety by suggesting strange phenomena the model can incorporate
// USAGE: Pick one using seeded RNG and include in XML as <weirdness_hint>
export const WEIRDNESS_MODIFIERS = {
    // Perceptual strangeness - things that affect how you see/sense
    perceptual: [
        "It seems slightly larger when you're not looking directly at it",
        "Your shadow bends toward it",
        "The air tastes different near it—metallic, or maybe like rain",
        "Sound behaves strangely here; your footsteps arrive late",
        "It occupies space in a way that makes distances hard to judge"
    ],

    // Temporal strangeness - things related to time
    temporal: [
        "Dust settles on it faster than it should",
        "It looks older from some angles than others",
        "Your memories of approaching it feel longer than the walk took",
        "It has the patience of something that has already waited forever",
        "The moment you saw it feels like it happened twice"
    ],

    // Agency/awareness - things that seem to respond or know
    agency: [
        "It was facing the entrance before you arrived",
        "It seems to have been expecting you specifically",
        "Something about its position suggests it moved here recently",
        "It gives the impression of having just stopped doing something",
        "The way it rests implies intention, not accident"
    ],

    // Material strangeness - things about its physical nature
    material: [
        "Its weight shifts when you're not holding it",
        "The surface is warmer than the air, with no heat source",
        "It doesn't reflect light the way its material should",
        "Touching it feels like being touched back",
        "It's dry in a way that makes wet things seem wrong"
    ],

    // Spatial strangeness - things about where/how it exists
    spatial: [
        "It casts a shadow that doesn't quite match its shape",
        "The ground beneath it is slightly worn, as if from centuries of presence",
        "It seems more real than its surroundings",
        "Other objects in the room orient subtly toward it",
        "It exists more emphatically than things usually do"
    ]
};

// Helper to get all weirdness modifiers as a flat array
export function getAllWeirdnessModifiers() {
    return Object.values(WEIRDNESS_MODIFIERS).flat();
}

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