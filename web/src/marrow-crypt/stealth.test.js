import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MARROW_KING, crowdCover, heardOnBone, nextLedge, strikeFrom, watchMarrowClear } from './stealth.js';

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
});

test('three mantles lead up to an aerial strike that is not available from the court floor', () => {
  assert.equal(nextLedge(-6.1, 10, 0)?.h, 1.35);
  assert.equal(nextLedge(-6.1, 6.51, 1.35)?.h, 2.65);
  assert.equal(nextLedge(-6.1, 2.69, 2.65)?.h, 3.85);
  assert.equal(nextLedge(-6.1, -1, 0), null);
  assert.equal(strikeFrom(-2.05, -8.95, 3.85, false), 'above');
  assert.equal(strikeFrom(-2.05, -8.95, 0, false), null);
  assert.equal(strikeFrom(0, -10.6, 0, false), 'behind');
  assert.equal(strikeFrom(-2.05, -8.95, 3.85, true), null);
  assert.deepEqual(MARROW_KING, { opponentKind: 2, mode: 'chain', returnToMap: true });
});

test('only a bound win against Marrow King followed by its own finisher clears the court', () => {
  const clear = watchMarrowClear();
  const finish = { opponentKind: 2, duel: 'king-duel' };
  const settlement = { ...finish, mode: 'chain', bossBound: true, won: true };
  assert.equal(clear.finish(finish), false);
  for (const wrong of [{ mode: 'practice' }, { mode: 'pvp' }, { opponentKind: 1 }, { won: false }, { bossBound: false }]) {
    clear.settle({ ...settlement, ...wrong });
    assert.equal(clear.finish(finish), false);
  }
  clear.settle(settlement);
  assert.equal(clear.finish({ ...finish, duel: 'other' }), false);
  assert.equal(clear.finish({ ...finish, opponentKind: 1 }), false);
  assert.equal(clear.finish(finish), true);
  assert.equal(clear.finish(finish), false);
});
