import { inside } from '../ash-gate/stealth.js';
import { barriers, boss, cover, hasGround, limits, patrols, roofDecks, roofs, shade, spawn } from './layout.js';
import { buildRift } from './scenery.js';
import { canStrikeWraith, hearsWraith, tearDestination } from './stealth.js';

export const VOID_WRAITH = {
  id: 1,
  opponentKind: 1,
  name: 'Hollow Rift',
  chapter: 'II / THE UNDERWORLD',
  objective: ({ z, outcome }) => outcome === 'won' ? 'The second seal is yours.'
    : z < -4.85 ? 'The Wraith hears your steps. Crouch through the shadows to strike.'
      : 'Climb the west rooftops and find the void tear.',
  boss: { name: 'Void Wraith', model: 'void-wraith.glb', height: 3, pos: { x: boss.x, y: 0, z: boss.z }, facing: boss.yaw },
  palette: { background: 0x19152e },
  fog: { color: 0x19152e, density: .037 },
  audio: { ambient: 'amb-circle-1', footstep: 'step-stone' },
  tells: {
    ghost: ['The Wraith reaches for Hex first.', 'A Ward turns its curse back on it.'],
    shadow: ['The Wraith usually opens with Hex.'],
  },
  patrols, spawn,
  scenery(_three, scene) {
    const update = buildRift(scene);
    return { limits, colliders: [...cover, ...roofs], ledges: [], roofs: roofDecks, coverZones: shade, barriers, update };
  },
  hooks: {
    concealedAt: ({ x, y = 0, z }, { crouched }) => y > 2.35 || crouched && y < .3 && shade.some((patch) => inside(x, z, patch)),
    canTraverse: ({ x, z }) => hasGround(x, z),
    detectsBoss: ({ x, y = 0, z }, { moving, crouched, running, concealed }) =>
      hearsWraith({ x, z, height: y, moving, sneak: crouched, running, hidden: concealed }),
    canStrikeBoss: ({ x, y = 0, z }, { crouched, alert, colliders }) =>
      canStrikeWraith({ x, z, height: y, sneak: crouched, alert, walls: colliders }),
    interactionAt({ x, y = 0, z }) {
      const destination = tearDestination(x, z, y);
      return destination ? { label: 'Enter void tear', destination } : null;
    },
  },
  messages: {
    enter: 'Past the gate, the road ends. Something here listens instead of looking.',
    roof: 'Above the patrols. Follow the rift shadows to the violet tear.',
    hidden: 'Hidden in a rift shadow',
    approach: 'The Wraith hears your steps. Crouch to close in.',
    alerted: 'Loud, loud, loud. We know where you are now.',
    reset: 'Back at the threshold. Use rooftops and rift shadows.',
    strike: 'Then listen for this one. It’s sealed.',
    victory: 'The silence breaks. Something ancient has noticed your descent.',
    defeat: 'Defeat confirmed. The Wraith is still listening.',
  },
};

export default VOID_WRAITH;
