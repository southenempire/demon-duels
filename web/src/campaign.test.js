import test from 'node:test';
import assert from 'node:assert/strict';
import { circles, campaignKey, freshCampaign, readCampaign, circleState, pitUnlocked, recordBossWin, persistBossWin } from './campaign.js';

const result = (bossId = 0) => ({ bossId, mode: 'chain', phase: 3, player: 'player', winner: 'player',
  opponent: 'boss-wallet', bot: 'boss-wallet', opposingKind: bossId, duel: 'confirmed-duel-' + bossId });

test('only a settled win against the exact next boss advances the descent', () => {
  const progress = freshCampaign();
  for (const patch of [{ phase: 0 }, { phase: 1 }, { phase: 2 }, { phase: 4 }, { mode: 'practice' },
    { winner: 'boss-wallet' }, { opponent: 'human' }, { opposingKind: 3 }, { bossId: 2 }, { bossId: null },
    { player: 'spectator' }, { player: 'boss-wallet', winner: 'boss-wallet' }, { duel: '' }]) {
    assert.equal(recordBossWin(progress, { ...result(), ...patch }), progress, JSON.stringify(patch));
  }
  const next = recordBossWin(progress, result());
  assert.deepEqual(next.wins, [{ bossId: 0, duel: 'confirmed-duel-0' }]);
  assert.equal(progress.wins.length, 0);
  assert.equal(recordBossWin(next, result()), next, 'duplicate settlement is idempotent');
});

test('each circle unlocks in order and only the final win opens PvP', () => {
  let progress = freshCampaign();
  assert.equal(circleState(progress, 0), 'available');
  assert.equal(circleState(progress, 1), 'locked');
  for (const circle of circles) {
    assert.equal(pitUnlocked(progress), false);
    const before = progress;
    if (circle.id) assert.equal(recordBossWin(progress, { ...result(circle.id), duel: progress.wins[0].duel }), before);
    progress = recordBossWin(progress, result(circle.id));
    assert.equal(circleState(progress, circle.id), 'conquered');
    if (circle.id < 5) assert.equal(circleState(progress, circle.id + 1), 'available');
  }
  assert.equal(pitUnlocked(progress), true);
  assert.equal(recordBossWin(progress, { ...result(5), winner: 'boss-wallet' }), progress, 'losses never erase seals');
});

test('wallet-local journal survives reload and ignores corrupt, skipped and duplicate wins', () => {
  let raw;
  const storage = { getItem: () => raw };
  for (raw of [undefined, '{broken', 'null', '{}', '{"version":2,"wins":[]}', '{"version":1,"wins":{}}']) {
    assert.deepEqual(readCampaign(storage, 'player'), freshCampaign());
  }
  const progress = recordBossWin(freshCampaign(), result());
  raw = JSON.stringify(progress);
  assert.deepEqual(readCampaign(storage, 'player'), progress);
  raw = JSON.stringify({ version: 1, wins: [...progress.wins, { bossId: 2, duel: 'skipped' }] });
  assert.deepEqual(readCampaign(storage, 'player'), progress);
  raw = JSON.stringify({ version: 1, wins: [...progress.wins, { bossId: 1, duel: progress.wins[0].duel }] });
  assert.deepEqual(readCampaign(storage, 'player'), progress);
  assert.notEqual(campaignKey('one-wallet'), campaignKey('another-wallet'));
});

test('a late settlement in an older tab cannot overwrite newer seals', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  persistBossWin(storage, 'player', result(0));
  const newer = persistBossWin(storage, 'player', result(1));
  const late = persistBossWin(storage, 'player', { ...result(0), duel: 'older-tab-guardian' });
  assert.deepEqual(late, newer);
  assert.deepEqual(readCampaign(storage, 'player'), newer);
  assert.equal(persistBossWin(storage, 'player', result(2)).wins.length, 3);
  assert.deepEqual(readCampaign(storage, 'another-player'), freshCampaign());
});
