// Campaign achievements are a browser-local journal of confirmed devnet duels,
// not a token, an onchain access restriction, or a source of card ownership.
export const circles = [
  { id: 0, slug: 'ash-warden', realm: 'The Cinder Gate', epithet: 'Keeper of the first flame', color: '#ff8b57', x: 22, y: 77,
    story: 'The gate has burned for a thousand years. Its keeper feeds the fire with the names of those who turn back.',
    quote: '“Leave your fear at the threshold. I have no use for ashes.”', victory: 'The first fire kneels. A path opens through the dark.' },
  { id: 1, slug: 'void-wraith', realm: 'The Hollow Expanse', epithet: 'The voice between worlds', color: '#bc99ff', x: 53, y: 66,
    story: 'Beyond the gate, the road ends in nothing. A shape moves inside the silence. It knows the move you wish you had made.',
    quote: '“Even the bravest soul casts a shadow. Yours belongs to me.”', victory: 'The silence breaks. Something ancient has noticed your descent.' },
  { id: 2, slug: 'marrow-king', realm: 'The Ossuary Throne', epithet: 'Sovereign of the forgotten', color: '#edc779', x: 78, y: 50,
    story: 'Every fallen challenger is a stone in his palace. The king offers you a place in his court. You would rather take his crown.',
    quote: '“All roads lead to my throne. Few lead away.”', victory: 'The crown falls. The dead make way for the living.' },
  { id: 3, slug: 'mire-phantom', realm: 'The Weeping Fen', epithet: 'Hunger beneath the surface', color: '#9fce76', x: 47, y: 42,
    story: 'The swamp remembers every promise ever broken. Beneath its still water, a phantom waits to collect yours.',
    quote: '“Step closer. The water is only as deep as your regret.”', victory: 'The waters clear. Your reflection is no longer alone.' },
  { id: 4, slug: 'frost-herald', realm: 'The Still Cathedral', epithet: 'Harbinger of the last winter', color: '#8edbff', x: 22, y: 25,
    story: 'No bell has rung here since the world was young. The herald keeps a winter so cold that even time has stopped.',
    quote: '“Be still. Eternity will not hurt for long.”', victory: 'The bell rings once. The last seal begins to fracture.' },
  { id: 5, slug: 'gloam-shade', realm: 'The Eclipse Sanctum', epithet: 'The shadow behind the crown', color: '#d0a3ee', x: 59, y: 13,
    story: 'At the bottom of the world, the final guardian wears no crown. It has no need. Every shadow in the Underworld answers to it.',
    quote: '“You came here for power. Show me what you are willing to lose.”', victory: 'Six guardians fall. The Underworld knows your name. The open pit awaits.' },
];

export const campaignKey = (player) => 'demon-duels:campaign:v1:' + player;
export const encounterKey = (room) => 'demon-duels:boss:' + room;
export const freshCampaign = () => ({ version: 1, wins: [] });

export function readCampaign(storage, player) {
  try {
    const value = JSON.parse(storage.getItem(campaignKey(player)));
    if (value?.version !== 1 || !Array.isArray(value.wins)) return freshCampaign();
    const wins = [];
    for (const win of value.wins.slice(0, circles.length)) {
      if (win?.bossId !== wins.length || typeof win.duel !== 'string' || !win.duel || wins.some((old) => old.duel === win.duel)) break;
      wins.push({ bossId: win.bossId, duel: win.duel });
    }
    return { version: 1, wins };
  } catch { return freshCampaign(); }
}

export const circleState = (progress, id) => id < progress.wins.length ? 'conquered' : id === progress.wins.length ? 'available' : 'locked';
export const pitUnlocked = (progress) => progress.wins.length === circles.length;

export function recordBossWin(progress, result) {
  const { bossId, phase, player, winner, opponent, bot, opposingKind, duel, mode } = result;
  if (mode !== 'chain' || phase !== 3 || !player || !bot || player === bot || winner !== player || opponent !== bot ||
    !duel || !Number.isInteger(bossId) || bossId !== progress.wins.length || !circles[bossId] ||
    opposingKind !== bossId || progress.wins.some((win) => win.duel === duel)) return progress;
  return { version: 1, wins: [...progress.wins, { bossId, duel }] };
}
