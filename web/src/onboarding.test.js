import assert from 'node:assert/strict';
import test from 'node:test';
import { botGeneration, ensurePack, prepareGuest } from './onboarding.js';

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

test('pack setup requests only for a missing pack and waits for a pending pack', async () => {
  let requests = 0;
  let waits = 0;
  const guest = { pack: async () => ({ opened: true }), requestPack: async () => { requests += 1; } };
  const wait = async (poll) => { waits += 1; assert.equal(await poll(), true); };
  await ensurePack(guest, null, wait);
  await ensurePack(guest, { opened: false }, wait);
  await ensurePack(guest, { opened: true }, wait);
  assert.equal(requests, 1);
  assert.equal(waits, 2);
});

test('existing rooms with no stored generation still use the original bot', () => {
  assert.equal(botGeneration(null), 0);
  assert.equal(botGeneration('bogus'), 0);
  assert.equal(botGeneration('3'), 3);
});
