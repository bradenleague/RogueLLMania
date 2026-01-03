/**
 * Test cases for level introduction generation
 * Each case provides structured XML input and expected quality criteria
 */

export const LEVEL_INTRO_TEST_CASES = [
  {
    name: 'Basic Chamber - Grass Floor',
    xml: `<chamber>
  <level>1</level>
  <chamber_type>basic</chamber_type>
  <floor>soft, verdant grass that somehow thrives in this underground realm</floor>
  <monster_count>3</monster_count>
  <monster_type>zombie</monster_type>
  <static_object_count>2</static_object_count>
  <artifact_title>NONE</artifact_title>
  <artifact_description>NONE</artifact_description>
</chamber>`,
    context: {
      minWords: 15,
      maxWords: 50,
      expectedElements: ['grass'] // Should mention the floor type somehow
    }
  },

  {
    name: 'Cave with Chasers and Artifact',
    xml: `<chamber>
  <level>5</level>
  <chamber_type>cave</chamber_type>
  <floor>damp, moss-covered stones that glisten with moisture</floor>
  <monster_count>2</monster_count>
  <monster_type>chaser</monster_type>
  <static_object_count>1</static_object_count>
  <artifact_title>Whispering Root</artifact_title>
  <artifact_description>A length of petrified root, veined with brittle crystal, lies half-claimed by the soil.</artifact_description>
</chamber>`,
    context: {
      minWords: 15,
      maxWords: 50,
      expectedElements: ['Whispering Root'] // Must preserve artifact title
    }
  },

  {
    name: 'Pillared Hall - Many Monsters',
    xml: `<chamber>
  <level>8</level>
  <chamber_type>pillaredHall</chamber_type>
  <floor>weathered cobblestones, each bearing the marks of countless ages</floor>
  <monster_count>6</monster_count>
  <monster_type>zombie</monster_type>
  <static_object_count>3</static_object_count>
  <artifact_title>Gear Sigil</artifact_title>
  <artifact_description>A bronze disc etched with interlocking gears that turn without cause.</artifact_description>
</chamber>`,
    context: {
      minWords: 15,
      maxWords: 50,
      expectedElements: ['Gear Sigil']
    }
  },

  {
    name: 'Cave - Sand Floor, No Artifact',
    xml: `<chamber>
  <level>3</level>
  <chamber_type>cave</chamber_type>
  <floor>shifting, golden sand that whispers with each footstep</floor>
  <monster_count>1</monster_count>
  <monster_type>chaser</monster_type>
  <static_object_count>0</static_object_count>
  <artifact_title>NONE</artifact_title>
  <artifact_description>NONE</artifact_description>
</chamber>`,
    context: {
      minWords: 15,
      maxWords: 50,
      expectedElements: ['sand']
    }
  }
];
