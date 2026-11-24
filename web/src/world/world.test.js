import test from 'node:test';
import assert from 'node:assert/strict';
import { levels, TILE } from './levels.js';
import { canSee, detection, gradeFor, rayDistance } from './stealth.js';
import { acceptedWin, campaignKey, readWins } from './progress.js';
import { bossMove } from './bot-profile.js';
import { advance, interaction, newRun } from './simulation.js';

test('vision respects angle, occlusion and one-tile cover', () => {
  const guard = { x: 0, y: 0, angle: 0, arc: Math.PI / 2, range: 6 * TILE };
  const hunter = { x: 80, y: 0 };
  assert.equal(canSee(guard, hunter, []), true);
  assert.equal(canSee(guard, { x: 0, y: 60 }, []), false);
  const walls = [{ x: 40, y: -4, w: 12, h: 8 }];
  assert.equal(rayDistance(guard, 0, 192, walls), 40);
  assert.equal(canSee(guard, hunter, walls), false);
  assert.equal(canSee(guard, { ...hunter, hidden: true }, []), false);
  assert.equal(canSee(guard, { x: TILE, y: 0, hidden: true }, []), true);
});

test('light drives suspicion; four seconds out of sight are required to lose the trail', () => {
  assert.equal(detection(0, 1, true, false, 2, 0), 84);
  assert.equal(detection(0, 1, true, false, 0, 0), 36);
  assert.equal(detection(84, 1, false, false, 0, 3.9), 84);
  assert.equal(detection(84, 1, false, false, 0, 4), 34);
  assert.equal(gradeFor({}), 'ghost');
  assert.equal(gradeFor({ suspicious: true }), 'shadow');
  assert.equal(gradeFor({ marked: true }), 'exposed');
});

test('the Ash Gate gives a real Strike prompt after getting behind the boss', () => {
  const level = levels[0];
  const run = newRun(level);
  for (let i = 0; i < 12; i++) advance(level, run, { dx: 1, dy: 0, sneak: true }, 0.02, i * 20);
  assert(run.hunter.x > level.start.x);
  assert.equal(run.hunter.noise, TILE);
  Object.assign(run.hunter, { x: run.boss.x - 42, y: run.boss.y });
  run.boss.angle = 0;
  assert.equal(interaction(level, run, []).name, 'strike');
  run.boss.angle = Math.PI;
  assert.notEqual(interaction(level, run, [])?.name, 'strike');
  run.boss.alert = true;
  assert.equal(interaction(level, run, []).label, 'Duel in the open');
});

test('no world win without the campaign journal, a bound chain room and the local winner', () => {
  const db = new Map();
  const storage = { getItem: (key) => db.get(key) ?? null };
  const encounter = { mode: 'chain', duel: 'room', opponentKind: 0 };
  const detail = { ...encounter, won: true, player: 'hunter', winner: 'hunter', proof: null };
  assert.equal(acceptedWin(readWins(storage, 'hunter'), 'hunter', encounter, detail), false);
  db.set(campaignKey('hunter'), JSON.stringify({ version: 1, wins: [{ bossId: 0, duel: 'room' }, { bossId: 2, duel: 'skip' }] }));
  const wins = readWins(storage, 'hunter');
  assert.deepEqual(wins, [{ bossId: 0, duel: 'room' }]);
  assert.equal(acceptedWin(wins, 'hunter', encounter, detail), true);
  for (const change of [{ mode: 'practice' }, { won: false }, { winner: 'bot' }, { duel: 'pvp' }, { opponentKind: 1 }]) {
    assert.equal(acceptedWin(wins, 'hunter', encounter, { ...detail, ...change }), false);
  }
});

test('boss bot follows story weights and exposed encounters use no preference', () => {
  const counts = (kind, grade, rolls) => Array.from({ length: rolls }, (_, i) => bossMove(kind, grade, (i + 0.5) / rolls))
    .reduce((tally, move) => { tally[move]++; return tally; }, [0, 0, 0]);
  assert.deepEqual(counts(0, 'ghost', 100), [30, 60, 10]);
  assert.deepEqual(counts(3, 'shadow', 100), [20, 35, 45]);
  assert.deepEqual(counts(5, 'ghost', 100), [60, 10, 30]);
  assert.deepEqual(counts(0, 'exposed', 300), [100, 100, 100]);
});
