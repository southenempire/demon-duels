import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { canStrike, inside as paddedInside, mantleTarget, obstruction } from '../../ash-gate/stealth.js';
import { huntProfile } from '../../ash-gate/encounter.js';
import { resolveWorldCircle, worlds } from '../../worlds.js';
import { FROST_HERALD as circle } from './index.js';
import { inside, surfaceAt } from './layout.js';

test('Rime Spire sets the fifth guardian and has a stone and rooftop flank route', () => {
  const scene = new T.Scene();
  const { colliders, ledges, roofs, coverZones, barriers } = circle.scenery(T, scene);
  assert.equal(circle.id, 4);
  assert.equal(circle.opponentKind, 4);
  assert.equal(circle.boss.model, 'frost-herald.glb');
  assert.equal(circle.intel.length, 3);
  assert.equal(circle.patrols.length, 3);
  for (const { route } of circle.patrols) {
    assert.ok(route.every(([x, z]) => ![...colliders, ...barriers].some((area) => inside({ x, z }, area))));
  }
  assert.ok(coverZones.every(({ x, z }) => circle.hooks.concealedAt({ x, z, y: 0 })));
  const [low, middle, high] = roofs;
  assert.equal(mantleTarget(-6.5, 5.12, 0, ledges).h, low.h);
  assert.equal(mantleTarget(low.x, 1.6, low.h, ledges).h, middle.h);
  assert.equal(mantleTarget(middle.x, -1.48, middle.h, ledges).h, high.h);
  const highEnd = high.z - high.d / 2;
  assert.ok(!colliders.some((area) => area.h > roofs[3].h && paddedInside(high.x, highEnd - .01, area, .28)));
  assert.equal(surfaceAt(circle.spawn), 'stone');
  for (let x = -6.75; x < 0; x += .25) assert.equal(surfaceAt({ x, z: -10.95 }), 'stone');
  const boss = { ...circle.boss.pos, yaw: circle.boss.facing, range: 6.4, halfAngle: .61 };
  assert.equal(canStrike(-.6, -10.95, boss, colliders, false), true);
  assert.equal(canStrike(boss.x, boss.z + 1.5, boss, colliders, false), false);
});

test('ice changes ground speed and only the cave interior provides ground concealment', () => {
  assert.equal(circle.hooks.speedAt({ x: 3, z: 5 }), 1.3);
  assert.equal(circle.hooks.speedAt({ x: 3, y: 2, z: 5 }), 1);
  assert.equal(circle.hooks.speedAt(circle.spawn), 1);
  assert.equal(circle.hooks.concealedAt({ x: -9.5, z: 6, y: 2 }), false);
  assert.equal(circle.hooks.concealedAt({ x: -5.9, z: 2.9, y: 2.7 }), true);
  assert.equal(circle.hooks.concealedAt(circle.spawn), false);
});

test('the registry unlocks Frost Herald only on the fourth seal and grades its own intel', async () => {
  const params = new URLSearchParams('world=3d&circle=4');
  const wins = [0, 1, 2, 3].map((bossId) => ({ bossId, duel: String(bossId) }));
  assert.notEqual(resolveWorldCircle(params, { wins: wins.slice(0, 3) }), circle.id);
  assert.equal(resolveWorldCircle(params, { wins }), circle.id);
  assert.equal(await worlds[4](), circle);
  assert.deepEqual(huntProfile(false, false, circle.tells), { grade: 'ghost', tells: circle.intel.slice(0, 2).map(({ text }) => text) });
  assert.deepEqual(huntProfile(false, true, circle.tells), { grade: 'shadow', tells: [circle.intel[2].text] });
  assert.deepEqual(huntProfile(true, true, circle.tells), { grade: 'exposed', tells: [] });
});

test('only ground-level ice reduces traction', () => {
  const { tractionAt } = circle.hooks;
  assert.ok(tractionAt({ x: 3, z: 5 }) > 0 && tractionAt({ x: 3, z: 5 }) < 1);
  assert.equal(tractionAt({ x: 3, y: 2, z: 5 }), 1);
  assert.equal(tractionAt({ x: -3, z: 8 }), 1);
  assert.equal(tractionAt(circle.spawn), 1);
});

test('only snow steps leave visible investigation targets that each expire after eight seconds', () => {
  const scene = new T.Scene();
  circle.scenery(T, scene);
  const prints = scene.getObjectByName('Snow footprints');
  const { onStep, investigateTargets } = circle.hooks;
  const first = { x: -4.1, z: 5 };
  const second = { x: -4.45, z: 5.8 };

  onStep(circle.spawn, { running: true });
  onStep({ x: 3, z: 5 }, { running: true });
  onStep({ x: -3, z: 8, y: 2.7 }, { running: true });
  onStep({ x: -9.5, z: 6 }, { crouched: true });
  assert.deepEqual(investigateTargets(10), []);
  onStep(first, { crouched: true });
  assert.deepEqual(investigateTargets(11), [{ pos: first, until: 19 }]);
  assert.equal(prints.count, 1);
  onStep(second, { running: true });
  assert.deepEqual(investigateTargets(13), [{ pos: first, until: 19 }, { pos: second, until: 21 }]);
  assert.equal(prints.count, 2);
  assert.deepEqual(investigateTargets(19), [{ pos: second, until: 21 }]);
  assert.equal(prints.count, 1);
  assert.deepEqual(investigateTargets(21), []);
  assert.equal(prints.count, 0);
});

test('thralls investigate reachable west-side prints but not the blocked tracks east of spawn', () => {
  const scene = new T.Scene();
  const { colliders } = circle.scenery(T, scene);
  const blocked = { x: 4, z: 12.9 };
  const reachable = { x: -4.9, z: 7 };
  const canWalkTo = ([x, z], pos) => obstruction(x, z, pos.x, pos.z, colliders, .12) === 1;
  const waypoints = circle.patrols.flatMap(({ route }) => route);
  assert.equal(surfaceAt(blocked), 'snow');
  assert.equal(surfaceAt(reachable), 'snow');
  assert.ok(waypoints.some((point) => !canWalkTo(point, blocked)));
  assert.ok(waypoints.every((point) => canWalkTo(point, reachable)));

  circle.hooks.onStep(blocked);
  circle.hooks.onStep(reachable);
  assert.deepEqual(circle.hooks.investigateTargets(1), [{ pos: reachable, until: 9 }]);
  assert.equal(scene.getObjectByName('Snow footprints').count, 2);
});
