import { buildCitadel } from './scenery.js';
import { boss, crowdCover, heardOnBone, limits, obstacles, patrols, roofs, spawn, strikeFrom, walls } from './stealth.js';
import { sees } from '../ash-gate/stealth.js';

export const MARROW_KING = {
  id: 2, opponentKind: 2, name: 'Bone Citadel', chapter: 'III / THE UNDERWORLD',
  spawn,
  boss: {
    name: 'Marrow King', model: 'marrow-king.glb', height: 2.744,
    pos: { x: boss.x, y: boss.y, z: boss.z }, facing: boss.yaw, range: boss.range, halfAngle: boss.halfAngle,
  },
  patrols: patrols.map((route) => ({ route, range: 5.9, halfAngle: Math.PI / 4 })),
  palette: { background: 0x292338 },
  fog: { color: 0x292338, density: .038 },
  audio: { ambient: 'amb-circle-2', footstep: 'step-bone' },
  tells: {
    ghost: ['The King favors Rend.', 'Ward is his least common move.'],
    shadow: ['The King favors Rend.'],
  },
  copy: {
    enter: 'A palace built of challengers. Mind where you step. The floors talk.',
    hidden: 'Blended with the court.',
    roof: 'Above the patrols.',
    seen: 'The King noticed you. Crouch and take the high perch.',
    alerted: 'An uninvited guest! Lose the patrol.',
    reset: 'Back at the threshold. Crouch in the court or take the catwalks.',
    strike: 'I’m not here for the throne. Just the crown.',
    victory: 'The crown falls. The dead make way for the living.',
    defeat: 'The King still holds court. Approach again to strike.',
  },
  objective: ({ y, z, outcome, touch }) => outcome === 'won' ? 'The crown has fallen.'
    : y > boss.y + .7 ? 'Move to the edge of the perch and strike from above.'
      : z < -6.5 && y > 3 ? (touch ? 'Practice hand-block by the throne, then climb the perch.'
        : 'Practice hand-block (Q) by the throne, then climb the perch.')
        : 'Blend with the court on the left, then climb the bone roofs to the throne.',
  scenery(_three, scene) {
    return { limits, roofs, barriers: walls, animate: buildCitadel(scene) };
  },
  hooks: {
    concealedAt: ({ x, y, z }, { crouched }) => y > boss.y + .7 || crowdCover(x, z, y, crouched),
    sightRange: (guard, { y }) => Math.abs((guard.y ?? 0) - y) > 1.25 ? 0 : guard.range,
    detectsBoss: ({ x, y, z }, { crouched, running, moving, concealed }) => {
      if (concealed || Math.abs(y - boss.y) > 1.25) return false;
      const blockers = obstacles.filter((obstacle) => obstacle.h > y + .05);
      const gait = !moving ? 'idle' : crouched ? 'sneak' : running ? 'sprint' : 'walk';
      return sees(boss, x, z, blockers, false) || heardOnBone(boss, x, z, y, gait);
    },
    canStrikeBoss: ({ x, y, z }, { alert }) => Boolean(strikeFrom(x, z, y, alert)),
  },
};
