const [REND, WARD, HEX] = [0, 1, 2];

function exchange(attack, defense) {
  if (attack === WARD && defense === WARD) return ['strike', 'block', 'HAND BLOCK'];
  if (attack === WARD && defense === REND) return ['block', 'strike', 'HAND BLOCK'];
  if (defense === WARD) return attack === REND ? ['strike', 'parry', 'PARRY'] : ['feint', 'block', 'HAND BLOCK'];
  if (defense === HEX) return [attack === HEX ? 'feint' : 'strike', 'dodge', 'DODGE'];
  return attack === HEX ? ['feint', 'dodge', 'DODGE'] : ['strike', 'hit', 'IMPACT'];
}

// Read the recorded winner, even when the move matchup suggests otherwise.
export function meleeTimeline(result) {
  const beat = (stage, duration, extra = {}) => ({ stage, duration, attacks: 0, ...extra });
  const frames = [beat('reveal', 950)];
  for (const side of [0, 1]) {
    const [lead, answer, label] = exchange(result.moves[side], result.moves[1 - side]);
    const actions = side ? [answer, lead] : [lead, answer];
    frames.push(beat('exchange', 1300, { attacker: side, attacks: side + 1, actions, label,
      sound: result.moves[side] === HEX ? 'hex' : result.moves[side] === WARD ? 'ward' : 'rend' }));
  }
  frames.push(beat('decision', 1450, { attacks: 2, tied: result.score[0] === result.score[1],
    sound: result.crits.some(Boolean) ? 'crit' : undefined }));
  frames.push(beat('counter', 2520, { attacker: result.winner, attacks: 2,
    actions: result.winner ? ['death', 'counter'] : ['counter', 'death'], label: 'COUNTER KILL' }));
  frames.push(beat('spoils', 1500, { attacks: 2, sound: result.winner === 0 ? 'victory' : 'defeat' }));
  frames.push(beat('finish', 100, { attacks: 2 }));
  return frames;
}

export function meleeActions(frame, result) {
  if (frame?.actions) return frame.actions;
  if (result && ['spoils', 'finish'].includes(frame?.stage)) {
    return result.winner ? ['fallen', 'victory'] : ['victory', 'fallen'];
  }
  return ['guard', 'guard'];
}
