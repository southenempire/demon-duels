import {
  Connection, Keypair, PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY,
  Transaction, TransactionInstruction, LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  DELEGATION_PROGRAM_ID, MAGIC_CONTEXT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID,
  delegateBufferPdaFromDelegatedAccountAndOwnerProgram, delegationMetadataPdaFromDelegatedAccount,
  delegationRecordPdaFromDelegatedAccount, getAuthToken, permissionPdaFromAccount,
} from '@magicblock-labs/ephemeral-rollups-sdk';
import { Buffer } from 'buffer';
import nacl from 'tweetnacl';

globalThis.Buffer ??= Buffer;

const env = import.meta.env ?? {};
export const PROGRAM = new PublicKey('BrQHcYwehSANxdTCvRKhdHwR6PybaX1YSLUpbQ2NcDqZ');
export const BASE = env.VITE_BASE_RPC || 'https://rpc.magicblock.app/devnet';
export const TEE = env.VITE_TEE_RPC || 'https://devnet-tee.magicblock.app';
export const ZERO = PublicKey.default;
const VALIDATOR = new PublicKey('MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo');
const VAULT = new PublicKey('MagicVau1t999999999999999999999999999999999');
const VRF = new PublicKey('Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz');
const QUEUE = new PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh');
const SYSTEM = SystemProgram.programId;
export const DEVNET = new Connection(BASE, 'confirmed');
export const explorer = (sig) => 'https://explorer.solana.com/tx/' + sig + '?cluster=devnet';
export const addressExplorer = (key) => 'https://explorer.solana.com/address/' + key + '?cluster=devnet';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const bytes = (n) => Buffer.from([n]);
const pub = (data, offset) => new PublicKey(data.subarray(offset, offset + 32));
const w = (pubkey) => ({ pubkey, isSigner: false, isWritable: true });
const r = (pubkey) => ({ pubkey, isSigner: false, isWritable: false });
const signer = (pubkey) => ({ pubkey, isSigner: true, isWritable: true });
const pda = (name, ...seeds) => PublicKey.findProgramAddressSync([Buffer.from(name), ...seeds], PROGRAM)[0];
const u64 = (n) => {
  const result = Buffer.alloc(8);
  result.writeBigUInt64LE(n);
  return result;
};
export const packKey = (owner) => pda('pack', owner.toBuffer());
export const cardKey = (owner, i) => pda('card', owner.toBuffer(), bytes(i));
export const roundKey = (duel) => pda('round', duel.toBuffer());
export const pickKey = (duel, player) => pda('pick', duel.toBuffer(), player.toBuffer());
const duelKey = (owner, nonce) => pda('duel', owner.toBuffer(), u64(nonce));
const vrfAccounts = [r(pda('identity')), r(VRF), r(SYSVAR_SLOT_HASHES_PUBKEY)];
const discriminatorCache = new Map();

async function discriminator(preimage) {
  if (!discriminatorCache.has(preimage)) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(preimage));
    discriminatorCache.set(preimage, Buffer.from(hash).subarray(0, 8));
  }
  return discriminatorCache.get(preimage);
}

function decodeCard(key, data) {
  return { key, owner: pub(data, 8), lock: pub(data, 40), kind: data[72] };
}

export function decodeDuel(key, data) {
  return {
    key, p1: pub(data, 16), p2: pub(data, 48), card1: pub(data, 80), card2: pub(data, 112),
    winner: pub(data, 144), deadline: Number(data.readBigInt64LE(176)) * 1000, phase: data[184],
    moves: [data[185], data[186]], crits: [Boolean(data[187]), Boolean(data[188])],
    scores: [data[189], data[190]],
  };
}

async function checkedAccount(connection, key, type, size) {
  const info = await connection.getAccountInfo(key, 'confirmed');
  if (!info?.owner.equals(PROGRAM) || info.data.length !== size ||
      !info.data.subarray(0, 8).equals(await discriminator('account:' + type))) return null;
  return info.data;
}

export async function readDuel(key, connection = DEVNET) {
  const data = await checkedAccount(connection, key, 'Duel', 191);
  return data ? decodeDuel(key, data) : null;
}

export async function readRound(key, connection = DEVNET) {
  const data = await checkedAccount(connection, roundKey(key), 'Round', 106);
  return data ? { moves: [data[104], data[105]] } : null;
}

export async function readCard(key, connection = DEVNET) {
  const data = await checkedAccount(connection, key, 'Card', 73);
  return data ? decodeCard(key, data) : null;
}

export async function until(fn, timeout = 42000, pause = 1300) {
  const start = Date.now();
  do {
    const value = await fn();
    if (value) return value;
    await sleep(pause);
  } while (Date.now() - start < timeout);
  throw new Error('The network is still processing. Retry to resume.');
}

export async function proof(key, message, connection = DEVNET) {
  const signatures = await connection.getSignaturesForAddress(key, { limit: 10 }, 'confirmed');
  for (const { signature, err } of signatures) {
    if (err) continue;
    const result = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
    if (result?.meta?.logMessages?.some((line) => line.includes(message))) return signature;
  }
  return null;
}

export function localKey(name) {
  const slot = 'demon-duels:v1:' + name;
  const saved = localStorage.getItem(slot);
  if (saved) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(saved)));
  const key = Keypair.generate();
  localStorage.setItem(slot, JSON.stringify(Array.from(key.secretKey)));
  return key;
}

export class ArenaClient {
  constructor(keypair, base = DEVNET, tee = TEE) {
    this.keypair = keypair;
    this.key = keypair.publicKey;
    this.base = base;
    this.teeRpc = tee;
  }

  async tee() {
    if (!this.privateConnection || Date.now() >= this.expires - 60000) {
      const result = await getAuthToken(this.teeRpc, this.key, async (challenge) =>
        nacl.sign.detached(challenge, this.keypair.secretKey));
      const url = new URL(this.teeRpc);
      url.searchParams.set('token', result.token);
      this.privateConnection = new Connection(url.href, 'confirmed');
      this.expires = result.expiresAt < 1e12 ? result.expiresAt * 1000 : result.expiresAt;
    }
    return this.privateConnection;
  }

  async send(instructions, connection = this.base, skipPreflight = false) {
    const window = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction({ feePayer: this.key, blockhash: window.blockhash, lastValidBlockHeight: window.lastValidBlockHeight });
    tx.add(...instructions);
    tx.sign(this.keypair);
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight, maxRetries: 6 });
    await until(async () => {
      const { value: [status] } = await connection.getSignatureStatuses([signature]);
      if (status?.err) {
        const record = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }).catch(() => null);
        const detail = record?.meta?.logMessages?.find((line) => line.includes('Error Message:'));
        throw new Error(detail?.split('Error Message: ')[1] || 'Transaction failed: ' + JSON.stringify(status.err));
      }
      return status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized';
    }, 35000, 500);
    return signature;
  }

  async programIx(name, keys, data = Buffer.alloc(0)) {
    return new TransactionInstruction({
      programId: PROGRAM, keys, data: Buffer.concat([await discriminator('global:' + name), data]),
    });
  }

  async balance() {
    return (await this.base.getBalance(this.key)) / LAMPORTS_PER_SOL;
  }

  async transfer(to, sol) {
    return this.send([SystemProgram.transfer({ fromPubkey: this.key, toPubkey: to, lamports: Math.round(sol * LAMPORTS_PER_SOL) })]);
  }

  async faucet() {
    const signature = await this.base.requestAirdrop(this.key, 0.12 * LAMPORTS_PER_SOL);
    await until(async () => (await this.balance()) >= 0.08, 16000);
    return signature;
  }

  async inventory() {
    const result = await this.base.getProgramAccounts(PROGRAM, {
      commitment: 'confirmed', filters: [{ dataSize: 73 }, { memcmp: { offset: 8, bytes: this.key.toBase58() } }],
    }).catch(async () => {
      const keys = [0, 1, 2].map((i) => cardKey(this.key, i));
      const raw = await this.base.getMultipleAccountsInfo(keys, 'confirmed');
      return raw.flatMap((account, i) => account?.owner.equals(PROGRAM) ? [{ account, pubkey: keys[i] }] : []);
    });
    const prefix = await discriminator('account:Card');
    return result.filter(({ account }) => account.data.subarray(0, 8).equals(prefix))
      .map(({ pubkey, account }) => decodeCard(pubkey, account.data))
      .filter((card) => card.kind < 6 && card.owner.equals(this.key));
  }

  async pack() {
    const data = await checkedAccount(this.base, packKey(this.key), 'Pack', 41);
    return data ? { opened: data[40] === 1 } : null;
  }

  async requestPack() {
    return this.send([await this.programIx('request_pack', [
      signer(this.key), w(packKey(this.key)), ...[0, 1, 2].map((i) => w(cardKey(this.key, i))),
      w(QUEUE), r(SYSTEM), ...vrfAccounts,
    ])]);
  }

  async retryPack() {
    const pack = packKey(this.key);
    const retry = pda('pack-retry', pack.toBuffer());
    const state = await checkedAccount(this.base, retry, 'PackRetry', 16);
    if (state && Number(state.readBigInt64LE(8)) * 1000 > Date.now()) return null;
    return this.send([await this.programIx('retry_pack', [
      signer(this.key), r(pack), w(retry), w(QUEUE), r(SYSTEM), ...vrfAccounts,
    ])]);
  }

  async openDuel(card) {
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(8))).readBigUInt64LE();
    const duel = duelKey(this.key, nonce);
    const signature = await this.send([await this.programIx('open_duel', [
      signer(this.key), w(duel), w(card), r(SYSTEM),
    ], u64(nonce))]);
    return { duel, signature };
  }

  async joinDuel(duel, card) {
    const { key, p1 } = duel;
    return this.send([await this.programIx('join_duel', [
      signer(this.key), w(key), w(card), w(roundKey(key)), w(pickKey(key, p1)), w(pickKey(key, this.key)), r(SYSTEM),
    ])]);
  }

  async delegate(duel) {
    const { key, p1, p2 } = duel;
    const accounts = [roundKey(key), pickKey(key, p1), pickKey(key, p2)];
    const state = await this.base.getMultipleAccountsInfo(accounts, 'confirmed');
    const pending = [];
    for (let i = 0; i < accounts.length; i++) {
      if (state[i]?.owner.equals(DELEGATION_PROGRAM_ID)) continue;
      const target = accounts[i];
      pending.push(await this.programIx('delegate_round', [
        w(delegateBufferPdaFromDelegatedAccountAndOwnerProgram(target, PROGRAM)),
        w(delegationRecordPdaFromDelegatedAccount(target)), w(delegationMetadataPdaFromDelegatedAccount(target)),
        w(target), signer(this.key), r(key), r(VALIDATOR), r(PROGRAM), r(DELEGATION_PROGRAM_ID), r(SYSTEM),
      ], bytes(i)));
    }
    return pending.length ? this.send(pending) : null;
  }

  async pick(duel) {
    const tee = await this.tee();
    const data = await checkedAccount(tee, pickKey(duel.key, this.key), 'Pick', 73);
    return data ? data[72] : null;
  }

  async lock(duel, move) {
    const tee = await this.tee();
    const pick = pickKey(duel.key, this.key);
    const permission = permissionPdaFromAccount(pick);
    await until(async () => {
      const data = await tee.getAccountInfo(pick).catch(() => null);
      return data?.owner.equals(PROGRAM);
    }, 22000, 750);
    const prior = await this.pick(duel);
    if (prior < 3 && prior !== null) return null;
    const metas = [signer(this.key), w(pick)];
    await this.send([await this.programIx('protect_pick', [
      ...metas, w(permission), r(PERMISSION_PROGRAM_ID), w(VAULT), r(MAGIC_PROGRAM_ID),
    ])], tee, true);
    await until(async () => (await tee.getAccountInfo(permission))?.owner.equals(PERMISSION_PROGRAM_ID), 10000, 400);
    return this.send([await this.programIx('lock_move', [...metas, r(permission)], bytes(move))], tee, true);
  }

  async reveal(duel) {
    const tee = await this.tee();
    const { key, p1, p2 } = duel;
    const revealed = await readRound(key, tee);
    if (revealed?.moves[0] < 3) return null;
    return this.send([await this.programIx('reveal_moves', [
      signer(this.key), w(roundKey(key)), r(pickKey(key, p1)), r(pickKey(key, p2)),
    ])], tee, true);
  }

  async commit(duel) {
    const tee = await this.tee();
    if ((await readRound(duel.key, this.base))?.moves[0] < 3) return null;
    return this.send([await this.programIx('commit_round', [
      signer(this.key), w(roundKey(duel.key)), r(MAGIC_PROGRAM_ID), w(MAGIC_CONTEXT_ID),
    ])], tee, true);
  }

  async requestOutcome(duel) {
    return this.send([await this.programIx('request_outcome', [
      signer(this.key), w(duel.key), r(roundKey(duel.key)), w(QUEUE), ...vrfAccounts, r(SYSTEM),
    ])]);
  }

  async refund(duel) {
    return this.send([await this.programIx('refund', [
      signer(this.key), w(duel.key), w(duel.card1), duel.p2.equals(ZERO) ? r(PROGRAM) : w(duel.card2),
    ])]);
  }
}
