import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcomeOnReturn, sees } from '../ash-gate/stealth.js';
import { MARROW_KING } from './index.js';
import { boss, crowdCover, heardOnBone, nextLedge, perch, strikeFrom } from './stealth.js';
import { resolveWorldCircle, worlds } from '../worlds.js';

test('the court conceals crouching hunters, but not upright hunters or hunters on a higher floor', () => {
  assert.equal(crowdCover(-2.8, 10.65, 0, true), true);
  assert.equal(crowdCover(-2.8, 10.65, 0, false), false);
  assert.equal(crowdCover(-2.8, 10.65, 3.8, true), false);
  assert.equal(crowdCover(0, 12.8, 0, true), false);
});

test('bone amplifies footsteps, but walls and the catwalk cut sound to the ground patrols', () => {
  const guard = { x: 0, z: 8 };
  assert.equal(heardOnBone(guard, -3, 8, 0, 'walk'), true);
  assert.equal(heardOnBone(guard, -3, 8, 0, 'sneak'), false);
  assert.equal(heardOnBone(guard, -3.4, 8, 0, 'walk'), false);
  assert.equal(heardOnBone(guard, -3, 8, 3.85, 'sprint'), false);
  assert.equal(heardOnBone({ x: 3, z: 4.7 }, 7, 4.7, 0, 'sprint'), false);
  assert.equal(MARROW_KING.hooks.detectsBoss({ x: -3.2, y: boss.y, z: -9.2 }, { moving: true }), true);
  assert.equal(MARROW_KING.hooks.detectsBoss({ x: -3.2, y: boss.y, z: -9.2 }, { moving: true, crouched: true }), false);
});

test('an unseen sprint on bone gives a patrol a temporary investigation target', () => {
  const { sightRange, onStep, investigateTargets } = MARROW_KING.hooks;
  const guard = { x: 0, z: 8, yaw: 0, range: 6, halfAngle: Math.PI / 4 };
  const behind = { x: 0, y: 0, z: 12 };
  assert.equal(sees(guard, behind.x, behind.z, [], false), false);
  assert.deepEqual(investigateTargets(10), []);
  sightRange(guard, behind);
  onStep(behind, { crouched: true });
  onStep(behind, { crouched: false, running: false });
  assert.deepEqual(investigateTargets(10.1), []);
  onStep({ ...behind, y: 3.85 }, { running: true });
  assert.deepEqual(investigateTargets(10.2), []);
  onStep(behind, { running: true });
  assert.deepEqual(investigateTargets(11).map(({ pos }) => pos), [behind]);
  assert.deepEqual(investigateTargets(12), []);
});

test('three mantles lead to the throne and its hand-block prompt, then a perch allows an aerial strike', () => {
  assert.equal(nextLedge(-6.1, 10, 0)?.h, 1.35);
  assert.equal(nextLedge(-6.1, 6.51, 1.35)?.h, 2.65);
  assert.equal(nextLedge(-6.1, 2.69, 2.65)?.h, 3.85);
  assert.equal(nextLedge(-6.1, -1, 0), null);
  const atThrone = { x: -4.1, z: -9.6, y: 3.85 };
  assert.ok(Math.abs(atThrone.y - boss.y) < .3 && Math.hypot(atThrone.x - boss.x, atThrone.z - boss.z) < 4.6);
  assert.equal(nextLedge(atThrone.x, atThrone.z, atThrone.y)?.h, perch.h);
  assert.equal(strikeFrom(-2.16, -9.72, perch.h, false), 'above');
  assert.equal(strikeFrom(-2.16, -9.72, 0, false), null);
  assert.equal(strikeFrom(0, -10.6, boss.y, false), 'behind');
  assert.equal(strikeFrom(-2.16, -9.72, perch.h, true), null);
});

test('only the matching bound Marrow King chain result is recognized on return', () => {
  const returned = { opponentKind: 2, duel: 'king-duel', mode: 'chain' };
  const settlement = { ...returned, bossBound: true, won: true };
  for (const wrong of [{ mode: 'practice' }, { mode: 'pvp' }, { opponentKind: 1 }, { duel: 'other' }, { bossBound: false }]) {
    assert.equal(outcomeOnReturn({ ...settlement, ...wrong }, returned, MARROW_KING.opponentKind), null);
  }
  assert.equal(outcomeOnReturn({ ...settlement, won: false }, returned, MARROW_KING.opponentKind), 'lost');
  assert.equal(outcomeOnReturn(settlement, returned, MARROW_KING.opponentKind), 'won');
});

test('the registered Bone Citadel opens only after the first two wins', async () => {
  const route = new URLSearchParams('world=3d&circle=2');
  const wins = [{ bossId: 0 }, { bossId: 1 }];
  assert.equal(resolveWorldCircle(route, { wins: wins.slice(0, 1) }), 0);
  assert.equal(resolveWorldCircle(route, { wins }), 2);
  assert.equal(await worlds[2](), MARROW_KING);
});
