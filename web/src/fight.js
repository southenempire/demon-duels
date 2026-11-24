export function privateMoveRetryMessage(error, { online, sealed }) {
  const detail = String(error?.message || error);
  const connectionLost = /failed to fetch|networkerror|network request|load failed|fetch failed|connection (?:reset|refused)|ECONNRESET|\b(?:502|503|504)\b/i.test(detail);
  const pending = /network is still processing|timed out|timeout/i.test(detail);
  const status = !online ? 'You’re offline.' : connectionLost ? 'The devnet connection dropped.' : pending ? 'Devnet hasn’t confirmed the last step yet.' : null;
  if (!status) return null;
  return status + (sealed
    ? ' Your move was sealed. When connected, choose Check for reveal.'
    : ' You don’t need to stake again. When connected, retry sealing your move.');
}

export function arenaCardSide(duel, player) {
  if (duel.p2.equals(player)) return 1;
  return duel.phase === 0 && !duel.p1.equals(player) ? 1 : 0;
}

export function defaultStake(cards, opponentKind, kindOf = (card) => card.kind) {
  return cards.find((card) => kindOf(card) !== opponentKind) ?? cards[0];
}

export function sealedMoveNotice(duel, player, waitingRoom) {
  return duel?.phase === 1 && duel.key.toString() === waitingRoom &&
    (duel.p1.equals(player) || duel.p2.equals(player))
    ? 'Your move is sealed. Waiting for your opponent.'
    : '';
}

// Presentation only: never roll randomness or infer a chain result here.
export function confirmedFight(duel, side = 0) {
  if (duel?.phase !== 3) return null;
  const orient = (values) => side ? [...values].reverse() : [...values];
  return {
    moves: orient(duel.moves),
    crits: orient(duel.crits),
    score: orient(duel.scores),
    winner: duel.winner.equals(side ? duel.p2 : duel.p1) ? 0 : 1,
  };
}

// Only participants receive campaign credit, and only from confirmed settlement.
export function confirmedSettlement(duel, player, opponentKind, proof = null) {
  if (duel?.phase !== 3 || !(duel.p1.equals(player) || duel.p2.equals(player))) return null;
  const result = confirmedFight(duel, duel.p2.equals(player) ? 1 : 0);
  return { mode: 'chain', duel: duel.key.toString(), winner: duel.winner.toString(),
    player: player.toString(), opponentKind, won: result.winner === 0, result, proof };
}

export function fightReason(result, practice = false) {
  if (result.score[0] === result.score[1]) return practice ? 'Damage tied · practice randomness broke the tie.' : 'Damage tied · MagicBlock VRF broke the tie.';
  const loser = 1 - result.winner;
  if (result.crits[result.winner] && (result.moves[loser] + 1) % 3 === result.moves[result.winner]) return 'CRIT COMEBACK · +2 critical damage overcame the matchup advantage.';
  return 'Higher clash power wins: base 2, +1 for move advantage, +2 only on a critical hit.';
}
