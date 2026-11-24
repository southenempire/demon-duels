import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { huntProfile, profileFor } from '../ash-gate/encounter.js';
import { canStrike, circleRules, mantleTarget, obstruction, outcomeOnReturn } from '../ash-gate/stealth.js';
import { circleState, freshCampaign } from '../campaign.js';
import { resolveWorldCircle, worlds } from '../worlds.js';
import { DROWNED_MIRE } from './index.js';
import { colliders, fogDensity, roofs } from './layout.js';

test('the fourth circle uses the Mire Phantom and requires a Marrow King seal', async () => {
  const { id, opponentKind, boss } = DROWNED_MIRE;
  const route = new URLSearchParams('world=3d&circle=3');
  assert.equal(id, 3);
  assert.equal(opponentKind, 3);
  assert.equal(boss.model, 'mire-phantom.glb');
  const campaign = freshCampaign();
  campaign.wins.push({ bossId: 0, duel: 'ash' }, { bossId: 1, duel: 'void' });
  assert.equal(circleState(campaign, id), 'locked');
  assert.notEqual(resolveWorldCircle(route, campaign), id);
  campaign.wins.push({ bossId: 2, duel: 'marrow' });
  assert.equal(circleState(campaign, id), 'available');
  const available = resolveWorldCircle(route, campaign);
  assert.equal(available, id);
  assert.equal(await worlds[available](), DROWNED_MIRE);
});

test('water halves movement and conceals crouching hunters, unlike boardwalks and rooftops', () => {
  const { speedAt, concealedAt } = DROWNED_MIRE.hooks;
  const { concealed } = circleRules(DROWNED_MIRE.hooks);
  const water = { x: -8.5, y: 0, z: 3 };
  const causeway = { x: -6.2, y: 0, z: -7 };
  const roof = { x: -5.8, y: 2.6, z: 7.5 };
  assert.equal(speedAt(water), .5);
  assert.equal(concealed(water, { crouched: false }, () => true), false);
  assert.equal(concealed(water, { crouched: true }, () => false), true);
  for (const dry of [DROWNED_MIRE.spawn, causeway, roof]) {
    assert.equal(speedAt(dry), 1);
  }
  assert.equal(concealedAt(causeway, { crouched: true }), false);
  assert.equal(concealedAt(roof, { crouched: false }), true);
});

test('fog pulses shorten vision to three units and clear again without extending shorter ranges', () => {
  const { sightRange } = DROWNED_MIRE.hooks;
  const guard = { range: 6 };
  assert.equal(sightRange(guard, { time: 4 }), 6);
  assert.equal(sightRange(guard, { time: 6 }), 4.5);
  assert.equal(sightRange(guard, { time: 9 }), 3);
  assert.equal(sightRange({ range: 2 }, { time: 9 }), 2);
  assert.equal(sightRange(guard, { time: 15 }), 6);
  assert.equal(sightRange(guard, { time: 24 }), 3);
  assert.ok(fogDensity(9) > fogDensity(4));
});

test('the western route has a climbable roof chain and a clear flank behind the boss', () => {
  const lower = mantleTarget(-5.8, 9.65, 0, roofs);
  assert.equal(lower?.h, 2.6);
  assert.equal(mantleTarget(-6.7, 5.95, lower.h, roofs)?.h, 3.82);
  const { pos, facing, range, halfAngle } = DROWNED_MIRE.boss;
  const boss = { ...pos, yaw: facing, range, halfAngle };
  assert.equal(canStrike(0, -12.55, boss, colliders, false), true);
  assert.equal(canStrike(0, -8.85, boss, colliders, false), false);
});

test('guard patrols have an unobstructed loop through the ruins', () => {
  assert.equal(DROWNED_MIRE.patrols.length, 3);
  for (const { route } of DROWNED_MIRE.patrols) {
    for (const [i, [x, z]] of route.entries()) {
      const [nextX, nextZ] = route[(i + 1) % route.length];
      assert.equal(obstruction(x, z, nextX, nextZ, colliders, .12), 1, `${x}, ${z} to ${nextX}, ${nextZ}`);
    }
  }
});

test('the hunt profile and matched duel return use the Mire Phantom and its launching circle', () => {
  const { id, opponentKind, tells } = DROWNED_MIRE;
  const launch = { opponentKind, mode: 'chain', returnToMap: true, circle: id, ...huntProfile(false, false, tells) };
  assert.deepEqual(profileFor(launch), { opponentKind: 3, circle: 3, grade: 'ghost', tells: tells.ghost });
  const result = { ...launch, duel: 'mire-room', won: true, bossBound: true };
  assert.equal(outcomeOnReturn(result, launch, id), null);
  assert.equal(outcomeOnReturn(result, { ...launch, duel: result.duel }, id), 'won');
  assert.equal(outcomeOnReturn({ ...result, mode: 'pvp' }, result, id), null);
  assert.equal(outcomeOnReturn({ ...result, opponentKind: 2 }, result, id), null);
});

test('the scenery can build its Three scene and supplies geometry for the shared engine', () => {
  const scene = new T.Scene();
  const map = DROWNED_MIRE.scenery(T, scene);
  assert.deepEqual(map.roofs, roofs);
  assert.deepEqual(map.ledges, roofs);
  assert.ok(map.roofs.every((roof) => map.colliders.includes(roof)));
  assert.ok(map.coverZones.length >= 3);
  assert.ok(scene.children.some((item) => item.isDirectionalLight));
  assert.ok(scene.children.some((item) => item.isInstancedMesh));
});
