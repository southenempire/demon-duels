import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { confirmedFight, confirmedSettlement, fightTimeline, fighterPose, fightReason } from './fight.js';
import { characters, characterArt } from './characters.js';
import { demons, resolve } from './rules.js';

const p1 = { equals: (other) => other === p1 };
const p2 = { equals: (other) => other === p2 };
const duel = { key: 'confirmed-room', phase: 3, p1, p2, winner: p2, moves: [0, 1], crits: [false, true], scores: [3, 4] };

test('only a settled chain account can produce a combat result', () => {
  for (const phase of [0, 1, 2, 4]) assert.equal(confirmedFight({ ...duel, phase }), null);
  assert.equal(confirmedFight(null), null);
  assert.deepEqual(confirmedFight(duel), { moves: [0, 1], crits: [false, true], score: [3, 4], winner: 1 });
});

test('player two sees their own moves, crits, scores and winner without mutating chain data', () => {
  const before = { moves: [...duel.moves], crits: [...duel.crits], scores: [...duel.scores] };
  assert.deepEqual(confirmedFight(duel, 1), { moves: [1, 0], crits: [true, false], score: [4, 3], winner: 0 });
  assert.deepEqual({ moves: duel.moves, crits: duel.crits, scores: duel.scores }, before);
});

test('campaign credit requires confirmed settlement and actual participation', () => {
  for (const phase of [0, 1, 2, 4]) assert.equal(confirmedSettlement({ ...duel, phase }, p2, 4), null);
  assert.equal(confirmedSettlement(duel, {}, 4), null);
  const receipt = confirmedSettlement(duel, p2, 4, 'signature');
  assert.equal(receipt.won, true);
  assert.equal(receipt.mode, 'chain');
  assert.equal(receipt.opponentKind, 4);
  assert.equal(receipt.proof, 'signature');
  assert.equal(confirmedSettlement(duel, p1, 5).won, false);
});

test('the fight reveals, lands both confirmed hits, decides, then captures', () => {
  const result = confirmedFight(duel);
  const timeline = fightTimeline(result);
  assert.equal(timeline[0].stage, 'reveal');
  const hits = timeline.filter((frame) => frame.stage === 'strike');
  assert.deepEqual(hits.map((frame) => [frame.attacker, frame.sound]), [[0, 'strike'], [1, 'crit']]);
  assert.equal(fighterPose(hits[1], 0, result), 'hit');
  assert.equal(fighterPose(hits[1], 1, result), 'crit');
  assert.ok(timeline.findIndex((frame) => frame.stage === 'spoils') > timeline.findIndex((frame) => frame.stage === 'decision'));
  assert.equal(fighterPose(timeline.at(-1), 0, result), 'defeat');
});

test('ties and crit comebacks explain the actual source of the result', () => {
  const tie = resolve(2, 2, [64, 64, 1]);
  assert.match(fightReason(tie), /MagicBlock VRF broke the tie/);
  assert.match(fightReason(tie, true), /practice randomness/);
  assert.match(fightReason(resolve(0, 1, [64, 0, 0])), /CRIT COMEBACK/);
  assert.doesNotMatch(fightReason(resolve(0, 1, [64, 64, 0])), /COMEBACK/);
});

test('all six contract IDs have distinct, present poses and portraits', () => {
  assert.equal(characters.length, demons.length);
  const paths = new Set();
  for (let kind = 0; kind < demons.length; kind++) {
    assert.equal(demons[kind].art, characters[kind].portrait, 'Roster and arena must use the same clean portrait');
    assert.equal(demons[kind].hue, characters[kind].hue, 'Do not recolor a distinct character into a legacy variant');
    for (const pose of ['idle', 'attack', 'hit', 'crit', 'defeat']) {
      const art = characterArt(kind, pose);
      assert.ok(existsSync(new URL('../public/art/' + art, import.meta.url)), art);
      assert.ok(!paths.has(art), 'Pose paths must be unique');
      paths.add(art);
    }
    assert.ok(existsSync(new URL('../public/art/' + characters[kind].portrait, import.meta.url)));
    assert.equal(characterArt(kind, 'unknown'), characterArt(kind, 'idle'));
  }
});
