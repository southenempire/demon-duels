import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignApproval, installFinishers, matchesBossStake } from './index.js';
import { finisherScene } from './scenes.js';
import { demons } from '../rules.js';

const win = { mode: 'chain', duel: 'settled-room', player: 'hunter', opponentKind: 2, won: true, proof: null };
const emit = (target, name, detail) => target.dispatchEvent(new CustomEvent('demon-duels:' + name, { detail }));

test('each confirmed boss maps to a distinct win; a confirmed loss maps to defeat', () => {
  const scenes = demons.map(({ name }, opponentKind) => {
    const scene = finisherScene({ ...win, opponentKind });
    assert.equal(scene.boss, name);
    assert.match(scene.ending, /defeat\.png$/);
    return scene;
  });
  for (const key of ['effect', 'title', 'line', 'sigil']) assert.equal(new Set(scenes.map((scene) => scene[key])).size, 6);
  assert.equal(finisherScene({ ...win, won: false }).effect, 'fallen');
  for (const overrides of [{ mode: 'practice' }, { opponentKind: 6 }, { opponentKind: null }, { won: undefined }]) {
    assert.equal(finisherScene({ ...win, ...overrides }), null);
  }
});

test('a world request only grades its approved chain win; playback blocks the vault and runs once', async () => {
  const target = new EventTarget();
  const order = [];
  let close;
  target.addEventListener('demon-duels:settled', ({ detail }) => {
    if (detail === win) emit(target, 'finisher', { opponentKind: 2, duel: win.duel, grade: 'ghost' });
  });
  const finishers = installFinishers(target, (detail) => detail === win, async (scene, detail, grade) => {
    assert.equal(detail, win);
    assert.equal(scene.effect, 'crown');
    order.push(grade);
    await new Promise((resolve) => { close = resolve; });
  });
  target.addEventListener('demon-duels:finisher-done', ({ detail }) => order.push(detail));
  emit(target, 'finisher', { ...win, grade: 'exposed' });
  emit(target, 'settled', { ...win });
  await finishers.play(win.duel);
  assert.deepEqual(order, []);

  emit(target, 'settled', win);
  emit(target, 'finisher', { ...win, opponentKind: 0, grade: 'exposed' });
  await Promise.resolve();
  assert.equal(finishers.has(win.duel), true);
  const playback = finishers.play(win.duel).then(() => order.push('vault'));
  assert.deepEqual(order, ['ghost']);
  emit(target, 'settled', win);
  await finishers.play(win.duel);
  close();
  await playback;
  assert.deepEqual(order, ['ghost', { opponentKind: 2 }, 'vault']);
});

test('fallback defaults to Shadow and a failed render still signals completion', async () => {
  const target = new EventTarget();
  const signals = [];
  const finishers = installFinishers(target, () => true, (_scene, _detail, grade) => {
    assert.equal(grade, 'shadow');
    throw new Error('render unavailable');
  });
  target.addEventListener('demon-duels:finisher-done', ({ detail }) => signals.push(detail));
  emit(target, 'settled', { ...win, mode: 'practice' });
  assert.equal(finishers.has(win.duel), false);
  emit(target, 'settled', win);
  await assert.rejects(finishers.play(win.duel), /render unavailable/);
  assert.deepEqual(signals, [{ opponentKind: 2 }]);
});

test('bound campaign wins require a fresh journal entry for the same boss and duel', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null };
  const journal = 'demon-duels:campaign:v1:' + win.player;
  assert.equal(campaignApproval(storage, win), null);
  data.set('demon-duels:boss:' + win.duel, '2');
  const approved = campaignApproval(storage, win);
  assert.equal(approved(), false);
  data.set(journal, JSON.stringify({ version: 1, wins: [{ bossId: 1, duel: win.duel }, { bossId: 2, duel: 'other' }] }));
  assert.equal(approved(), false);
  data.set(journal, JSON.stringify({ version: 1, wins: [{ bossId: 2, duel: win.duel }] }));
  assert.equal(approved(), true);
  assert.equal(campaignApproval(storage, win)(), false);
});

test('a matching kind or world request cannot turn PvP into a house boss win', async () => {
  const binding = { kind: 2, player: 'house-boss', card: 'house-card' };
  assert.equal(matchesBossStake(win, 2, win.duel, 'house-boss', 'house-card', binding), true);
  assert.equal(matchesBossStake(win, 2, win.duel, 'house-boss', 'other-card', binding), false);
  assert.equal(matchesBossStake(win, 2, 'other-room', 'house-boss', 'house-card', binding), false);
  assert.equal(matchesBossStake(win, 2, win.duel, 'house-boss', 'house-card', null), false);
  assert.equal(matchesBossStake({ ...win, mode: 'practice' }, 2, win.duel, 'house-boss', 'house-card', binding), false);
  const target = new EventTarget();
  const finishers = installFinishers(target,
    (detail) => matchesBossStake(detail, 2, win.duel, 'friend-wallet', 'house-card', binding),
    () => assert.fail('PvP settlement opened a boss cinematic'));
  emit(target, 'settled', win);
  emit(target, 'finisher', { opponentKind: 2, duel: win.duel, grade: 'exposed' });
  await Promise.resolve();
  assert.equal(finishers.has(win.duel), false);
  await finishers.play(win.duel);
});
