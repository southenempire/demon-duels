import {
  bossPosition, concealedAt, fogDensity, patrols, sightRange, spawn, speedAt,
} from './layout.js';
import { scenery } from './scenery.js';

export const DROWNED_MIRE = {
  id: 3,
  opponentKind: 3,
  name: 'Drowned Mire',
  chapter: 'IV / THE UNDERWORLD',
  scenery,
  spawn,
  boss: { name: 'Mire Phantom', model: 'mire-phantom.glb', height: 3.08, pos: bossPosition, facing: Math.PI },
  patrols,
  palette: { background: 0x233a38, fog: { color: 0x49665d, density: fogDensity(0) } },
  hooks: { speedAt, concealedAt, sightRange },
};

export default DROWNED_MIRE;
