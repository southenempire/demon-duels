import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { canStrike, inside, mantleTarget, obstruction, sees } from '../ash-gate/stealth.js';
import { bossModel } from '../duel3d/fighter.js';
import gloam, { GLOAM_STRIKE } from './index.js';

const hall = gloam.scenery(T, new T.Scene());
const { concealedAt } = gloam.hooks;
const shade = { ...gloam.boss.pos, yaw: gloam.boss.facing, range: 6.4, halfAngle: .61 };

test('Gloam Throne uses the Gloam Shade model and the real chain Strike', () => {
  assert.equal(gloam.id, 5);
  assert.equal(gloam.opponentKind, gloam.id);
  assert.equal(gloam.boss.model, 'gloam-shade.glb');
  assert.equal(gloam.boss.model, bossModel(gloam.opponentKind));
  assert.deepEqual(GLOAM_STRIKE, { opponentKind: gloam.opponentKind, mode: 'chain', returnToMap: true });
});

test('light replaces darkness as concealment without marking every roof as safe', () => {
  const inLight = { x: -2.15, z: -12.3, height: 0 };
  const inDark = { x: 0, z: inLight.z, height: 0 };
  for (const pos of [inLight, inDark]) assert.equal(sees(shade, pos.x, pos.z, hall.colliders, false), true);
  assert.equal(sees(shade, inLight.x, inLight.z, hall.colliders, concealedAt(inLight)), false);
  assert.equal(sees(shade, inDark.x, inDark.z, hall.colliders, concealedAt(inDark)), true);
  assert.equal(concealedAt({ x: -8, z: 5.6, height: 2.65 }), true);
  assert.equal(concealedAt({ x: -8, z: 5.6, height: 0 }), false);
  assert.equal(concealedAt({ x: 8.65, z: 1, height: 3.9 }), false);
});

test('the west roofs are mantleable in order and lead to a hidden flank Strike', () => {
  assert.equal(concealedAt(gloam.spawn), true);
  const first = mantleTarget(-8, 11.65, 0, hall.ledges);
  assert.ok(first && concealedAt({ ...first, height: first.h }));
  const second = mantleTarget(first.x, 8.45, first.h, hall.ledges);
  assert.ok(second && second.h > first.h && concealedAt({ ...second, height: second.h }));
  const third = mantleTarget(second.x, 3.02, second.h, hall.ledges);
  assert.ok(third && third.h > second.h && concealedAt({ ...third, height: third.h }));

  const groundRoute = [[-8, -3.4], [-8, -10.45], [-2.15, -10.45], [-2.15, -16.4]];
  for (let i = 1; i < groundRoute.length; i++) {
    const [x, z] = groundRoute[i - 1];
    const [toX, toZ] = groundRoute[i];
    assert.equal(obstruction(x, z, toX, toZ, hall.colliders, .28), 1);
    for (let step = 0; step <= 12; step++) {
      const t = step / 12;
      assert.equal(concealedAt({ x: x + (toX - x) * t, z: z + (toZ - z) * t }), true);
    }
  }
  const [x, z] = groundRoute.at(-1);
  assert.equal(canStrike(x, z, shade, hall.colliders, false), true);
  assert.equal(canStrike(x, z, shade, hall.colliders, true), false);
  assert.equal(canStrike(shade.x, shade.z + 2, shade, hall.colliders, false), false);
});

test('the patrols loop over clear ground without crossing any solid scenery', () => {
  const solids = [...hall.colliders, ...hall.barriers];
  assert.ok(gloam.patrols.length > 1);
  for (const { route } of gloam.patrols) {
    for (let i = 0; i < route.length; i++) {
      const [x, z] = route[i], [toX, toZ] = route[(i + 1) % route.length];
      assert.ok(solids.every((solid) => !inside(x, z, solid)));
      assert.equal(obstruction(x, z, toX, toZ, solids, .28), 1);
    }
  }
});
