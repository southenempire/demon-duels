import assert from 'node:assert/strict';
import test from 'node:test';
import { opensWorldHunt, resolveWorldCircle, worlds } from './worlds.js';

test('world links default to Ash Gate and use the highest unlocked registered fallback', () => {
  const campaign = { wins: [{ bossId: 0 }] };
  const registered = { ...worlds, 1: () => {}, 2: () => {} };
  const resolve = (query, registry) => resolveWorldCircle(new URLSearchParams(query), campaign, registry);
  assert.equal(resolve('world=3d'), 0);
  assert.equal(resolve('world=3d', registered), 0);
  assert.equal(resolve('world=3d&circle=0', registered), 0);
  assert.equal(resolve('world=3d&circle=1', registered), 1);
  assert.equal(resolve('world=3d&circle=2', registered), 1);
  assert.equal(resolve('world=3d&circle=6', registered), 1);
  assert.equal(resolve('world=3d&circle=void', registered), 1);
  assert.equal(resolve('world=3d&circle=1'), 0);
});

test('a registered guardian uses the direct duel when the world renderer fails', () => {
  assert.equal(opensWorldHunt(0, { rendererUnavailable: false, hasOpenDuel: false }), true);
  assert.equal(opensWorldHunt(0, { rendererUnavailable: true, hasOpenDuel: false }), false);
  assert.equal(opensWorldHunt(0, { rendererUnavailable: false, hasOpenDuel: true }), false);
  assert.equal(opensWorldHunt(9, { rendererUnavailable: false, hasOpenDuel: false }), false);
});
