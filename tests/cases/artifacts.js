/**
 * Test cases for artifact description generation
 * Each case provides structured XML input and expected quality criteria
 *
 * SLOT-BASED GENERATION:
 * - Artifacts use 2 slots: placement, effect
 * - Slots are assembled with period: `${placement}. ${effect}.`
 * - Observed length: ~40-65 words (small models struggle with strict word limits)
 * - Max threshold: 75 words (catches excessive outliers)
 */

export const ARTIFACT_TEST_CASES = [
  {
    name: 'Iron Lens on Grass',
    xml: `<artifact>
  <seed>L1:10,5</seed>
  <title>Iron Lens</title>
  <materials>iron (polished)</materials>
  <form>lens</form>
  <motif>angular</motif>
  <tile>grass</tile>
  <position>in the center</position>
  <proximity>It sits prominently, impossible to miss.</proximity>
  <environment>The grass bends toward the artifact even without wind, each blade oriented like an antenna receiving something you cannot hear.</environment>
  <power_hint>glows with inner light when handled near the grass</power_hint>
  <themes>root-networked, sensing, collective whisper, substrate-aware, blade-antenna, field-mind</themes>
  <weirdness_hint>Your shadow bends toward it</weirdness_hint>
</artifact>`,
    context: {
      minWords: 20,
      maxWords: 75, // Catches excessive outliers (observed range: 40-65)
      expectedElements: ['Iron Lens'] // Must preserve title exactly
    }
  },

  {
    name: 'Void Shard in Moss Cave',
    xml: `<artifact>
  <seed>L3:20,8</seed>
  <title>Void Shard</title>
  <materials>crystal (rough)</materials>
  <form>shard</form>
  <motif>geometric</motif>
  <tile>moss</tile>
  <position>near the western wall</position>
  <proximity>The walls seem to have protected it from the elements.</proximity>
  <environment>The moss has grown around it in deliberate patterns—or perhaps the artifact taught the moss how to grow.</environment>
  <power_hint>whispers in an unknown tongue when handled near the moss</power_hint>
  <themes>symbiotic, metabolic, breathing substrate, living membrane, host-organism, slow digestion</themes>
  <weirdness_hint>It seems slightly larger when you're not looking directly at it</weirdness_hint>
</artifact>`,
    context: {
      minWords: 20,
      maxWords: 75, // Catches excessive outliers (observed range: 40-65)
      expectedElements: ['Void Shard']
    }
  },

  {
    name: 'Rust Choir on Stone',
    xml: `<artifact>
  <seed>L5:15,12</seed>
  <title>Rust Choir</title>
  <materials>wrought iron (hammer-marked)</materials>
  <form>reliquary</form>
  <motif>cogwork filigree</motif>
  <tile>stone</tile>
  <position>in the northwest corner</position>
  <proximity>The walls seem to have protected it from the elements.</proximity>
  <environment>The stone beneath it is older than language—it has waited for this artifact, or the artifact has waited for you to find it here.</environment>
  <power_hint>stores the echo of footsteps in stone</power_hint>
  <themes>planetary-bone, pressure-formed, deep-time witness, mountain-fragment, elemental patience, tectonic memory</themes>
  <weirdness_hint>It has been waiting here longer than the chamber has existed</weirdness_hint>
</artifact>`,
    context: {
      minWords: 20,
      maxWords: 75, // Catches excessive outliers (observed range: 40-65)
      expectedElements: ['Rust Choir']
    }
  },

  {
    name: 'Foundry Eye near Water',
    xml: `<artifact>
  <seed>L7:8,18</seed>
  <title>Foundry Eye</title>
  <materials>bronze (verdigris-stained)</materials>
  <form>pendant</form>
  <motif>turbine crests</motif>
  <tile>water</tile>
  <position>near the eastern wall</position>
  <proximity>It rests quietly on the ancient floor.</proximity>
  <environment>The water's surface shows the artifact twice—once as it is, once as it might be, and the two images do not quite match.</environment>
  <power_hint>shows you standing somewhere you haven't reached yet</power_hint>
  <themes>threshold-state, depth-liar, reflection-elsewhere, surface-membrane, fluid boundary, drowned perspective</themes>
  <weirdness_hint>The moment you saw it feels like it happened twice</weirdness_hint>
</artifact>`,
    context: {
      minWords: 20,
      maxWords: 75, // Catches excessive outliers (observed range: 40-65)
      expectedElements: ['Foundry Eye']
    }
  }
];
