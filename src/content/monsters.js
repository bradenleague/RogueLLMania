/** @typedef {{hp:number,pow:number,def:number}} StatBlock */

export const MONSTERS = {
  zombie: {
    name: 'Zombie',
    glyph: 'z',
    color: '#8fbf8f',
    stats: { hp: 6, pow: 1, def: 0 },     // shambling, tanky-ish
    speed: 0.25,                          
    perception: 5,
    ai: 'zombie',                          // brain key
    tags: ['undead', 'slow'],
  },
  chaser: {
    name: 'Chaser',
    glyph: 'm',
    color: '#c44',
    stats: { hp: 3, pow: 1, def: 0 },
    speed: 1,
    perception: 6,
    ai: 'chaser',
    tags: ['aggressive'],
  },
};