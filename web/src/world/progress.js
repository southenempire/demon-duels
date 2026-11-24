export const campaignKey = (player) => 'demon-duels:campaign:v1:' + player;
export const worldKey = (player) => 'demon-duels:world:v1:' + player;
export const encounterKey = (duel) => 'demon-duels:world-encounter:' + duel;
export const activeKey = 'demon-duels:active';
export const gradeScore = { exposed: 0, shadow: 1, ghost: 2 };

export function readJSON(storage, key) {
  try { return JSON.parse(storage.getItem(key)); }
  catch { return null; }
}

export function readWins(storage, player, count = 6) {
  const journal = readJSON(storage, campaignKey(player));
  const wins = [];
  if (journal?.version !== 1 || !Array.isArray(journal.wins)) return wins;
  for (const win of journal.wins.slice(0, count)) {
    if (win?.bossId !== wins.length || typeof win.duel !== 'string' || !win.duel ||
        wins.some((saved) => saved.duel === win.duel)) break;
    wins.push(win);
  }
  return wins;
}

export function acceptedWin(wins, player, encounter, detail) {
  return encounter?.mode === 'chain' && encounter.duel && detail?.mode === 'chain' && detail.won === true &&
    detail.duel === encounter.duel && detail.opponentKind === encounter.opponentKind &&
    detail.player === player && detail.winner === player &&
    wins.some(({ bossId, duel }) => bossId === encounter.opponentKind && duel === detail.duel);
}
