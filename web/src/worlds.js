import { circleState } from './campaign.js';

export const worlds = Object.freeze({
  0: () => import('./ash-gate/index.js').then((module) => module.ASH_GATE),
  4: () => import('./world/rime-spire/index.js').then((module) => module.FROST_HERALD),
});

export function resolveWorldCircle(params, campaign, registered = worlds) {
  const value = params.get('circle');
  const requested = value === null ? 0 : /^\d+$/.test(value) ? Number(value) : -1;
  if (Object.hasOwn(registered, requested) && circleState(campaign, requested) !== 'locked') return requested;
  return Object.keys(registered).map(Number)
    .filter((id) => circleState(campaign, id) !== 'locked')
    .sort((a, b) => b - a)[0];
}
