import test from 'node:test';
import assert from 'node:assert/strict';
import { ASH_WARDEN, canStrike, inside, mantleTarget, obstruction, outcomeOnReturn, sees } from './stealth.js';
import { isAshGate } from '../route.js';
import { bossMove } from '../world/bot-profile.js';
import { huntProfile, profileFor, profileKey, savedProfile } from './encounter.js';

const guard = { x: 0, z: 0, yaw: 0, range: 6, halfAngle: .5 };
const wall = { x: 0, z: -2, w: 1, d: 1 };

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

test('a graded Ash Warden hunt persists only valid chain intel and weights the house bot', () => {
  const profile = profileFor({ ...ASH_WARDEN, ...huntProfile(false, false) });
  assert.equal(profile.grade, 'ghost');
  assert.equal(profile.tells.length, 2);
  const store = new Map([[profileKey('warden'), JSON.stringify(profile)]]);
  assert.deepEqual(savedProfile({ getItem: (key) => store.get(key) }, 'warden'), profile);
  assert.equal(profileFor({ ...profile, mode: 'pvp' }), null);
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
