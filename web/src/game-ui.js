import { moves as duelMoves } from './rules.js';

// Pure overlay renderers: callers own their canvas, state, action handlers and
// focus lifecycle. `actions` is trusted application markup, not player input.
// Import game-overlays.css after the renderer's own stylesheet.
const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const actionAttr = (name) => /^data-[a-z][a-z0-9-]*$/.test(name || '') ? name : 'data-action';
const bounded = (value, max = 100) => Math.min(max, Math.max(0, Number(value) || 0));

export function titleScreen({ actions, loading = '' } = {}) {
  return `<section class="dd-ui dd-title" aria-labelledby="game-title">
    <div class="dd-title-copy">
      <span class="dd-kicker">AN UNDERWORLD CHRONICLE</span>
      <h1 class="dd-title-logo" id="game-title">DEMON<span>DUELS</span></h1>
      <div class="dd-title-chapter">THE SEALED HAND</div>
      <p class="dd-title-lore">You lost your name.<br>Make the Underworld remember.</p>
      <nav class="dd-menu" aria-label="Main menu">${actions || ''}</nav>
      ${loading ? `<div class="dd-title-loading" role="status">${loading}</div>` : ''}
    </div>
    <div class="dd-edition"><span>CHAPTER I — THE DESCENT</span><span>SOLANA DEVNET · TEST TOKENS ONLY</span></div>
  </section>`;
}

export function loadingScreen({ label = 'ENTERING THE UNDERWORLD', progress = null, detail = '' } = {}) {
  const determinate = progress !== null && Number.isFinite(Number(progress));
  return `<section class="dd-ui dd-loading" role="status" aria-live="polite"><span class="dd-load-sigil" aria-hidden="true">◇</span><h2>${escape(label)}</h2><div class="dd-load-track${determinate ? ' is-determinate' : ''}" aria-hidden="true"><i${determinate ? ` style="width:${bounded(progress)}%"` : ''}></i></div>${detail ? `<p>${escape(detail)}</p>` : ''}</section>`;
}

export function worldHud({ location = 'Ash Gate', chapter = 'I / THE UNDERWORLD', objective = '', health = 100, maxHealth = 100, seals = 0, awareness = 'clear', prompt = null, message = '', hunters = 0, actions } = {}) {
  const max = Math.max(1, Number(maxHealth) || 100);
  const current = bounded(health, max);
  const state = ['clear', 'suspicious', 'alert'].includes(awareness) ? awareness : 'clear';
  const promptCopy = prompt ? `<kbd>${escape(prompt.key)}</kbd> ${escape(prompt.label)}` : '';
  const strike = prompt && (prompt.action || String(prompt.key).toLowerCase() === 'e');
  return `<div class="dd-ui dd3d-hud dd-world-hud"><div class="dd-world-summary"><div class="dd-vitals"><span class="dd-kicker">${escape(chapter)}</span><h1>${escape(location)}</h1><div class="dd-health" role="meter" aria-label="Hunter health" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${current}"><i style="width:${current / max * 100}%"></i></div><small>${bounded(seals, 6)} / 6 SEALS BROKEN</small></div>${objective ? `<div class="dd-objective"><span class="dd-kicker">CURRENT MEMORY</span><p data-objective>${escape(objective)}</p></div>` : ''}</div><nav class="dd-hud-actions" aria-label="Game menu">${actions ?? '<button type="button" data-hunt="pause" aria-label="Pause game">PAUSE <kbd>ESC</kbd></button><button type="button" data-hunt="exit">ENTER THE PIT</button>'}<small>${Math.floor(bounded(hunters, 999))} HUNTERS NEARBY</small></nav><div class="dd-world-message" role="status">${escape(message)}</div>${prompt ? strike ? `<button type="button" class="dd-context-prompt" data-hunt="${escape(prompt.action || 'strike')}">${promptCopy}</button>` : `<div class="dd-context-prompt">${promptCopy}</div>` : ''}<div class="dd-awareness" data-state="${state}"><span aria-hidden="true">◇</span>${{ clear: 'UNSEEN', suspicious: 'SUSPICIOUS', alert: 'SEEN' }[state]}</div><div class="dd-key-hints"><span><kbd>WASD / ↑↓←→</kbd> Move</span><span><kbd>SHIFT</kbd> SPRINT</span><span><kbd>C</kbd> CROUCH</span><span><kbd>SPACE</kbd> JUMP / CLIMB</span><span>DRAG TO LOOK</span></div></div>`;
}

export function storyPanel({ speaker = 'THE UNDERWORLD', text = '', actions = '' } = {}) {
  return `<section class="dd-ui dd-story" aria-label="Dialogue"><span class="dd-kicker">${escape(speaker)}</span><p>${escape(text)}</p><div class="dd-story-actions">${actions}</div></section>`;
}

export function pauseMenu({ title = 'MEMORY PAUSED', actions = '' } = {}) {
  return `<section class="dd-ui dd-pause" aria-label="Pause menu"><span class="dd-kicker">DEMON DUELS</span><h2>${escape(title)}</h2><nav class="dd-menu" aria-label="Pause actions">${actions}</nav></section>`;
}

export function movePicker({ moves = duelMoves, selected = null, locked = false, busy = false, status = '', actions = '', actionAttribute = 'data-action' } = {}) {
  return `<section class="dd-ui dd-picker dd-move-picker" aria-label="Seal your move"><div class="dd-picker-heading"><span class="dd-kicker">${locked ? 'MEMORY SEALED' : 'CHOOSE YOUR APPROACH'}</span><span>${locked ? 'AWAITING REVEAL' : 'SEAL ONE MOVE'}</span></div><div class="dd-moves">${moves.map((move, i) => {
    const id = move.id ?? i;
    const chosen = String(selected) === String(id);
    return `<button type="button" class="dd-move${chosen ? ' is-selected' : ''}" ${actionAttr(actionAttribute)}="${escape(move.action ?? `move:${id}`)}" aria-pressed="${chosen}"${locked || busy ? ' disabled' : ''}><span class="dd-move-index" aria-hidden="true">0${i + 1}</span><span><b>${escape(move.name)}</b><small>${move.beats ? 'BEATS ' + escape(move.beats) : escape(move.description || '')}</small></span>${chosen ? '<span class="dd-selected-mark" aria-hidden="true">◇</span>' : ''}</button>`;
  }).join('')}</div>${status ? `<p class="dd-picker-status" role="status">${escape(status)}</p>` : ''}${actions ? `<div class="dd-picker-actions">${actions}</div>` : ''}</section>`;
}

export function duelHud({ player = {}, opponent = {}, phase = 'SEAL YOUR MOVE' } = {}) {
  const fighter = (value, side) => {
    const max = Math.max(1, Number(value.maxHealth) || 100);
    const hp = bounded(value.health ?? max, max);
    const card = typeof value.card === 'object' && value.card ? value.card.name || value.card.type || '' : value.card;
    return `<div class="dd-duelist dd-duelist-${side}${value.winner ? ' is-winner' : ''}"><span class="dd-kicker">${escape(value.label || (side ? 'GUARDIAN' : 'YOU'))}</span><strong>${escape(value.name || 'UNKNOWN')}</strong>${Number.isFinite(value.health) ? `<div class="dd-health" role="meter" aria-label="${escape(value.name || (side ? 'Opponent' : 'Player'))} health" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${hp}"><i style="width:${hp / max * 100}%"></i></div>` : '<div class="dd-duelist-rule" aria-hidden="true"></div>'}${value.detail || card ? `<small>${escape(value.detail || card)}</small>` : ''}${value.crit ? '<span class="dd-crit">CRITICAL STRIKE</span>' : ''}${value.winner ? '<span class="dd-winner">VICTOR</span>' : ''}</div>`;
  };
  const phases = { stake: 'STAKE YOUR DEMON', faceoff: 'FACE YOUR RIVAL', seal: 'SEAL YOUR MOVE', clash: 'THE CLASH', crit: 'CRITICAL STRIKE', take: 'WINNER TAKES BOTH', return: 'RETURN TO THE PIT' };
  return `<div class="dd-ui dd-hud dd-duel-hud">${fighter(player, 0)}<span class="dd-duel-phase" role="status">${escape(phases[phase] || phase)}</span>${fighter(opponent, 1)}</div>`;
}

export function vaultPanel({ cards = [], actions = '', actionAttribute = 'data-action' } = {}) {
  return `<section class="dd-ui dd-vault" aria-label="Demon vault"><div class="dd-vault-heading"><span class="dd-kicker">YOUR COLLECTION</span><h2>THE VAULT <small>${cards.length}</small></h2>${actions}</div><div class="dd-vault-list">${cards.length ? cards.map((card) => `<button type="button" class="dd-vault-item${card.selected ? ' is-selected' : ''}" ${actionAttr(actionAttribute)}="${escape(card.action ?? `select:${card.id}`)}" aria-pressed="${Boolean(card.selected)}"${card.locked ? ' disabled' : ''}>${card.image ? `<img src="${escape(card.image)}" alt="" draggable="false">` : '<span class="dd-vault-sigil" aria-hidden="true">◇</span>'}<span><b>${escape(card.name)}</b><small>${escape(card.locked ? 'STAKED' : card.type || 'DEMON')}</small></span>${card.selected ? '<span class="dd-selected-mark" aria-hidden="true">◇</span>' : ''}</button>`).join('') : '<p class="dd-empty">Your vault is empty.</p>'}</div></section>`;
}

export function installDialogKeys(root) {
  // Rerendering a busy dialog can remove/disable its focused control and send
  // focus to <body>. Listen on the document so the next Tab is still trapped.
  const doc = root.ownerDocument;
  doc.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const dialog = root.querySelector('[role="dialog"]');
    if (!dialog || !dialog.getClientRects().length) return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]')]
      .filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (doc.activeElement === first || !dialog.contains(doc.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (doc.activeElement === last || !dialog.contains(doc.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
}
