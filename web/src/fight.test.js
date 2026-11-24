import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { arenaCardSide, confirmedFight, confirmedSettlement, fightReason, privateMoveRetryMessage } from './fight.js';
import { bossModel } from './duel3d/fighter.js';
import { meleeActions, meleeTimeline } from './duel3d/timeline.js';
import { characters, characterArt } from './characters.js';
import { demons, resolve } from './rules.js';

const p1 = { equals: (other) => other === p1 };
const p2 = { equals: (other) => other === p2 };
const duel = { key: 'confirmed-room', phase: 3, p1, p2, winner: p2, moves: [0, 1], crits: [false, true], scores: [3, 4] };

test('open invites put the host stake on the opposing side until the invitee joins', () => {
  const empty = { equals: (other) => other === empty };
  const open = { ...duel, p2: empty, phase: 0 };
  assert.equal(arenaCardSide(open, p1), 0);
  assert.equal(arenaCardSide(open, p2), 1);
  assert.equal(arenaCardSide(duel, p2), 1);
  assert.equal(arenaCardSide(duel, {}), 0);
});

test('3D boss models map to their demon IDs and leave other bosses procedural', () => {
  assert.deepEqual(demons.map((_, id) => bossModel(id)), [
    'ash-warden.glb', undefined, 'marrow-king.glb', 'mire-phantom.glb', 'frost-herald.glb', 'gloam-shade.glb',
  ]);
});

test('private move errors distinguish offline, RPC loss and pending chain confirmation', () => {
  const rpc = new Error('failed to get info about account: TypeError: Failed to fetch');
  assert.match(privateMoveRetryMessage(rpc, { online: false, sealed: false }), /offline.*retry sealing/i);
  assert.match(privateMoveRetryMessage(rpc, { online: true, sealed: true }), /connection dropped.*Check for reveal/i);
  assert.match(privateMoveRetryMessage(new Error('The network is still processing.'), { online: true, sealed: false }), /hasn’t confirmed.*retry sealing/i);
  assert.equal(privateMoveRetryMessage(new Error('Invalid choice'), { online: true, sealed: false }), null);
});

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

test('the fight reveals, parries and hand blocks, then depicts the confirmed crit upset and capture', () => {
  const result = confirmedFight(duel);
  const timeline = meleeTimeline(result);
  assert.deepEqual(timeline.map((frame) => frame.stage), ['reveal', 'exchange', 'exchange', 'decision', 'counter', 'spoils', 'finish']);
  assert.deepEqual(timeline[1].actions, ['strike', 'parry']);
  assert.deepEqual(timeline[2].actions, ['strike', 'block']);
  assert.equal(timeline[3].sound, 'crit');
  assert.deepEqual(timeline[4].actions, ['death', 'counter']);
  assert.deepEqual(meleeActions(timeline.at(-1), result), ['fallen', 'victory']);
});

test('a Hex duel uses dodge choreography and equal scores do not override either recorded winner', () => {
  for (const winner of [0, 1]) {
    const result = { moves: [2, 2], crits: [false, false], score: [2, 2], winner };
    const timeline = meleeTimeline(result);
    assert.deepEqual(timeline[1].actions, ['feint', 'dodge']);
    assert.deepEqual(timeline[2].actions, ['dodge', 'feint']);
    assert.equal(timeline[3].tied, true);
    assert.equal(timeline[4].attacker, winner);
    assert.equal(timeline[4].actions[winner], 'counter');
    assert.equal(meleeActions(timeline.at(-1), result)[1 - winner], 'fallen');
  }
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
