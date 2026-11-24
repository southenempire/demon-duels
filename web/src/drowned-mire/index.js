import {
  bossPosition, concealedAt, fogDensity, inWater, patrols, sightRange, spawn, speedAt,
} from './layout.js';
import { scenery } from './scenery.js';

if (import.meta.env) import('./style.css');

export const DROWNED_MIRE = {
  id: 3,
  opponentKind: 3,
  name: 'Drowned Mire',
  chapter: 'IV / THE UNDERWORLD',
  scenery,
  spawn,
  boss: {
    name: 'Mire Phantom', model: 'mire-phantom.glb', height: 3.08, pos: bossPosition, facing: Math.PI,
    range: 8, halfAngle: Math.PI / 3,
  },
  patrols,
  palette: { background: 0x233a38 },
  fog: { color: 0x49665d, density: fogDensity(0) },
  audio: { ambient: 'amb-circle-3', footstep: false },
  objective: ({ z, outcome, touch }) => outcome === 'won' ? 'The waters clear. A fourth rune returns.'
    : z < -8 ? 'Circle behind Mire Phantom, practice a hand-block, then Strike.'
      : touch ? 'Crouch in the flooded lanes. Climb the west rooftops and cross when the fog rolls in.'
        : 'Crouch (C) in the flooded lanes. Climb (Space) the west roofs and use the fog to cross.',
  copy: {
    enter: 'The mire keeps every broken promise. It is very, very deep.',
    strike: 'The water is only as deep as your regret.',
    hidden: 'Hidden in the mire',
    roof: 'Above the flooded lanes',
    seen: 'It sees you. Crouch in the water to disappear.',
    reset: 'Back at the causeway. Stay low in the water, or take the rooftops.',
    defeat: 'One more promise for the mire. Return to challenge Mire Phantom again.',
    victory: 'The waters clear. Your reflection is no longer alone.',
  },
  tells: {
    ghost: ['Mire Phantom favors Hex.', 'Ward reflects Hex.'],
    shadow: ['Mire Phantom favors Hex.'],
  },
  hooks: {
    speedAt, concealedAt, sightRange,
    onStep(pos) {
      window.dispatchEvent(new CustomEvent('demon-duels:audio', {
        detail: { cue: inWater(pos) ? 'step-water' : 'step-stone', circle: 3 },
      }));
    },
  },
};

export default DROWNED_MIRE;
