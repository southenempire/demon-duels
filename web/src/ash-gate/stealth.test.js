import test from 'node:test';
import assert from 'node:assert/strict';
import { ASH_WARDEN, blocksRadiusStep, blocksStep, bossPatrol, cameraSweep, canStrike, circleRules, dampVelocity, inside, mantleTarget, movementAxis, nextPatrolWaypoint, obstruction, outcomeOnReturn, sees, usesWorldKey, worldFrameRuns } from './stealth.js';
import { isAshGate } from '../route.js';
import { bossMove } from '../world/bot-profile.js';
import { huntProfile, profileFor, profileKey, savedProfile } from './encounter.js';
import { separateStep } from './hunters.js';

const guard = { x: 0, z: 0, yaw: 0, range: 6, halfAngle: .5 };
const wall = { x: 0, z: -2, w: 1, d: 1 };

test('world time stops in pause, controls and duels while the title can animate', () => {
  assert.equal(worldFrameRuns('play', true, false), true);
  assert.equal(worldFrameRuns('title', true, false), true);
  assert.equal(worldFrameRuns('pause', true, false), false);
  assert.equal(worldFrameRuns('guide', true, false), false);
  assert.equal(worldFrameRuns('play', true, true), false);
  assert.equal(worldFrameRuns('play', false, false), false);
});

test('Space jumps off the HUD but preserves native button activation', () => {
  const pause = { closest: (selector) => selector.split(', ').includes('button') ? pause : null };
  const canvas = { closest: () => null };
  assert.equal(usesWorldKey({ code: 'Space', target: canvas }), true);
  assert.equal(usesWorldKey({ code: 'Space', target: pause }), false);
  assert.equal(usesWorldKey({ code: 'KeyE', target: pause }), true);
});

test('arrows mirror WASD without doubling movement or taking over form controls', () => {
  const axes = (...codes) => {
    const keys = new Set(codes);
    return [movementAxis(keys, 'forward', 'backward'), movementAxis(keys, 'right', 'left')];
  };
  assert.deepEqual(axes('ArrowUp', 'ArrowRight'), [1, 1]);
  assert.deepEqual(axes('ArrowDown', 'ArrowLeft'), [-1, -1]);
  assert.deepEqual(axes('KeyS', 'KeyA'), [-1, -1]);
  assert.deepEqual(axes('ArrowUp', 'KeyW', 'ArrowRight', 'KeyD'), [1, 1]);
  assert.deepEqual(axes('ArrowUp', 'KeyS'), [0, 0]);
  const input = { closest: (selector) => selector.split(', ').includes('input') ? input : null };
  assert.equal(usesWorldKey({ code: 'ArrowLeft', target: input }), false);
  assert.equal(usesWorldKey({ code: 'ArrowUp', target: { isContentEditable: true } }), false);
  assert.equal(usesWorldKey({ code: 'ArrowUp', target: { closest: () => null } }), true);
});

test('a patrol returning from pursuit skips waypoints blocked by a pillar', () => {
  const route = [[0, -4], [.2, -4], [2, -1]];
  assert.equal(nextPatrolWaypoint(route, 0, { x: 0, z: -1 }, [wall], () => true), 2);
});

test('bosses stand by default, or follow and pause at configured patrol points', () => {
  const boss = { x: 0, z: 0 };
  assert.equal(bossPatrol()(boss, 10), null);
  assert.deepEqual(boss, { x: 0, z: 0 });
  const walk = bossPatrol({ points: [{ x: 0, z: -1 }, { x: 1, z: -1 }], speed: 2, pause: 1 });
  assert.equal(walk(boss, .5), 0);
  assert.deepEqual(boss, { x: 0, z: -1 });
  assert.equal(walk(boss, .75), null);
  assert.equal(walk(boss, .5), -Math.PI / 2);
  assert.deepEqual(boss, { x: .5, z: -1 });
});

test('a hunter falling off an edge can walk out of collider padding but not into the ledge', () => {
  assert.equal(blocksStep(.6, -2, .7, -2, wall), false);
  assert.equal(blocksStep(.6, -2, .6, -1.9, wall), false);
  assert.equal(blocksStep(.6, -2, .55, -2, wall), true);
  assert.equal(blocksStep(.6, -2, .45, -2, wall), true);
  assert.equal(blocksStep(.8, -2, .7, -2, wall), true);
  assert.equal(blocksStep(.1, -2, .2, -2, wall), false);
  assert.equal(blocksStep(.2, -2, .1, -2, wall), true);
});

test('a hunter overlapping a returning guardian can walk out but cannot approach it', () => {
  const center = { x: 0, z: -2 };
  assert.equal(blocksRadiusStep(0, -2, .15, -2, center, .74), false);
  assert.equal(blocksRadiusStep(.2, -2, .35, -2, center, .74), false);
  assert.equal(blocksRadiusStep(.2, -2, .05, -2, center, .74), true);
  assert.equal(blocksRadiusStep(.8, -2, .65, -2, center, .74), true);
  assert.equal(blocksRadiusStep(.65, -2, .8, -2, center, .74), false);
});

test('patrol sight respects facing, range, stone and hiding in ash', () => {
  assert.equal(sees(guard, 0, -4, [], false), true);
  assert.equal(sees(guard, 0, 4, [], false), false);
  assert.equal(sees(guard, 0, -7, [], false), false);
  assert.equal(sees(guard, 3, -4, [], false), false);
  assert.equal(sees(guard, 0, -4, [wall], false), false);
  assert.equal(sees(guard, 0, -4, [], true), false);
  assert.equal(obstruction(0, 0, 0, -4, [wall]), .375);
  assert.equal(inside(.6, -2, wall, .2), true);
});

test('strike requires a close flank or rear approach without an active alert', () => {
  assert.equal(canStrike(0, 2, guard, [], false), true);
  assert.equal(canStrike(2, 0, guard, [], false), true);
  assert.equal(canStrike(0, -2, guard, [], false), false);
  assert.equal(canStrike(0, 3, guard, [], false), false);
  assert.equal(canStrike(0, 2, guard, [], true), false);
  assert.equal(canStrike(0, 2, guard, [{ ...wall, z: 1 }], false), false);
  assert.deepEqual(ASH_WARDEN, { opponentKind: 0, mode: 'chain', returnToMap: true });
});

test('omitted terrain hooks keep the world traversable with standard sight and Strike rules', () => {
  const rules = circleRules();
  const pos = { x: 0, y: 0, z: -2 };
  assert.equal(rules.canTraverse(pos), true);
  assert.equal(rules.tractionAt(pos), 1);
  assert.equal(rules.interactionAt(pos), null);
  assert.equal(rules.concealed(pos, {}, () => true), true);
  assert.equal(rules.detectsBoss(pos, {}, () => sees(guard, pos.x, pos.z, [], false)), true);
  assert.equal(rules.canStrikeBoss(pos, {}, () => canStrike(pos.x, pos.z, guard, [], false)), false);
  const custom = circleRules({ concealedAt: () => false, detectsBoss: () => false, canStrikeBoss: () => true, canTraverse: () => false });
  assert.equal(custom.concealed(pos, {}, () => true), false);
  assert.equal(custom.detectsBoss(pos, {}, () => true), false);
  assert.equal(custom.canStrikeBoss(pos, {}, () => false), true);
  assert.equal(custom.canTraverse(pos), false);
});

test('ice preserves momentum on release while ordinary terrain stops immediately', () => {
  assert.equal(dampVelocity(4, 0, 1, .1), 0);
  assert.ok(dampVelocity(4, 0, .1, .1) > 2);
  assert.equal(circleRules({ tractionAt: () => -2 }).tractionAt({}), 0);
});

test('investigation hooks can filter by guard position and still accept time-only callbacks', () => {
  const target = { pos: { x: 0, z: -1 }, until: 5 };
  const rules = circleRules({
    investigateTargets: (time, { x, z }) =>
      time < target.until && Math.hypot(target.pos.x - x, target.pos.z - z) < 2 ? [target] : [],
  });
  assert.deepEqual(rules.investigateTargets(1, guard), [target]);
  assert.deepEqual(rules.investigateTargets(1, { ...guard, x: 6 }), []);
  assert.deepEqual(rules.investigateTargets(5, guard), []);
  assert.deepEqual(circleRules({ investigateTargets: (time) => time === 1 ? [target] : [] }).investigateTargets(1, guard), [target]);
  assert.deepEqual(circleRules().investigateTargets(1, guard), []);
});

test('the same bound chain duel must settle before the map credits its result', () => {
  const returned = { mode: 'chain', opponentKind: 0, duel: 'warden', result: { winner: 0 } };
  const settled = { mode: 'chain', opponentKind: 0, duel: 'warden', bossBound: true, won: true };
  assert.equal(outcomeOnReturn(settled, returned), 'won');
  assert.equal(outcomeOnReturn({ ...settled, won: false }, returned), 'lost');
  assert.equal(outcomeOnReturn(null, returned), null);
  assert.equal(outcomeOnReturn(settled, { ...returned, duel: 'another' }), null);
  assert.equal(outcomeOnReturn({ ...settled, mode: 'practice' }, returned), null);
  assert.equal(outcomeOnReturn({ ...settled, bossBound: false }, returned), null);
  assert.equal(outcomeOnReturn({ ...settled, opponentKind: 1 }, returned), null);
  assert.equal(outcomeOnReturn({ ...settled, opponentKind: 3 }, { ...returned, opponentKind: 3 }, 3), 'won');
});

test('nearby ledges are mounted in stages instead of teleporting to arbitrary roofs', () => {
  const roof = { x: 0, z: 0, w: 3, d: 3, h: 2.94 };
  const tower = { ...roof, z: -2.9, h: 4.12 };
  assert.deepEqual(mantleTarget(0, 2, 0, [roof, tower]), { x: 0, z: 1.06, h: 2.94 });
  assert.equal(mantleTarget(0, 2.5, 0, [roof]), null);
  assert.equal(mantleTarget(0, -1, 0, [tower]), null);
  const upper = mantleTarget(0, -1, 2.94, [roof, tower]);
  assert.equal(upper.h, 4.12);
  assert.ok(Math.abs(upper.z - (-1.84)) < .0001);
});

test('Ash Gate is the default without replacing explicit backup or invite URLs', () => {
  for (const query of ['', 'world=3d']) assert.equal(isAshGate(new URLSearchParams(query)), true);
  for (const query of ['world=2d', 'world=arena', 'room=invite', 'world=3d&room=invite']) {
    assert.equal(isAshGate(new URLSearchParams(query)), false);
  }
});

test('a low marked barrier offers a vault landing on its far side', () => {
  const barrier = { x: 0, z: 0, w: 3, d: 1.2, h: 1.28, vaultable: true };
  assert.deepEqual(mantleTarget(.5, 1.25, 0, [barrier])?.exit, { x: .5, z: -1.03, land: 0 });
  assert.equal(mantleTarget(.5, 1.25, 0, [{ ...barrier, vaultable: false }])?.exit, undefined);
});

test('a camera sphere contracts before a wall and clears it above the top', () => {
  const blocker = { ...wall, h: 1.28 };
  assert.equal(cameraSweep({ x: 0, y: 2, z: 0 }, { x: 0, y: 2, z: -4 }, [blocker]), 1);
  const hit = cameraSweep({ x: 0, y: 1.4, z: 0 }, { x: 0, y: 1.4, z: -4 }, [blocker]);
  assert.ok(Math.abs(hit - .33) < .00001);
});

test('nearby hunters deflect forward movement without blocking it or affecting another level', () => {
  const peer = { x: 0, y: -.4, height: 0 };
  const [dx, dz] = separateStep(0, 0, 0, 0, -.1, [peer]);
  assert.notEqual(dx, 0);
  assert.equal(dz, -.1);
  assert.deepEqual(separateStep(0, 0, 3, 0, -.1, [peer]), [0, -.1]);
});

test('a graded Ash Warden hunt persists only valid chain intel and weights the house bot', () => {
  const profile = profileFor({ ...ASH_WARDEN, ...huntProfile(false, false) });
  assert.equal(profile.grade, 'ghost');
  assert.equal(profile.tells.length, 2);
  const store = new Map([[profileKey('warden'), JSON.stringify(profile)]]);
  assert.deepEqual(savedProfile({ getItem: (key) => store.get(key) }, 'warden'), profile);
  assert.equal(profileFor({ ...profile, mode: 'pvp' }), null);
  const mire = profileFor({ ...ASH_WARDEN, opponentKind: 3, circle: 3, worldName: 'Drowned Mire', ...huntProfile(true, false) });
  assert.equal(mire.opponentKind, 3);
  assert.equal(mire.worldName, 'Drowned Mire');
  store.set(profileKey('mire'), JSON.stringify(mire));
  assert.deepEqual(savedProfile({ getItem: (key) => store.get(key) }, 'mire'), mire);
  assert.equal(huntProfile(false, true).grade, 'shadow');
  assert.equal(huntProfile(true, true).grade, 'exposed');
  for (const roll of [.01, .30, .59]) assert.equal(bossMove(0, 'ghost', roll), 1);
  assert.equal(bossMove(0, 'ghost', .60), 0);
  assert.equal(bossMove(0, 'ghost', .90), 2);
  assert.equal(bossMove(0, 'shadow', .44), 1);
  assert.equal(bossMove(0, 'shadow', .45), 0);
  assert.equal(bossMove(0, 'shadow', .80), 2);
  assert.deepEqual([0, .34, .67].map((roll) => bossMove(0, 'exposed', roll)), [0, 1, 2]);
});
