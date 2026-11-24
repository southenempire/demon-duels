import { circleState } from './campaign.js';

export const worlds = Object.freeze({
  0: () => import('./ash-gate/index.js').then((module) => module.ASH_GATE),
  1: () => import('./hollow-rift/index.js').then(m => m.VOID_WRAITH),
  3: () => import('./drowned-mire/index.js').then((module) => module.DROWNED_MIRE),
  5: () => import('./gloam-shade/index.js').then((module) => module.GLOAM_SHADE),
});

export function opensWorldHunt(circle, { rendererUnavailable, hasOpenDuel }, registered = worlds) {
  return !rendererUnavailable && !hasOpenDuel && Object.hasOwn(registered, circle);
}

export function resolveWorldCircle(params, campaign, registered = worlds) {
  const value = params.get('circle');
  const requested = value === null ? 0 : /^\d+$/.test(value) ? Number(value) : -1;
  if (Object.hasOwn(registered, requested) && circleState(campaign, requested) !== 'locked') return requested;
  return Object.keys(registered).map(Number)
    .filter((id) => circleState(campaign, id) !== 'locked')
    .sort((a, b) => b - a)[0];
}
