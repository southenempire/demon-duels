import { canStrike, inside, mantleTarget, obstruction } from '../ash-gate/stealth.js';

export const MARROW_KING = Object.freeze({ opponentKind: 2, mode: 'chain', returnToMap: true });
export const spawn = { x: 0, z: 12.8 };
export const boss = { x: 0, z: -9.5, yaw: Math.PI, range: 7, halfAngle: Math.PI / 3 };
export const limits = { left: -10, right: 10, far: -14, near: 15 };
export const roofs = [
  { x: -6.1, z: 8.1, w: 3.2, d: 3.2, h: 1.35 },
  { x: -6.1, z: 4.45, w: 3.2, d: 4.06, h: 2.65 },
  { x: -6.1, z: -2.1, w: 3.2, d: 9.02, h: 3.85 },
  { x: -4.8, z: -8.8, w: 5.8, d: 4.4, h: 3.85 },
];
export const walls = [
  { x: 4.9, z: 4.7, w: 2.5, d: 4.8, h: 4.25 },
  { x: 5.5, z: -4.1, w: 2.7, d: 5.4, h: 4.7 },
  { x: 0, z: -12.65, w: 3.9, d: 1.5, h: 4.8 },
];
export const obstacles = [...roofs, ...walls];
export const crowd = [
  { x: -2.8, z: 10.65, w: 2.5, d: 3.2 },
  { x: 2.05, z: -2.45, w: 2.9, d: 3.4 },
];
export const patrols = [
  [[1, 7.8], [3.25, 7.8], [3.25, 2], [-2.3, 2], [-2.3, 7.8]],
  [[1.4, 1.4], [3.45, 1.4], [3.45, -5.9], [-2.7, -5.9], [-2.7, 1.4]],
  [[7.5, 5.3], [8.2, -9], [2.5, -9], [2.5, -11], [8.2, -11]],
];

export function crowdCover(x, z, height, sneak) {
  return height < .3 && sneak && crowd.some((area) => inside(x, z, area));
}

export function heardOnBone(guard, x, z, height, gait) {
  const noise = { sneak: .85, walk: 2.2, sprint: 3.9 }[gait] ?? 0;
  return height < .3 && noise > 0 && Math.hypot(x - guard.x, z - guard.z) <= noise * 1.5
    && obstruction(guard.x, guard.z, x, z, obstacles) === 1;
}

export function nextLedge(x, z, height) {
  return mantleTarget(x, z, height, roofs);
}

export function strikeFrom(x, z, height, alert) {
  if (alert) return null;
  const distance = Math.hypot(x - boss.x, z - boss.z);
  if (height > 2.7 && distance <= 2.55 && roofs.some((roof) => roof.h === height && inside(x, z, roof))
    && obstruction(x, z, boss.x, boss.z, walls.filter((wall) => wall.h >= height)) === 1) return 'above';
  if (height < .3 && canStrike(x, z, boss, obstacles, false)) return 'behind';
  return null;
}

export function watchMarrowClear() {
  let settlement = null;
  return {
    settle(detail) {
      if (detail?.mode === MARROW_KING.mode && detail.opponentKind === MARROW_KING.opponentKind
        && detail.bossBound && detail.won === true && detail.duel) settlement = detail.duel;
    },
    finish(detail) {
      if (!settlement || detail?.duel !== settlement || detail.opponentKind !== MARROW_KING.opponentKind) return false;
      settlement = null;
      return true;
    },
    reset() { settlement = null; },
  };
}
