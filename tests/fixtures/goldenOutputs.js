/**
 * Golden outputs - Expected high-quality examples for regression testing
 * These serve as benchmarks for LLM generation quality
 */

export const GOLDEN_LEVEL_INTRODUCTIONS = [
  {
    context: {
      levelNumber: 1,
      levelType: 'basic',
      dominantTile: 'grass',
      monsterCount: 3,
      monsterTypes: { zombie: 2, chaser: 1 }
    },
    examples: [
      "You step into a verdant chamber where soft grass somehow thrives beneath ancient stone. The air shifts with shambling presences, and decay mingles with the earthy scent of growth.",
      "Grass carpets the floor of this methodically built room, an unexpected oasis of green in the depths. Three shapes move in the shadows, their shuffling gaits speaking of unnatural persistence."
    ]
  },
  {
    context: {
      levelNumber: 2,
      levelType: 'cave',
      dominantTile: 'moss',
      monsterCount: 5,
      monsterTypes: { chaser: 5 }
    },
    examples: [
      "You emerge into a natural cavern where moisture-slick moss clings to every surface. Multiple pairs of hungry eyes gleam from hidden alcoves, tracking your every move.",
      "The rough-hewn cave opens before you, its damp moss-covered walls glistening in the dim light. Low growls reverberate through the chamber as predatory shapes circle in the darkness."
    ]
  }
];

export const GOLDEN_ARTIFACT_DESCRIPTIONS = [
  {
    context: {
      title: 'Whispering Root',
      material: 'petrified wood',
      tileType: 'dirt',
      position: 'in the very center'
    },
    example: "A length of petrified root, veined with brittle crystal, lies half-claimed by the soil. Touch draws a hush from the ground—memory rising like cold breath from a cellar stair."
  },
  {
    context: {
      title: 'Echo Tablet',
      material: 'ancient stone',
      tileType: 'cobblestone',
      position: 'near the western wall'
    },
    example: "A flat slab rests against time-smoothed stone; its face refuses dust. The chamber holds its breath, and for a moment the floor seems to remember your footsteps before you make them."
  },
  {
    context: {
      title: 'Frost Shard',
      material: 'blue crystal',
      tileType: 'stone',
      position: 'in the northeast corner',
      environmentalType: 'enclosed'
    },
    example: "A jagged crystal, cold as winter's heart, lies nestled in the corner shadows. The surrounding stones seem to recoil from its chill, and your breath fogs the air as you draw near."
  }
];

/**
 * Test prompts that should produce good results
 */
export const TEST_PROMPTS = {
  levelIntroduction: {
    basic: `
You are the Chamber Herald—an AI narrator who writes a vivid 2‑3 sentence introduction when an adventurer steps into a new chamber of a dungeon.

<chamber>
  <level>1</level>
  <chamber_type>basic</chamber_type>
  <floor>soft, verdant grass that somehow thrives in this underground realm</floor>
  <monster_count>3</monster_count>
  <monster_type>zombie</monster_type>
  <static_object_count>2</static_object_count>
  <artifact_title>Ancient Relic</artifact_title>
  <artifact_description>A mysterious stone tablet covered in fading runes.</artifact_description>
</chamber>`,

    cave: `
You are the Chamber Herald—an AI narrator who writes a vivid 2‑3 sentence introduction when an adventurer steps into a new chamber of a dungeon.

<chamber>
  <level>3</level>
  <chamber_type>cave</chamber_type>
  <floor>damp, moss-covered stones that glisten with moisture</floor>
  <monster_count>5</monster_count>
  <monster_type>chaser</monster_type>
  <static_object_count>1</static_object_count>
  <artifact_title>NONE</artifact_title>
  <artifact_description>NONE</artifact_description>
</chamber>`
  },

  artifact: {
    simple: `
You are the Archivist—an AI scribe who crafts short, vivid blurbs for mysterious artifacts.

<artifact>
  <seed>L1:15,10</seed>
  <title>Whispering Root</title>
  <materials>petrified wood (weathered)</materials>
  <form>rod</form>
  <motif>spiral patterns</motif>
  <tile>dirt</tile>
  <position>in the very center</position>
  <proximity>Light streams from above, and you sense the room's heart beating here.</proximity>
  <environment>The dusty earth here feels ancient and dry.</environment>
  <power_hint>whispers forgotten knowledge</power_hint>
  <themes>ancient, earthy, cryptic</themes>
</artifact>`,

    complex: `
You are the Archivist—an AI scribe who crafts short, vivid blurbs for mysterious artifacts.

<artifact>
  <seed>L5:25,15</seed>
  <title>Echo Tablet</title>
  <materials>ancient stone (smooth and weathered)</materials>
  <form>tablet</form>
  <motif>geometric patterns</motif>
  <tile>cobblestone</tile>
  <position>near the western wall</position>
  <proximity>The walls press close here, creating a sense of enclosure.</proximity>
  <environment>The cobblestones here speak of careful, deliberate construction from a bygone era.</environment>
  <power_hint>reflects the past</power_hint>
  <themes>architectural, temporal, enigmatic</themes>
</artifact>`
  }
};

/**
 * Bad outputs that should be detected and flagged
 */
export const BAD_EXAMPLES = {
  hasXMLTags: '<description>You enter a chamber.</description> <think>This is bad</think>',
  hasCodeFence: '```\nYou enter a chamber with ancient stones.\n```',
  hasFormatIndicator: 'xml\nYou step into a dark room.',
  tooShort: 'A room.',
  tooGeneric: 'You walk into a room. It has things in it. There are monsters.',
  hasClichés: 'In the heart of the dungeon, you note that at the end of the day, this chamber is important.',
  missingContext: 'You enter a beautiful chamber full of light and joy.' // Ignores dark dungeon context
};
