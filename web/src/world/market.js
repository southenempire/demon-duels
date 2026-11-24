import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { PROGRAM, ZERO, decodeDuel, readCards } from '../chain.js';

const prefix = async (name) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name))).subarray(0, 8);

export async function openBounties(connection, player, storage, now = Date.now()) {
  const discriminator = await prefix('account:Duel');
  const accounts = await connection.getProgramAccounts(PROGRAM, { commitment: 'confirmed',
    filters: [
      { dataSize: 191 },
      { memcmp: { offset: 48, bytes: ZERO.toBase58() } },
      { memcmp: { offset: 184, bytes: '1' } },
    ],
  });
  const rooms = accounts.flatMap(({ pubkey, account }) =>
    account.data.subarray(0, 8).equals(discriminator) ? [decodeDuel(pubkey, account.data)] : [])
    .filter((duel) => duel.phase === 0 && duel.p2.equals(ZERO) && !duel.p1.equals(player) && duel.deadline > now &&
      storage.getItem('demon-duels:solo:' + duel.key) !== '1')
    .sort((a, b) => b.deadline - a.deadline)
    .slice(0, 8);
  if (!rooms.length) return [];
  const cards = await readCards(rooms.map((duel) => duel.card1), connection);
  return rooms.flatMap((duel, i) => {
    const card = cards[i];
    return card?.owner.equals(duel.p1) && card.lock.equals(duel.key) ?
      [{ room: duel.key.toString(), owner: duel.p1.toString(), kind: card.kind, deadline: duel.deadline }] : [];
  });
}

export function settledEvents(logs, discriminator, program = PROGRAM.toString()) {
  const invocations = [];
  const settled = [];
  for (const line of logs) {
    const start = /^Program (\w+) invoke \[\d+\]$/.exec(line);
    if (start) { invocations.push(start[1]); continue; }
    if (/^Program \w+ (success|failed:)/.test(line)) { invocations.pop(); continue; }
    if (invocations.at(-1) !== program || !line.startsWith('Program data: ')) continue;
    const bytes = Buffer.from(line.slice(14), 'base64');
    if (bytes.length !== 140 || !bytes.subarray(0, 8).equals(discriminator)) continue;
    const address = (offset) => new PublicKey(bytes.subarray(offset, offset + 32));
    settled.push({ duel: address(8), winner: address(40), cards: [address(72), address(104)] });
  }
  return settled;
}

async function transactionLogs(endpoint, signatures, request) {
  const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signatures.map((signature, id) => ({
      jsonrpc: '2.0', id, method: 'getTransaction',
      params: [signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 1 }],
    }))),
  });
  if (!response.ok) throw new Error('Transaction history is unavailable');
  const results = await response.json();
  if (!Array.isArray(results) || results.some(({ error }) => error)) throw new Error('Transaction history is unavailable');
  return results.sort((a, b) => a.id - b.id);
}

export async function hunterLedger(connection, request = fetch) {
  const signatures = (await connection.getSignaturesForAddress(PROGRAM, { limit: 24 }, 'confirmed'))
    .filter(({ err }) => !err).map(({ signature }) => signature);
  if (!signatures.length) return [];
  const [discriminator, transactions] = await Promise.all([
    prefix('event:DuelSettled'),
    transactionLogs(connection.rpcEndpoint, signatures, request),
  ]);
  const events = transactions.flatMap(({ id, result }) => settledEvents(result?.meta?.logMessages ?? [], discriminator)
    .map((event) => ({ ...event, proof: signatures[id] }))).slice(0, 6);
  if (!events.length) return [];
  const duels = await connection.getMultipleAccountsInfo(events.map(({ duel }) => duel), 'confirmed');
  const duelPrefix = await prefix('account:Duel');
  const matches = events.flatMap((event, index) => {
    const entry = duels[index];
    if (!entry?.owner.equals(PROGRAM) || entry.data.length !== 191 || !entry.data.subarray(0, 8).equals(duelPrefix)) return [];
    const duel = decodeDuel(event.duel, entry.data);
    if (duel.phase !== 3 || !event.winner.equals(duel.winner) ||
        !event.cards[0].equals(duel.card1) || !event.cards[1].equals(duel.card2)) return [];
    const firstWon = event.winner.equals(duel.p1);
    if (!firstWon && !event.winner.equals(duel.p2)) return [];
    return [{ duel: event.duel.toString(), winner: event.winner.toString(), proof: event.proof,
      loser: (firstWon ? duel.p2 : duel.p1).toString(), lostCard: firstWon ? duel.card2 : duel.card1 }];
  });
  if (!matches.length) return [];
  const cards = await readCards(matches.map(({ lostCard }) => lostCard), connection);
  return matches.map(({ lostCard, ...entry }, i) => ({ ...entry, kind: cards[i]?.kind ?? null }));
}
