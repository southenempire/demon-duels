import assert from 'node:assert/strict';
import test from 'node:test';
import { botGeneration, ensurePack, prepareGuest, stockBossCard } from './onboarding.js';

test('a new guest is funded before the starter pack is opened', async () => {
  const order = [];
  const guest = { balance: async () => 0, faucet: async () => order.push('fund') };
  await prepareGuest(guest, () => {}, async (owner) => {
    assert.equal(owner, guest);
    order.push('pack');
  });
  assert.deepEqual(order, ['fund', 'pack']);
});

test('a funded guest skips the airdrop', async () => {
  const guest = { balance: async () => 0.05, faucet: async () => assert.fail('unexpected airdrop') };
  let opened = false;
  await prepareGuest(guest, () => {}, async () => { opened = true; });
  assert.equal(opened, true);
});

test('a failed airdrop leaves the pack untouched and offers recovery', async () => {
  const guest = { balance: async () => 0, faucet: async () => { throw new Error('RPC error'); } };
  await assert.rejects(prepareGuest(guest, () => {}, () => assert.fail('unexpected pack')), /fund manually/);
});

test('pack setup only retries an existing unopened pack', async () => {
  let requests = 0;
  let retries = 0;
  let waits = 0;
  const guest = {
    pack: async () => ({ opened: true }),
    requestPack: async () => { requests += 1; },
    retryPack: async () => { retries += 1; return 'signature'; },
  };
  const wait = async (poll) => { waits += 1; assert.equal(await poll(), true); };
  await ensurePack(guest, null, wait);
  await ensurePack(guest, { opened: false }, wait);
  await ensurePack(guest, { opened: true }, wait);
  assert.equal(requests, 1);
  assert.equal(retries, 1);
  assert.equal(waits, 2);
});

test('an active cooldown does not wait for another request or submit a new pack', async () => {
  const guest = { pack: async () => ({ opened: false }), retryPack: async () => null };
  await assert.rejects(ensurePack(guest, undefined, () => assert.fail('unexpected wait')), /retry is already pending/);
});

test('existing rooms with no stored generation still use the original bot', () => {
  assert.equal(botGeneration(null), 0);
  assert.equal(botGeneration('bogus'), 0);
  assert.equal(botGeneration('3'), 3);
});

test('boss preparation reuses the exact stocked card without requesting a pack', async () => {
  const card = { key: 'existing', kind: 4 };
  const bot = { key: 'rival' };
  const prepared = await stockBossCard(4, {
    find: async (kind) => { assert.equal(kind, 4); return { bot, card, generation: 1 }; },
    mint: async () => assert.fail('unexpected starter pack'),
    fund: async (candidate) => assert.equal(candidate, bot),
  });
  assert.deepEqual(prepared, { bot, card, generation: 1, demonId: 4 });
});

test('an exhausted boss pool opens packs until the requested kind is found', async () => {
  const bot = { key: 'new rival' };
  let packs = 0;
  const prepared = await stockBossCard(0, {
    find: async () => null,
    mint: async () => ({ bot, generation: packs, cards: [{ kind: ++packs === 2 ? 0 : 5 }] }),
    fund: async (candidate) => assert.equal(candidate, bot),
  });
  assert.equal(packs, 2);
  assert.deepEqual(prepared, { bot, generation: 1, card: { kind: 0 }, demonId: 0 });
});

test('boss preparation does not substitute the wrong kind when the starter pack budget runs out', async () => {
  let packs = 0;
  await assert.rejects(stockBossCard(2, {
    find: async () => null,
    mint: async () => packs++ < 3 ? { cards: [{ kind: 3 }] } : null,
    fund: async () => assert.fail('unexpected bot funding'),
  }), /Your card was not staked/);
  assert.equal(packs, 4);
});
