import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { canStrike, mantleTarget } from '../../ash-gate/stealth.js';
import circle from './index.js';
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
  assert.equal(surfaceAt(circle.spawn), 'stone');
  assert.equal(surfaceAt({ x: -.6, z: -10.1 }), 'stone');
  const boss = { ...circle.boss.pos, yaw: circle.boss.facing, range: 6.4, halfAngle: .61 };
  assert.equal(canStrike(-.6, -10.1, boss, colliders, false), true);
  assert.equal(canStrike(boss.x, boss.z + 1.5, boss, colliders, false), false);
});

test('ice changes ground speed and only the cave interior provides ground concealment', () => {
  assert.equal(circle.hooks.speedAt({ x: 3, z: 5 }), 1.3);
  assert.equal(circle.hooks.speedAt({ x: 3, y: 2, z: 5 }), 1);
  assert.equal(circle.hooks.speedAt(circle.spawn), 1);
  assert.equal(circle.hooks.concealedAt({ x: -9.5, z: 6, y: 3 }), false);
  assert.equal(circle.hooks.concealedAt(circle.spawn), false);
});

test('only snow steps leave visible investigation targets that each expire after eight seconds', () => {
  const scene = new T.Scene();
  circle.scenery(T, scene);
  const prints = scene.getObjectByName('Snow footprints');
  const { onStep, investigateTargets } = circle.hooks;
  const first = { x: -3, z: 8 };
  const second = { x: -2.5, z: 7 };

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
