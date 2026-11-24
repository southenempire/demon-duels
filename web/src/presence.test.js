import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@solana/web3.js';
import { CHALLENGE_TTL, INTERP_DELAY, Negotiator, PEER_TTL, PeerTable, STAKE_TTL, interpolate, open, seal } from './presence.js';

const alice = Keypair.generate();
const bob = Keypair.generate();
const A = alice.publicKey.toBase58();
const B = bob.publicKey.toBase58();
const pose = (t, x, y = 2, extra = {}) => ({ k: 'pose', t, c: 2, x, y, d: 'right', a: 'walk', ...extra });

test('signed presence messages verify and carry the signer identity', () => {
  const body = open(seal(alice, pose(1000, 3)), 1000);
  assert.equal(body.id, A);
  assert.equal(body.x, 3);
  const now = Date.now();
  assert.equal(open(seal(bob, pose(now, 1.25)), now).id, B);
});

test('forged, tampered, stale or malformed messages are dropped', () => {
  const raw = JSON.parse(seal(alice, pose(1000, 3)));
  assert.equal(open(JSON.stringify({ ...raw, b: raw.b.replace('"x":3', '"x":9') }), 1000), null);
  const spoof = JSON.parse(seal(bob, pose(1000, 3)));
  assert.equal(open(JSON.stringify({ b: spoof.b.replace(B, A), s: spoof.s }), 1000), null);
  assert.equal(open(seal(alice, pose(1000, 3)), 1000 + 60000), null);
  assert.equal(open(seal(alice, pose(1000, 3, 2, { c: 9 })), 1000), null);
  assert.equal(open(seal(alice, pose(1000, 3, 2, { a: '<img>' })), 1000), null);
  assert.equal(open(seal(alice, { k: 'staked', t: 1000, to: B, n: 'x', duel: 'nope' }), 1000), null);
  assert.equal(open('not json', 1000), null);
});

test('remote hunters are interpolated, deduplicated across relays and expire', () => {
  const table = new PeerTable(B);
  const first = open(seal(alice, pose(1000, 0)), 1000);
  assert.equal(table.receive(first, 1000), true);
  assert.equal(table.receive(first, 1001), false);
  table.receive(open(seal(alice, pose(1100, 1)), 1100), 1100);
  const [hunter] = table.snapshot(2, 1050 + INTERP_DELAY);
  assert.equal(hunter.id, A);
  assert.ok(Math.abs(hunter.x - 0.5) < 1e-9);
  assert.equal(hunter.dir, 'right');
  assert.equal(table.snapshot(3, 1200).length, 0);
  assert.equal(table.snapshot(2, 1100 + PEER_TTL + 1).length, 0);
});

test('hunters snap on teleports, ignore themselves and leave on bye', () => {
  const table = new PeerTable(A);
  assert.equal(table.receive(open(seal(alice, pose(1000, 0)), 1000), 1000), false);
  const other = new PeerTable(B);
  other.receive(open(seal(alice, pose(1000, 0)), 1000), 1000);
  other.receive(open(seal(alice, pose(1100, 20)), 1100), 1100);
  assert.equal(other.snapshot(2, 1100).at(0).x, 20);
  assert.equal(other.snapshot(2, 1100).at(0).warp, 1100);
  other.receive(open(seal(alice, { k: 'bye', t: 1200 }), 1200), 1200);
  assert.equal(other.snapshot(2, 1200).length, 0);
  assert.deepEqual(interpolate([], 0), null);
});

test('remote facing takes the short arc across the angle seam', () => {
  const samples = [{ at: 0, x: 0, y: 0, r: 3.1, h: 1 }, { at: 100, x: 2, y: 0, r: -3.1, h: 2 }];
  const pose = interpolate(samples, 50);
  assert.ok(Math.abs(pose.heading - Math.PI) < .0001);
  assert.equal(pose.height, 1.5);
  assert.equal(pose.x, 1);
});

test('a challenge handshake ends with the challenger staking an onchain duel', () => {
  const host = new Negotiator(A);
  const guest = new Negotiator(B);
  const ask = host.challenge(B, 0);
  assert.equal(host.challenge(B, 0), null);
  assert.deepEqual(guest.receive({ ...ask, id: A }, 0), { type: 'offer', from: A });
  assert.equal(guest.receive({ ...ask, id: A }, 0), null);
  const yes = guest.accept(10);
  assert.deepEqual(host.receive({ ...yes, id: B }, 10), { type: 'accepted', to: B });
  assert.equal(host.receive({ ...yes, id: B }, 11), null);
  const duel = Keypair.generate().publicKey.toBase58();
  const staked = host.staked(duel);
  assert.equal(host.busy(), false);
  assert.deepEqual(guest.receive({ ...staked, id: A }, 20), { type: 'staked', from: A, duel });
  assert.equal(guest.busy(), false);
});

test('busy hunters auto-decline and strangers cannot hijack a handshake', () => {
  const guest = new Negotiator(B);
  guest.receive({ k: 'challenge', to: B, n: 'one', id: A }, 0);
  const third = Keypair.generate().publicKey.toBase58();
  const reply = guest.receive({ k: 'challenge', to: B, n: 'two', id: third }, 0);
  assert.deepEqual(reply, { type: 'reply', reply: { k: 'decline', to: third, n: 'two', r: 'busy' } });
  assert.equal(guest.receive({ k: 'staked', to: B, n: 'one', id: third, duel: third }, 0), null);
  assert.equal(guest.receive({ k: 'staked', to: B, n: 'one', id: A, duel: third }, 0), null);
  assert.equal(guest.receive({ k: 'challenge', to: A, n: 'three', id: third }, 0), null);
  const host = new Negotiator(A);
  const ask = host.challenge(B, 0);
  assert.deepEqual(host.receive({ k: 'decline', to: A, n: ask.n, id: B, r: 'busy' }, 1), { type: 'declined', to: B, reason: 'busy' });
});

test('unanswered challenges and missing stakes expire without taking cards', () => {
  const host = new Negotiator(A);
  const ask = host.challenge(B, 0);
  assert.deepEqual(host.expire(CHALLENGE_TTL), []);
  const [gone] = host.expire(CHALLENGE_TTL + 1);
  assert.equal(gone.type, 'unanswered');
  assert.equal(gone.reply.k, 'cancel');
  const guest = new Negotiator(B);
  guest.receive({ ...ask, id: A }, 0);
  guest.accept(0);
  assert.deepEqual(guest.expire(CHALLENGE_TTL + 1), []);
  const [unstaked] = guest.expire(STAKE_TTL + 1);
  assert.equal(unstaked.type, 'unstaked');
  assert.equal(guest.busy(), false);
});
