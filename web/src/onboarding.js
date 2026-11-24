import { until } from './chain.js';
import { demons } from './rules.js';

const GUEST_MINIMUM = 0.05;

export function botGeneration(value) {
  const generation = Number(value);
  return Number.isSafeInteger(generation) && generation >= 0 && generation < Number.MAX_SAFE_INTEGER
    ? generation : 0;
}

export async function ensurePack(owner, pack = undefined, wait = until) {
  const existing = pack === undefined ? await owner.pack() : pack;
  if (existing?.opened) return;
  if (!existing) await owner.requestPack();
  else if (!await owner.retryPack()) throw new Error('A starter pack retry is already pending. Check again in a few minutes.');
  await wait(async () => (await owner.pack())?.opened, 60000);
}

export async function stockBossCard(demonId, { find, mint, fund }) {
  if (!Number.isInteger(demonId) || !demons[demonId]) throw new Error('Unknown boss demon.');
  let candidate = await find(demonId);
  while (!candidate) {
    const pack = await mint();
    if (!pack) throw new Error('Fund the guest wallet to continue summoning this boss. Your card was not staked.');
    const { bot, generation, cards } = pack;
    const card = cards.find((item) => item.kind === demonId);
    if (card) candidate = { bot, generation, card };
  }
  await fund(candidate.bot);
  return { ...candidate, demonId };
}

export async function prepareGuest(owner, progress, openPack = ensurePack) {
  if (await owner.balance() < GUEST_MINIMUM) {
    progress('Requesting free devnet SOL for your guest…');
    try { await owner.faucet(); }
    catch { throw new Error('Quick airdrop unavailable. Retry, or open your vault to fund manually.'); }
  }
  progress('Opening your MagicBlock VRF starter pack…');
  await openPack(owner);
}

export async function recoverGuestPack(owner, { replace, progress, prepare = prepareGuest }) {
  const [cards, pack] = await Promise.all([owner.inventory({ allowFallback: false }), owner.pack()]);
  if (cards.length) return false;
  await prepare(pack?.opened ? replace() : owner, progress);
  return true;
}
