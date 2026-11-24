import { obstruction } from '../ash-gate/stealth.js';
import { boss, tears } from './layout.js';

const noise = { sneak: 1, walk: 3, sprint: 6 };

export function hearsWraith({ x, z, height, moving, sneak, running, hidden }) {
  if (!moving) return false;
  const gait = sneak ? 'sneak' : running ? 'sprint' : 'walk';
  const radius = noise[gait] * 2 * (sneak && hidden && height < .3 ? .5 : 1);
  return Math.hypot(x - boss.x, height, z - boss.z) <= radius;
}

export function canStrikeWraith({ x, z, height, sneak, alert, walls }) {
  const distance = Math.hypot(x - boss.x, z - boss.z);
  return sneak && !alert && height < .3 && distance >= .74 && distance <= 2.5
    && obstruction(x, z, boss.x, boss.z, walls) === 1;
}

export function tearDestination(x, z, height) {
  if (height > .35) return null;
  const from = tears.findIndex((tear) => Math.hypot(x - tear.x, z - tear.z) <= 1.3);
  return from === -1 ? null : tears[1 - from];
}
