import { concealedAt, patrols, spawn, throne } from './layout.js';
import { scenery } from './scenery.js';

export const GLOAM_STRIKE = Object.freeze({ opponentKind: 5, mode: 'chain', returnToMap: true });

export default {
  id: 5,
  opponentKind: GLOAM_STRIKE.opponentKind,
  name: 'Gloam Throne',
  chapter: 'VI / THE UNDERWORLD',
  objective: 'Here, the dark is its eyes. Follow the lit rooftops and flank the Gloam Shade.',
  scenery,
  spawn,
  boss: { model: 'gloam-shade.glb', height: 3, pos: throne, facing: Math.PI },
  patrols,
  palette: { background: 0x191529 },
  fog: { color: 0x191529, density: .031 },
  audio: { footstep: 'step-stone' },
  hooks: { concealedAt },
};
