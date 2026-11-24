import { until } from './chain.js';
import { demons } from './rules.js';

const GUEST_MINIMUM = 0.05;

export function botGeneration(value) {
  const generation = Number(value);
  return Number.isSafeInteger(generation) && generation >= 0 && generation < Number.MAX_SAFE_INTEGER
    ? generation : 0;
}

export async function ensurePack(owner, pack = undefined, wait = until, progress = () => {}) {
  const existing = pack === undefined ? await owner.pack() : pack;
  if (existing?.opened) return;
  const opened = async () => (await owner.pack())?.opened;
  if (!existing) await owner.requestPack();
  else if (!await owner.retryPack()) progress('A starter-pack request is pending. Waiting for MagicBlock VRF…');
  try {
    await wait(opened, 60000);
  } catch (error) {
    if (error.message !== 'The network is still processing. Retry to resume.') throw error;
    if (await opened()) return;
    const retry = await owner.retryPack();
    progress(retry ? 'Starter-pack request renewed. Waiting for MagicBlock VRF…'
      : 'The starter-pack request is still pending. Waiting for the oracle without submitting another request…');
    try {
      await wait(opened, retry ? 120000 : 300000);
    } catch (second) {
      if (second.message !== 'The network is still processing. Retry to resume.') throw second;
      throw new Error('The starter pack is still unopened. Resume setup to check that same pack again; no card has been staked.');
    }
  }
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
  await openPack(owner, undefined, until, progress);
}

export async function recoverGuestPack(owner, { replace, progress, prepare = prepareGuest }) {
  const [cards, pack] = await Promise.all([owner.inventory({ allowFallback: false }), owner.pack()]);
  if (cards.length) return false;
  await prepare(pack?.opened ? replace() : owner, progress);
  return true;
}
