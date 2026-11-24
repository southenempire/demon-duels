import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { inside, mantleTarget } from '../ash-gate/stealth.js';
import { VOID_WRAITH } from './index.js';
import { boss, cover, hasGround, patrols, rift, roofs, shade, spawn, tears } from './layout.js';
import { canStrikeWraith, hearsWraith, tearDestination } from './stealth.js';

test('west rooftops can be climbed in sequence on the way to the tear', () => {
  assert.equal(mantleTarget(spawn.x, 10.8, 0, roofs).h, roofs[0].h);
  assert.equal(mantleTarget(-6.5, 5.65, roofs[0].h, roofs).h, roofs[1].h);
  assert.equal(hasGround(-6.7, (rift.near + rift.far) / 2), false);
  assert.equal(hasGround(8.4, (rift.near + rift.far) / 2), true);
  assert.equal(tearDestination(tears[0].x, tears[0].z, 0), tears[1]);
  assert.equal(tearDestination(tears[1].x, tears[1].z, 0), tears[0]);
  assert.equal(tearDestination(tears[0].x, tears[0].z, 2), null);
  assert.equal(tearDestination(spawn.x, spawn.z, 0), null);
  for (const { route } of patrols) {
    for (let i = 0; i < route.length; i++) {
      const [x, z] = route[i], [nextX, nextZ] = route[(i + 1) % route.length];
      for (let j = 0; j <= 20; j++) {
        const px = x + (nextX - x) * j / 20, pz = z + (nextZ - z) * j / 20;
        assert.ok(hasGround(px, pz) && ![...roofs, ...cover].some((wall) => inside(px, pz, wall)));
      }
    }
  }
});

test('the blind Wraith hears gait in any direction, regardless of which way it faces', () => {
  const behind = { x: boss.x, z: boss.z - 5.8, height: 0, moving: true };
  assert.equal(hearsWraith(behind), true);
  assert.equal(hearsWraith({ ...behind, sneak: true }), false);
  assert.equal(hearsWraith({ ...behind, z: boss.z - 11.8, running: true }), true);
  assert.equal(hearsWraith({ ...behind, z: boss.z - 12.1, running: true }), false);
  assert.equal(hearsWraith({ ...behind, moving: false }), false);
  const close = { ...behind, z: boss.z + 1.5, sneak: true };
  assert.equal(hearsWraith(close), true);
  assert.equal(hearsWraith({ ...close, hidden: true }), false);
});

test('crouching through the last rift shadow allows a close strike from the front', () => {
  const approach = { x: -3.9, z: -9.75, height: 0, sneak: true, alert: false, walls: [...cover, ...roofs] };
  assert.ok(shade.some((patch) => inside(approach.x, approach.z, patch)));
  assert.equal(hearsWraith({ ...approach, moving: true, hidden: true }), false);
  assert.equal(canStrikeWraith(approach), true);
  assert.equal(canStrikeWraith({ ...approach, sneak: false }), false);
  assert.equal(canStrikeWraith({ ...approach, alert: true }), false);
  assert.equal(canStrikeWraith({ ...approach, walls: [{ x: -3.1, z: -10.3, w: .8, d: .8 }] }), false);
});

test('the engine descriptor builds Hollow Rift for opponent 1 with the Wraith model', () => {
  assert.equal(VOID_WRAITH.id, 1);
  assert.equal(VOID_WRAITH.opponentKind, 1);
  assert.equal(VOID_WRAITH.boss.model, 'void-wraith.glb');
  const scene = new T.Scene();
  const level = VOID_WRAITH.scenery(T, scene);
  assert.ok(scene.children.some((node) => node.isInstancedMesh));
  assert.equal(level.roofs, roofs);
  assert.equal(level.coverZones, shade);
  assert.equal(VOID_WRAITH.hooks.interactionAt(tears[0]).destination, tears[1]);
  level.update(1);
});
