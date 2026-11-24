import test from 'node:test';
import assert from 'node:assert/strict';
import { ASH_WARDEN, canStrike, inside, obstruction, outcomeOnReturn, sees } from './stealth.js';

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
