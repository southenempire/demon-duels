import test from 'node:test';
import assert from 'node:assert/strict';
import { practicePack, resolve } from './rules.js';

test('the move triangle awards one extra point to the advantaged move', () => {
  for (let mine = 0; mine < 3; mine++) {
    const theirs = (mine + 1) % 3;
    assert.deepEqual(resolve(mine, theirs, [64, 64, 0]).score, [3, 2]);
    assert.equal(resolve(theirs, mine, [64, 64, 0]).winner, 1);
  }
});

test('a crit adds two points and can beat the matchup advantage', () => {
  assert.deepEqual(resolve(0, 1, [64, 63, 0]), {
    score: [3, 4], crits: [false, true], winner: 1, moves: [0, 1],
  });
});

test('the third random byte decides ties', () => {
  for (const bit of [0, 1]) assert.equal(resolve(2, 2, [63, 63, bit]).winner, bit);
});

test('starter packs always contain three distinct demons', () => {
  for (let a = 0; a < 6; a++) {
    for (let b = 0; b < 5; b++) {
      for (let c = 0; c < 4; c++) {
        const cards = practicePack([a, b, c]);
        assert.equal(new Set(cards).size, 3);
        assert.ok(cards.every((card) => card >= 0 && card < 6));
      }
    }
  }
});
