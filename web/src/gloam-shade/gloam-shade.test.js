import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { canStrike, inside, mantleTarget, obstruction, sees } from '../ash-gate/stealth.js';
import { bossModel } from '../duel3d/fighter.js';
import { resolveWorldCircle, worlds } from '../worlds.js';
import { GLOAM_SHADE as gloam } from './index.js';

const hall = gloam.scenery(T, new T.Scene());
const { canTraverse, concealedAt } = gloam.hooks;
const shade = { ...gloam.boss.pos, yaw: gloam.boss.facing, range: 6.4, halfAngle: .61 };

test('Gloam Throne registers the matching chain boss and model after circle 5', async () => {
  assert.equal(gloam.id, 5);
  assert.equal(gloam.opponentKind, gloam.id);
  assert.equal(gloam.boss.model, 'gloam-shade.glb');
  assert.equal(gloam.boss.model, bossModel(gloam.opponentKind));
  assert.equal(await worlds[5](), gloam);
  const route = new URLSearchParams('world=3d&circle=5');
  const wins = Array.from({ length: 5 }, (_, bossId) => ({ bossId, duel: 'duel-' + bossId }));
  assert.equal(resolveWorldCircle(route, { version: 1, wins: wins.slice(0, 4) }), 0);
  assert.equal(resolveWorldCircle(route, { version: 1, wins }), gloam.id);
});

test('light replaces darkness as concealment without marking every roof as safe', () => {
  const inLight = { x: -2.15, y: 0, z: -12.3 };
  const inDark = { x: 0, y: 0, z: inLight.z };
  for (const pos of [inLight, inDark]) assert.equal(sees(shade, pos.x, pos.z, hall.colliders, false), true);
  assert.equal(sees(shade, inLight.x, inLight.z, hall.colliders, concealedAt(inLight)), false);
  assert.equal(sees(shade, inDark.x, inDark.z, hall.colliders, concealedAt(inDark)), true);
  assert.equal(concealedAt({ x: -8, y: 2.65, z: 5.6 }), true);
  assert.equal(concealedAt({ x: -8, y: 0, z: 5.6 }), false);
  assert.equal(concealedAt({ x: 8.65, y: 3.9, z: 1 }), false);
});

test('a dark rooftop exposes the hunter to a patrol without losing movement or camera collision', () => {
  const hunter = { x: 7.1, y: 2.5, z: 7.8 };
  const [x, z] = gloam.patrols[0].route[1];
  const patrol = { x, z, yaw: -Math.PI / 3, range: 6, halfAngle: .44 };
  const roof = hall.roofs.find((surface) => inside(hunter.x, hunter.z, surface));
  assert.equal(roof?.h, hunter.y);
  assert.equal(concealedAt(hunter), false);
  assert.equal(sees(patrol, hunter.x, hunter.z, [...hall.colliders, roof], false), false);
  assert.equal(sees(patrol, hunter.x, hunter.z, hall.colliders, concealedAt(hunter)), true);
  assert.equal(canTraverse({ ...hunter, y: 0 }), false);
  assert.equal(canTraverse(hunter), true);
  assert.ok(hall.cameraBlockers.includes(roof));
});

test('the west roofs are mantleable in order and lead to a hidden flank Strike', () => {
  assert.equal(concealedAt(gloam.spawn), true);
  const first = mantleTarget(-8, 11.65, 0, hall.ledges);
  assert.ok(first && concealedAt({ ...first, y: first.h }));
  const second = mantleTarget(first.x, 8.45, first.h, hall.ledges);
  assert.ok(second && second.h > first.h && concealedAt({ ...second, y: second.h }));
  const third = mantleTarget(second.x, 3.02, second.h, hall.ledges);
  assert.ok(third && third.h > second.h && concealedAt({ ...third, y: third.h }));

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
  const solids = [...hall.colliders, ...hall.roofs, ...hall.barriers];
  assert.ok(gloam.patrols.length > 1);
  for (const { route } of gloam.patrols) {
    for (let i = 0; i < route.length; i++) {
      const [x, z] = route[i], [toX, toZ] = route[(i + 1) % route.length];
      assert.ok(solids.every((solid) => !inside(x, z, solid)));
      assert.equal(obstruction(x, z, toX, toZ, solids, .28), 1);
    }
  }
});
