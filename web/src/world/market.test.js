import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { PROGRAM, ZERO } from '../chain.js';
import { hunterLedger, openBounties } from './market.js';

const key = (n) => new PublicKey(new Uint8Array(32).fill(n));
const prefix = (name) => createHash('sha256').update(name).digest().subarray(0, 8);
const [duel, owner, challenger, card, prize] = [1, 2, 3, 4, 5].map(key);
const account = (data) => ({ owner: PROGRAM, data });
const now = 50000;

function room({ p2 = ZERO, phase = 0, deadline = 80, winner = ZERO } = {}) {
  const data = Buffer.alloc(191);
  prefix('account:Duel').copy(data);
  for (const [offset, value] of [[16, owner], [48, p2], [80, card], [112, prize], [144, winner]]) {
    value.toBuffer().copy(data, offset);
  }
  data.writeBigInt64LE(BigInt(deadline), 176);
  data[184] = phase;
  return account(data);
}

function ownedCard(cardOwner, lock, kind) {
  const data = Buffer.alloc(73);
  prefix('account:Card').copy(data);
  cardOwner.toBuffer().copy(data, 8);
  lock.toBuffer().copy(data, 40);
  data[72] = kind;
  return account(data);
}

test('the bounty board filters open rooms and checks the staked card lock', async () => {
  const rpc = {
    async getProgramAccounts(program, { filters }) {
      assert.equal(program, PROGRAM);
      assert.deepEqual(filters, [
        { dataSize: 191 },
        { memcmp: { offset: 48, bytes: ZERO.toBase58() } },
        { memcmp: { offset: 184, bytes: '1' } },
      ]);
      return [
        { pubkey: duel, account: room() },
        { pubkey: key(6), account: room({ p2: challenger }) },
        { pubkey: key(7), account: room({ deadline: 49 }) },
        { pubkey: key(8), account: room() },
      ];
    },
    async getMultipleAccountsInfo(keys) {
      return keys.map(() => ownedCard(owner, duel, 3));
    },
  };
  assert.deepEqual(await openBounties(rpc, challenger, { getItem: () => null }, now), [
    { room: String(duel), owner: String(owner), kind: 3, deadline: 80000 },
  ]);
});

test('the ledger ignores foreign logs and identifies the loser and lost card from the settled duel', async () => {
  const event = Buffer.concat([
    prefix('event:DuelSettled'), duel.toBuffer(), owner.toBuffer(), card.toBuffer(), prize.toBuffer(), Buffer.alloc(4),
  ]).toString('base64');
  const other = key(7);
  const rpc = {
    async getSignaturesForAddress() { return [{ signature: 'proof', err: null }, { signature: 'failed', err: {} }]; },
    async getTransactions(signatures) {
      assert.deepEqual(signatures, ['proof']);
      return [{ meta: { logMessages: [
        'Program ' + PROGRAM + ' invoke [1]', 'Program ' + other + ' invoke [2]', 'Program data: ' + event,
        'Program ' + other + ' success', 'Program data: ' + event, 'Program ' + PROGRAM + ' success',
      ] } }];
    },
    async getMultipleAccountsInfo([address]) {
      if (address.equals(duel)) return [room({ p2: challenger, phase: 3, winner: owner })];
      assert(address.equals(prize));
      return [ownedCard(owner, ZERO, 5)];
    },
  };
  assert.deepEqual(await hunterLedger(rpc), [
    { duel: String(duel), winner: String(owner), proof: 'proof', loser: String(challenger), kind: 5 },
  ]);
});
