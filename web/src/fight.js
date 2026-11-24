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

export function fightTimeline(result) {
  const frames = [{ stage: 'reveal', duration: 1050, attacks: 0 }];
  for (const side of [0, 1]) {
    frames.push(
      { stage: 'windup', attacker: side, duration: 520, attacks: side },
      { stage: 'strike', attacker: side, duration: 620, attacks: side + 1, sound: result.crits[side] ? 'crit' : 'strike' },
      { stage: 'recover', attacker: side, duration: 540, attacks: side + 1 },
    );
  }
  frames.push(
    { stage: 'decision', duration: 1000, attacks: 2 },
    { stage: 'spoils', duration: 1500, attacks: 2, sound: result.winner === 0 ? 'victory' : 'defeat' },
    { stage: 'finish', duration: 500, attacks: 2 },
  );
  return frames;
}

export function fighterPose(frame, side, result) {
  if (!frame || !result) return 'idle';
  if (frame.stage === 'finish' || frame.stage === 'spoils') return result.winner === side ? 'crit' : 'defeat';
  if (frame.stage === 'windup' && frame.attacker === side) return 'attack';
  if (frame.stage === 'strike') return frame.attacker === side ? (result.crits[side] ? 'crit' : 'attack') : 'hit';
  return 'idle';
}

export function fightReason(result, practice = false) {
  if (result.score[0] === result.score[1]) return practice ? 'Damage tied · practice randomness broke the tie.' : 'Damage tied · MagicBlock VRF broke the tie.';
  const loser = 1 - result.winner;
  if (result.crits[result.winner] && (result.moves[loser] + 1) % 3 === result.moves[result.winner]) return 'CRIT COMEBACK · +2 critical damage overcame the matchup advantage.';
  return 'Higher clash power wins: base 2, +1 for move advantage, +2 only on a critical hit.';
}
