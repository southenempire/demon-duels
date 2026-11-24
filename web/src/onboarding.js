import { until } from './chain.js';

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
  await wait(async () => (await owner.pack())?.opened, 60000);
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
