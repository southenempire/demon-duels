import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, SystemInstruction, Transaction } from '@solana/web3.js';
import { ArenaClient } from './chain.js';
import { botGeneration, ensurePack, prepareGuest, recoverGuestPack, stockBossCard } from './onboarding.js';

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

test('an active cooldown follows the existing request without opening a new pack', async () => {
  const guest = { pack: async () => ({ opened: false }), retryPack: async () => null };
  const messages = [];
  let waits = 0;
  await ensurePack(guest, undefined, async () => { waits++; }, (message) => messages.push(message));
  assert.equal(waits, 1);
  assert.match(messages[0], /pending/);
});

test('a starter-pack timeout resumes on the same owner and retries once', async () => {
  const calls = [];
  const owner = {
    pack: async () => ({ opened: false }),
    requestPack: async () => { calls.push('request'); },
    retryPack: async () => { calls.push('retry'); return 'signature'; },
  };
  await ensurePack(owner, null, async (poll, timeout) => {
    calls.push(timeout);
    if (timeout === 60000) throw new Error('The network is still processing. Retry to resume.');
  }, (message) => assert.match(message, /renewed/));
  assert.deepEqual(calls, ['request', 60000, 'retry', 120000]);
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

test('a guest who lost every card opens a pack on the replacement wallet', async () => {
  const guest = {
    inventory: async (options) => { assert.equal(options.allowFallback, false); return []; },
    pack: async () => ({ opened: true }),
  };
  const replacement = {};
  assert.equal(await recoverGuestPack(guest, {
    replace: () => replacement,
    prepare: async (owner) => assert.equal(owner, replacement),
  }), true);
});

test('refill retries an unopened replacement pack on the same wallet', async () => {
  const guest = { inventory: async () => [], pack: async () => ({ opened: false }) };
  assert.equal(await recoverGuestPack(guest, {
    replace: () => assert.fail('unexpected wallet replacement'),
    prepare: async (owner) => assert.equal(owner, guest),
  }), true);
});

test('refill keeps a wallet with any owned cards, including locked cards', async () => {
  const guest = { inventory: async () => [{ lock: 'duel' }], pack: async () => ({ opened: true }) };
  assert.equal(await recoverGuestPack(guest, {
    replace: () => assert.fail('unexpected wallet replacement'),
    prepare: () => assert.fail('unexpected pack'),
  }), false);
});

test('refill does not rotate when the complete inventory cannot be read', async () => {
  const guest = {
    inventory: async () => { throw new Error('RPC unavailable'); },
    pack: async () => ({ opened: true }),
  };
  await assert.rejects(recoverGuestPack(guest, {
    replace: () => assert.fail('unexpected wallet replacement'),
    prepare: () => assert.fail('unexpected pack'),
  }), /RPC unavailable/);
});

test('a previous guest can move its remaining devnet SOL minus the quoted fee', async () => {
  const from = Keypair.generate();
  const to = Keypair.generate().publicKey;
  let balance = 22_000;
  let sends = 0;
  const base = {
    getBalance: async () => balance,
    getLatestBlockhash: async () => ({ blockhash: to.toBase58(), lastValidBlockHeight: 1 }),
    getFeeForMessage: async () => ({ value: 5_000 }),
    sendRawTransaction: async (bytes) => {
      sends++;
      const transfer = SystemInstruction.decodeTransfer(Transaction.from(bytes).instructions[0]);
      assert(transfer.fromPubkey.equals(from.publicKey));
      assert(transfer.toPubkey.equals(to));
      assert.equal(transfer.lamports, 17_000n);
      return 'transfer';
    },
    getSignatureStatuses: async () => ({ value: [{ confirmationStatus: 'confirmed' }] }),
  };
  const previous = new ArenaClient(from, base);
  assert.equal(await previous.moveRemainingSol(to), 'transfer');
  balance = 5_000;
  assert.equal(await previous.moveRemainingSol(to), null);
  assert.equal(sends, 1);
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
