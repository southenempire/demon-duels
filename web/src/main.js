import './style.css';
import './arena.css';
import { PublicKey } from '@solana/web3.js';
import { ArenaClient, PROGRAM, ZERO, addressExplorer, cardKey, explorer, localKey, packKey, proof, readCard, readCards, readDuel, readRound, until, sleep } from './chain.js';
import { icon } from './icons.js';
import { botGeneration, ensurePack, prepareGuest, stockBossCard } from './onboarding.js';
import { demons, moves, practicePack, resolve } from './rules.js';
import { characters, characterArt } from './characters.js';
import { confirmedFight, confirmedSettlement, fightTimeline, fighterPose, fightReason } from './fight.js';
import { PitEffects } from './effects.js';
import { PitSound } from './sound.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const readKey = (value) => { try { return value ? new PublicKey(value) : null; } catch { return null; } };
const client = new ArenaClient(localKey('player'));
const BOT_GENERATION = 'demon-duels:rival-generation';
const BOSS_GENERATIONS = 'demon-duels:boss-generations';
const activeRoomKey = 'demon-duels:active';
const botFor = (generation) => new ArenaClient(localKey(generation ? 'rival-' + generation : 'rival'));
const bossFor = (generation) => new ArenaClient(localKey('boss-' + generation));
const roomBotKey = (room) => 'demon-duels:room-bot:' + room;
const ASSET = import.meta.env.BASE_URL + 'art/';
const effects = new PitEffects();
const sound = new PitSound(import.meta.env.BASE_URL + 'audio/');
const loadedArt = new Map();
const emittedSettlements = new Set();
function preloadFighters() {
  return Promise.all(fighterKinds().filter((kind) => characters[kind]).flatMap((kind) => Object.values(characters[kind].poses)).map((path) => {
    if (!loadedArt.has(path)) {
      const image = new Image(); image.src = ASSET + path;
      loadedArt.set(path, image.decode().catch(() => {}));
    }
    return loadedArt.get(path);
  }));
}
const s = {
  mode: params.has('room') ? 'chain' : 'landing',
  balance: null, owned: [], selected: null, practiceCards: [], practiceStake: 0, practiceRival: 1,
  result: null, move: null, duel: null, busy: null, notice: '', modal: null, quick: false,
  sound: localStorage.getItem('demon-duels:sound') === 'on',
  room: readKey(params.get('room')), solo: false, opposing: null, proof: null, packProof: null, packPending: false,
  playing: false, frame: null, playedId: null, sequence: 0, resultId: 0,
  waitSince: null,
  requestedOpponent: null, returnToMap: false,
};
const short = (key) => key?.toString().slice(0, 4) + '…' + key?.toString().slice(-4);
const keyed = (value, key) => Boolean(value && key && value.equals(key));
const anyCard = () => s.owned.find((card) => keyed(card.key, s.selected) && keyed(card.lock, ZERO)) ??
  s.owned.find((card) => keyed(card.lock, ZERO));
const audio = (name) => sound.play(name);
const button = (action, label, cls = 'secondary', glyph = '') =>
  '<button type="button" data-action="' + action + '" class="button ' + cls + '"' + (s.busy || s.playing ? ' disabled' : '') + '>' + (glyph ? icon(glyph) : '') + label + '</button>';
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusText = (status) => '<span class="status-tag"><i></i>' + status + '</span>';
const proofLink = (sig, label) => sig ? '<a class="proof-link" href="' + explorer(sig) + '" target="_blank" rel="noreferrer">' + label + icon('outside', 14) + '</a>' : '';
const moveKey = () => 'demon-duels:pick:' + s.room;
const safeMode = () => s.mode === 'chain';
const mySide = () => keyed(s.duel?.p2, client.key) ? 1 : 0;
const participant = () => keyed(s.duel?.p1, client.key) || keyed(s.duel?.p2, client.key);
const moveLocked = () => s.move !== null;

const roundResult = () => s.result || confirmedFight(s.duel, mySide());
const fightId = () => s.result ? 'practice:' + s.resultId : s.duel?.key?.toString();
const fighterKinds = () => [
  s.mode === 'practice' ? s.practiceStake : s.mode === 'landing' ? 0 : s.staked?.kind ?? anyCard()?.kind,
  s.mode === 'practice' ? s.practiceRival : s.mode === 'landing' ? 1 : s.opposing?.kind,
];

function battlefield() {
  const result = roundResult();
  const frame = result ? s.frame : null;
  const finished = frame?.stage === 'finish' || frame?.stage === 'spoils';
  const reveal = Boolean(result && frame);
  const kinds = fighterKinds();
  const rival = s.mode === 'practice' || s.solo ? 'PIT BOT' : 'CHALLENGER';
  const title = finished ? (result.winner === 0 ? 'VICTORY' : 'DEFEAT') : frame?.stage === 'reveal' ? 'MOVES REVEALED' :
    frame?.stage === 'windup' ? moves[result.moves[frame.attacker]].name.toUpperCase() :
    frame?.stage === 'strike' ? (result.crits[frame.attacker] ? 'CRITICAL HIT' : 'DIRECT HIT') :
    frame?.stage === 'decision' ? result.score[0] === result.score[1] ? s.result ? 'TIE-BREAK' : 'VRF TIE-BREAK' : result.score[result.winner] + ' > ' + result.score[1 - result.winner] : '';
  const cue = s.mode === 'landing' ? 'THE PIT IS CALLING' : s.playing ? 'A DUEL. TWO DEMONS. ONE SURVIVOR.' : result ? 'THE DUST HAS SETTLED' :
    s.busy || (moveLocked() ? 'MOVE SEALED · AWAITING REVEAL' : s.duel?.phase === 2 ? 'AWAITING THE ORACLE' : 'CHOOSE YOUR MOVE');
  return `<section class="battlefield stage-${frame?.stage || 'idle'} ${s.playing ? 'is-playing' : ''} ${frame?.stage === 'strike' && result?.crits[frame.attacker] ? 'critical' : ''}" aria-label="Animated duel arena">
    <div class="arena-sky"></div><div class="arena-moon"></div><div class="arena-runes" aria-hidden="true">ᛟ ⟐ ᚷ ⟐ ᛟ ⟐ ᚷ ⟐</div>
    <div class="arena-hud">${kinds.map((kind, side) => {
      const d = demons[kind];
      const score = reveal && frame.attacks > side ? result.score[side] : null;
      return `<div class="fighter-hud hud-${side}" style="--fighter-color:${d?.glow || '#bba7cd'}"><span class="hud-role">${side ? rival : s.duel && !participant() ? 'PLAYER ONE' : 'YOU / PLAYER 01'}</span><strong>${d?.name || 'Empty stake'}</strong><div class="power-meter" aria-label="${score === null ? 'Clash power hidden' : 'Clash power ' + score + ' of 5'}">${Array.from({length: 5}, (_, i) => `<i class="${score !== null && i < score ? 'filled' : ''}"></i>`).join('')}</div><small>CLASH POWER <b>${score === null ? '—' : score + ' / 5'}</b></small></div>`;
    }).join('')}<div class="round-counter"><span>THE PIT</span><b>01</b><small>ROUND</small></div></div>
    <div class="arena-floor"></div><div class="arena-grid"></div>
    ${!result && moveLocked() ? '<div class="sealed-suspense"><span>' + icon('lock', 20) + '</span><b>MOVE SEALED</b><small>NO ONE SEES IT COMING</small></div>' : ''}
    <div class="combat-space">${kinds.map((kind, side) => {
      const d = demons[kind];
      const character = characters[kind];
      const pose = fighterPose(frame, side, result);
      const active = frame?.attacker === side;
      const move = reveal ? moves[result.moves[side]] : null;
      return `<div class="combatant side-${side} pose-${pose} ${active ? 'attacking' : ''} ${finished && result.winner === side ? 'champion' : ''}" style="--fighter-color:${d?.glow || '#bba7cd'};--sprite-hue:${character?.hue || 0}deg;--facing:${(side === 0 ? 1 : -1) * (character?.facing === 'left' ? -1 : 1)}">
        <div class="summon-circle"></div><div class="fighter-shadow"></div>
        ${d ? `<div class="fighter-motion"><div class="fighter-facing"><img class="fighter-sprite" draggable="false" src="${ASSET + characterArt(kind, pose)}" alt="${d.name} · ${pose}" width="320" height="320"></div></div>` : `<div class="awaiting-fighter">${icon('people', 48)}<span>AWAITING DEMON</span></div>`}
        <div class="move-seal ${move ? 'revealed' : ''}">${move ? icon(move.icon, 16) + move.name : side === 0 && moveLocked() ? icon('lock', 13) + moves[s.move].name + ' / SEALED' : s.duel?.phase === 2 ? icon('lock', 13) + 'SEALED' : s.duel?.phase === 1 ? icon('lock', 13) + 'HIDDEN' : d ? d.type : 'EMPTY STAKE'}</div>
        ${frame?.stage === 'strike' && !active ? `<div class="hit-number ${result.crits[frame.attacker] ? 'crit-number' : ''}"><small>${result.crits[frame.attacker] ? 'CRITICAL' : 'IMPACT'}</small>−${result.score[frame.attacker]}</div><div class="hit-flare"></div>` : ''}
      </div>`;
    }).join('')}</div>
    <canvas class="pit-particles" aria-hidden="true"></canvas>
    <div class="clash-fx ${reveal && frame?.stage === 'strike' ? 'move-' + result.moves[frame.attacker] : ''}" aria-hidden="true"></div>
    ${title ? `<div class="fight-callout ${finished ? 'final-callout ' + (result.winner === 0 ? 'win' : 'loss') : ''}" role="status"><small>${finished ? s.result ? 'OFFCHAIN PRACTICE' : 'CONFIRMED ON SOLANA' : 'ROUND 01'}</small><strong>${title}</strong>${finished ? '<span>WINNER TAKES BOTH</span>' : ''}</div>` : !moveLocked() ? '<div class="idle-versus" aria-hidden="true">VS</div>' : ''}
    <div class="arena-bottom"><span><i></i>${s.mode === 'practice' ? 'OFFCHAIN PRACTICE' : s.mode === 'landing' ? 'DUST DEMONS / ARENA' : 'SOLANA DEVNET'}</span><span class="arena-cue">${esc(cue)}</span><span>WINNER TAKES BOTH</span></div>
  </section>`;
}

function moveSelector() {
  const disabled = Boolean(s.busy || s.playing || moveLocked());
  return '<div class="move-grid">' + moves.map((move, i) =>
    '<button type="button" class="move ' + (s.move === i ? 'chosen' : '') + '" data-action="move:' + i + '"' + (disabled ? ' disabled' : '') + '><span class="move-icon">' + icon(move.icon, 23) +
    '</span><span><b>' + move.name + '</b><small>Beats ' + move.beats + '</small></span><kbd>' + (i + 1) + '</kbd></button>').join('') + '</div>';
}

function resultPanel() {
  const both = roundResult();
  const spectating = s.duel && !participant();
  const title = spectating ? (both.winner === 0 ? 'Player one wins' : 'Player two wins') :
    both.winner === 0 ? 'The pit is yours.' : 'The pit takes its due.';
  const line = both.moves.map((id, index) => '<span><b>' + moves[id].name + '</b> · ' + both.score[index] + ' DMG' +
    (both.crits[index] ? ' <em>CRIT</em>' : '') + '</span>').join('<small>VS</small>');
  const breakdown = both.moves.map((move, side) => '<div><b>' + (side ? 'OPPONENT' : 'PLAYER 01') + ' / ' + moves[move].name + '</b><span>2 base + ' +
    Number((move + 1) % 3 === both.moves[1 - side]) + ' advantage + ' + (both.crits[side] ? '2' : '0') + ' crit = <strong>' + both.score[side] + '</strong></span></div>').join('');
  const receipt = '<div class="proof-receipt"><div class="score-breakdown">' + breakdown + '</div><p>Each demon has a 25% crit chance: +2 clash power on a critical hit. Equal scores use ' + (s.result ? 'local randomness' : 'MagicBlock VRF') + ' to break the tie.</p>' + (s.result ? '<p>Practice uses local randomness. No blockchain transaction or card transfer.</p>' :
    '<div class="proof-explanation"><span><b>Settlement receipt</b><small>MagicBlock VRF chose crits and ties; the same transaction assigned both cards to the winner.</small></span>' +
    (proofLink(s.proof, 'View settlement proof') || '<span class="muted">Indexing Explorer proof…</span>') + '</div><a class="proof-link" href="' + addressExplorer(s.duel.key) + '" target="_blank" rel="noreferrer">Duel account: cards, winner & scores ' + icon('outside', 14) + '</a>') + '</div>';
  return '<div class="control has-result"><div class="result-copy"><span class="eyebrow">' + (s.result ? 'PRACTICE COMPLETE' : 'SETTLED ON SOLANA DEVNET') +
    '</span><h2>' + title + '</h2><div class="damage">' + line + '</div><p class="outcome-reason">' + fightReason(both, Boolean(s.result)) + '</p><p class="capture-receipt">' +
    (s.result ? 'Simulated capture: ' : spectating ? (both.winner === 0 ? 'Player one captured ' : 'Player two captured ') : both.winner === 0 ? 'You captured ' : 'You lost ') +
    '<b>' + (demons[fighterKinds()[1 - both.winner]]?.name || 'the opposing demon') + '</b>' + (s.result ? ' · no cards changed ownership.' : ' · ownership settled on devnet.') + '</p></div><div class="actions">' +
    (s.result && !s.returnToMap ? button('quick-duel', 'Play a real devnet duel', 'primary', 'blade') : '') +
    button('replay', 'Replay fight', 'text') + button(s.returnToMap ? 'return-map' : 'reset', s.returnToMap ? 'Return to map' : s.result ? 'Fight again' : 'Back to the pit', 'primary', 'arrow') + '</div>' + receipt + '</div>';
}

function controls() {
  if (s.playing) return '<div class="control cinematic-control"><div><span class="eyebrow">' + (s.result ? 'OFFCHAIN PRACTICE' : 'CONFIRMED RESULT · COMBAT REPLAY') + '</span><h2>The demons have spoken.</h2></div><button type="button" class="button secondary" data-action="skip">Skip animation ' + icon('arrow') + '</button></div>';
  if (s.result || s.duel?.phase === 3) return resultPanel();
  if (s.mode === 'landing') return '<div class="control intro"><div><span class="eyebrow">THE STAKES ARE REAL. THE SOL IS NOT.</span><h2>One demon in. Two demons out.</h2><p>Get a free starter pack and stake one demon against the bot. No wallet extension or real SOL.</p></div><div class="actions">' +
    button('quick-duel', 'Play a real devnet duel', 'primary', 'blade') + button('practice', 'Offchain tutorial', 'secondary', 'spark') +
    button('enter', 'Open devnet vault', 'text') + '</div></div>';
  if (s.mode === 'practice') return '<div class="control"><div class="control-title"><div><span class="eyebrow">OFFCHAIN PRACTICE · NO REAL STAKES</span><h2>' +
    (s.practiceCards.length ? 'Seal your move' : 'Summon your starter pack') + '</h2></div>' + button(s.returnToMap ? 'return-map' : 'leave', s.returnToMap ? 'Return to map' : 'Exit practice', 'text') + '</div>' +
    (s.practiceCards.length ? moveSelector() : '<p>Three sample demons. Try a full duel with no wallet or test SOL.</p>' +
    button('practice-pack', 'Open practice pack', 'primary', 'box')) + '</div>';
  if (s.duel?.phase === 4) return '<div class="control"><h2>Stake returned</h2><p>This duel ended without a winner. The cards went back to their owners.</p>' +
    button('reset', 'Back to the pit', 'secondary', 'arrow') + '</div>';
  if (s.duel?.phase === 2) return '<div class="control"><span class="eyebrow">03 / MAGICBLOCK VRF</span><h2>Rolling for critical hits…</h2><p>The oracle will settle both cards in one devnet transaction.</p>' +
    (participant() && Date.now() >= s.duel.deadline ? button('refund', 'Release both stakes', 'secondary') : '') + '</div>';
  if (s.duel?.phase === 1) {
    if (!participant()) return '<div class="control"><h2>Duel in progress</h2><p>Both players staked. Their moves stay hidden until reveal.</p></div>';
    return '<div class="control"><div class="control-title"><div><span class="eyebrow">02 / MAGICBLOCK PRIVATE ER</span><h2>' + (moveLocked() ? 'Your move is sealed.' : 'Seal your move') + '</h2></div>' +
      (moveLocked() ? button('resolve', 'Check for reveal', 'secondary', 'lock') : '') + '</div>' +
      (moveLocked() ? '<p>Only your wallet can read your move until both are locked.</p>' : moveSelector()) +
      (Date.now() >= s.duel.deadline ? button('refund', 'Release both stakes', 'secondary') : '') + '</div>';
  }
  if (s.busy && !s.duel && s.room) return '<div class="control"><h2>Finding the arena…</h2></div>';
  if (s.duel?.phase === 0 && keyed(s.duel.p1, client.key)) return '<div class="control"><div><span class="eyebrow">01 / ONCHAIN CARD ESCROW</span>' +
    (s.solo ? '<h2>Preparing the bot</h2><p>The bot will stake a card and privately seal its move.</p>' :
      '<h2>Waiting for a challenger</h2><p>Send the duel link; only the first opponent to stake can join.</p>') + '</div><div class="actions">' +
    button(s.solo ? 'bot-resume' : 'invite', s.solo ? 'Resume bot' : 'Copy invite', 'primary', s.solo ? 'spark' : 'copy') + button('refund', 'Cancel duel', 'secondary') + '</div></div>';
  if (s.quick && !s.room) return '<div class="control"><div><span class="eyebrow">SOLANA DEVNET / QUICK DUEL</span><h2>' +
    (s.busy ? 'Preparing your duel…' : 'Quick duel paused') + '</h2><p>' +
    (s.busy ? 'Setting up a guest wallet, starter cards and a bot opponent.' : 'Retry setup, open your vault, or play the offchain tutorial.') + '</p></div>' +
    (s.busy ? '' : '<div class="actions">' + button('quick-duel', 'Retry quick duel', 'primary') + button('enter', 'Open devnet vault') +
      button('practice', 'Offchain tutorial', 'text') + '</div>') + '</div>';
  const card = anyCard();
  if (!card) {
    return '<div class="control"><div><span class="eyebrow">01 / MAGICBLOCK VRF</span><h2>' + (s.packPending ? 'Starter pack is rolling…' : 'Summon your starter pack') + '</h2><p>' +
      (s.packPending ? 'Awaiting the verifiable randomness callback.' : 'Claim three random demons. The pack is free; devnet SOL covers transaction fees.') + '</p></div><div class="actions">' +
      button(s.balance !== null && s.balance < 0.008 && !s.packPending ? 'fund-pack' : 'pack', s.packPending ? 'Check pack' : s.balance !== null && s.balance < 0.008 ? 'Fund guest & open pack' : 'Open starter pack', 'primary', 'box') + '</div></div>';
  }
  return '<div class="control"><div><span class="eyebrow">01 / ONCHAIN CARD ESCROW</span><h2>' + (s.duel?.phase === 0 ? 'Match the stake' : 'Choose your challenger') +
    '</h2><p>' + (s.duel?.phase === 0 ? 'Pick a demon from your vault and join this duel.' : 'Select one card. The victor keeps both staked demons.') +
    '</p></div><div class="actions">' + (s.duel?.phase === 0 ? button('join', 'Stake & join', 'primary', 'blade') :
      button('bot', 'Duel the bot', 'primary', 'blade') + button('create', 'Invite a friend', 'secondary', 'people')) + '</div></div>';
}

function inventory() {
  const practice = s.mode === 'practice';
  const cards = practice ? s.practiceCards.map((kind, index) => ({ kind, key: index, lock: ZERO })) : s.owned;
  if (!cards.length) return '';
  return '<section class="inventory"><div class="vault-title"><span class="eyebrow">COLLECTION</span><h2>' + (practice ? 'Practice vault' : 'Your vault') +
    ' <span>' + cards.length + '</span></h2>' + proofLink(s.packProof, 'Starter pack proof') + '</div><div class="inventory-grid">' +
    cards.map((card) => {
      const d = demons[card.kind];
      const selected = practice ? s.practiceStake === card.kind : keyed(s.staked?.key || anyCard()?.key, card.key);
      return '<button type="button" class="vault-card' + (selected ? ' selected' : '') + '" data-action="select:' + (practice ? card.kind : card.key) + '"' +
        (s.busy || s.playing || s.result || !keyed(card.lock, ZERO) || s.duel?.phase === 1 || s.duel?.phase === 2 || s.duel?.phase === 3 ? ' disabled' : '') + ' aria-pressed="' + selected + '">' +
        '<div class="vault-art" style="--card-glow:' + d.glow + ';--card-hue:' + characters[card.kind].hue + 'deg"><img src="' + ASSET + characters[card.kind].portrait + '" alt=""></div><span><b>' +
        d.name + '</b><small>' + (keyed(card.lock, ZERO) ? d.type : 'STAKED') + '</small></span>' + (selected ? '<span class="picked">' + icon('hex', 13) + '</span>' : '') + '</button>';
    }).join('') + '</div></section>';
}

function capturedVault() {
  const result = roundResult();
  if (!result || !['spoils', 'finish'].includes(s.frame?.stage)) return '';
  const loser = 1 - result.winner;
  const card = loser ? s.opposing : s.staked;
  const kind = fighterKinds()[loser];
  const demon = demons[kind];
  const spectator = s.duel && !participant();
  const owner = spectator ? (result.winner ? 'PLAYER TWO' : 'PLAYER ONE') : result.winner ? 'PIT RIVAL' : 'YOUR';
  return `<section class="spoils-vault ${s.frame.stage === 'finish' ? 'landed' : ''}" aria-label="Winner's captured card"><div><span class="eyebrow">${s.result ? 'SIMULATED CAPTURE' : 'OWNED ON SOLANA DEVNET'}</span><h2>${owner} VAULT</h2><p>${demon?.name || 'Demon'} · ${s.result ? 'Practice only · no ownership change' : 'Confirmed winner takes both cards'}</p></div><div class="captured-slot" data-capture-target>${demon ? `<img src="${ASSET + characters[kind].portrait}" alt="${demon.name}">` : ''}${icon('box', 24)}</div>${s.result ? '' : '<div class="capture-links">' + (proofLink(s.proof, 'Ownership receipt') || '<span class="muted">Indexing proof…</span>') + (card ? '<a class="proof-link" href="' + addressExplorer(card.key) + '" target="_blank" rel="noreferrer">Captured card account ' + icon('outside', 14) + '</a>' : '') + '</div>'}</section>`;
}

function animateCapture() {
  const result = roundResult();
  const loser = 1 - result.winner;
  app.querySelector('.spoils-vault')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  const origin = app.querySelector('.combatant.side-' + loser)?.getBoundingClientRect();
  const target = app.querySelector('[data-capture-target]')?.getBoundingClientRect();
  const kind = fighterKinds()[loser];
  if (!origin || !target || !demons[kind]) return;
  const card = document.createElement('div');
  card.className = 'capture-card';
  card.style.setProperty('--capture-color', demons[kind].glow);
  card.innerHTML = `<img src="${ASSET + characters[kind].portrait}" alt=""><b>${demons[kind].name}</b><span>${s.result ? 'PRACTICE CAPTURE' : 'OWNERSHIP TRANSFERRED'}</span>`;
  document.body.append(card);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 1 : 1500;
  const from = `translate(${origin.x + origin.width / 2 - 50}px, ${origin.y + origin.height / 2 - 65}px) scale(.8)`;
  const center = `translate(${innerWidth / 2 - 50}px, ${Math.min(innerHeight - 180, origin.y + origin.height / 2 - 65)}px) scale(1.15)`;
  const to = `translate(${target.x + target.width / 2 - 50}px, ${target.y + target.height / 2 - 65}px) scale(.4)`;
  card.animate([{ transform: from, opacity: 0 }, { transform: center, opacity: 1, offset: .32 }, { transform: center, opacity: 1, offset: .6 }, { transform: to, opacity: 0 }], { duration, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.finally(() => card.remove());
}

function networkProgress() {
  if (!safeMode() || roundResult() || !(s.busy || s.duel?.phase === 2 || s.duel?.phase === 1 && moveLocked())) return '';
  s.waitSince ||= Date.now();
  const step = !s.duel || s.duel.phase === 0 ? 0 : s.duel.phase === 1 ? 1 : 2;
  return '<div class="network-progress"><div class="network-steps">' + ['STAKE', 'PRIVATE SEAL', 'VRF ORACLE', 'CAPTURE'].map((label, i) =>
    '<span class="' + (i < step ? 'done' : i === step ? 'current' : '') + '"><i>' + (i < step ? '✓' : '0' + (i + 1)) + '</i>' + label + '</span>').join('') +
    '</div><p><span>Waiting for devnet · <b data-elapsed>' + Math.floor((Date.now() - s.waitSince) / 1000) + 's</b></span><span data-delay-hint>Moves stay hidden. Combat starts after confirmation.</span></p></div>';
}

function modal() {
  if (!s.modal) return '';
  const fund = s.modal === 'wallet';
  return '<div class="overlay" data-dismiss><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button type="button" class="square close" data-action="close" aria-label="Close dialog">' +
    icon('cross') + '</button><span class="eyebrow">' + (fund ? 'ISOLATED DEVNET ACCOUNT' : 'THE PIT / FIELD GUIDE') + '</span><h2 id="dialog-title">' +
    (fund ? 'Guest wallet' : 'Know the stakes.') + '</h2>' + (fund ?
      '<p>This browser holds your guest key. Send devnet SOL only. Clearing browser storage will lose access to this wallet and its cards.</p>' +
      '<div class="wallet-address"><code>' + client.key + '</code><button type="button" class="square" data-action="copy-wallet" aria-label="Copy wallet address">' + icon('copy') + '</button></div>' +
      '<p>Balance: <strong>' + (s.balance === null ? 'checking…' : s.balance.toFixed(3) + ' devnet SOL') + '</strong>. Around 0.05 SOL is enough to get started.</p>' +
      ((s.busy || s.notice) ? '<p role="status">' + esc(s.busy || s.notice) + '</p>' : '') +
      '<div class="actions">' + button('faucet', 'Try quick airdrop', 'primary', 'spark') + '<a class="button secondary" href="https://faucet.solana.com" target="_blank" rel="noreferrer">Solana faucet ' + icon('outside', 15) + '</a>' + button('wallet-refresh', 'Refresh balance', 'text') + '</div>'
    :
      '<ol><li><b>Stake.</b> Open a free starter pack, then each player stakes one owned card.</li><li><b>Seal.</b> Rend beats Ward. Ward beats Hex. Hex beats Rend. The private rollup hides both moves until they are locked.</li><li><b>Settle.</b> Each move starts with 2 damage. Advantage adds 1; a 25% crit adds 2. VRF breaks ties; the winner gets both cards on devnet.</li></ol>' +
      '<p>Devnet cards have no monetary value. The practice mode uses no blockchain.</p>') + '</section></div>';
}

function draw() {
  if (s.mode !== 'landing') preloadFighters();
  const focus = document.activeElement?.dataset?.action;
  const hadDialog = Boolean(app.querySelector('[role=dialog]'));
  const kind = s.mode === 'practice' ? 'PRACTICE MODE' : 'SOLANA DEVNET';
  app.innerHTML = '<header><div class="nav"><button type="button" class="wordmark" data-action="home"><img src="' + ASSET + 'sigil.svg" alt=""><span>DEMON<span>DUELS</span></span></button><div class="nav-right">' +
    statusText(kind) + '<button type="button" class="square sound" data-action="sound" aria-label="' + (s.sound ? 'Mute sound' : 'Enable sound') + '">' +
    icon(s.sound ? 'volume' : 'mute') + '</button><button type="button" class="square help" data-action="rules" aria-label="Duel rules">' + icon('info') + '</button><button type="button" class="button wallet secondary" data-action="wallet" aria-label="Guest wallet and devnet funding">' +
    icon('wallet', 16) + '<span>' + (safeMode() ? short(client.key) : 'Guest wallet') + '</span></button></div></div></header>' +
    '<main><div class="hero"><div class="superline"><span></span> THE UNDERWORLD ARCADE <span></span></div><h1>NO MERCY. <em>JUST DEMONS.</em></h1><p>Stake a demon. Seal a move. <strong>Fight for both.</strong></p></div>' +
    battlefield() + controls() + networkProgress() + capturedVault() + '<div class="feedback" role="status" aria-live="polite">' + (s.busy ? '<i class="spinner"></i>' + esc(s.busy) : esc(s.notice)) + '</div>' + inventory() +
    '<div class="mechanics"><div>' + icon('lock') + '<span><b>PRIVATE MOVES</b><small>MagicBlock Private ER</small></span></div><div>' + icon('spark') +
    '<span><b>VERIFIABLE CRITS</b><small>MagicBlock VRF</small></span></div><div>' + icon('coin') +
    '<span><b>WINNER TAKES BOTH</b><small>Solana card ownership</small></span></div></div></main>' +
    '<footer><div><span>DEMON DUELS</span> <span>·</span> <span>MAGICBLOCK BLITZ V10</span></div><a href="' + addressExplorer(PROGRAM) +
    '" target="_blank" rel="noreferrer">Devnet program ' + icon('outside', 13) + '</a></footer>' + modal();
  if (s.modal && !hadDialog) app.querySelector('.modal .close')?.focus({ preventScroll: true });
  else if (focus) [...app.querySelectorAll('[data-action]')].find((element) => element.dataset.action === focus)?.focus({ preventScroll: true });
  effects.mount(app.querySelector('.pit-particles'));
  sound.setScene(s.playing || s.mode === 'practice' || s.duel?.phase === 1 || s.duel?.phase === 2 ? 'fight' : 'menu');
  if (roundResult() && !s.busy && s.playedId !== fightId()) {
    s.playedId = fightId();
    queueMicrotask(playFight);
  }
}

async function playFight() {
  const result = roundResult();
  if (!result) return;
  const sequence = ++s.sequence;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  s.playing = true;
  s.frame = { stage: 'reveal', attacks: 0 };
  draw();
  await preloadFighters();
  for (const frame of fightTimeline(result)) {
    if (sequence !== s.sequence) return;
    s.frame = frame;
    if (frame.sound && !(s.duel && !participant() && (frame.sound === 'victory' || frame.sound === 'defeat'))) audio(frame.sound);
    if (frame.stage === 'windup') audio(moves[result.moves[frame.attacker]].name.toLowerCase());
    if (frame.stage === 'finish' && !s.result && participant() && result.winner === 0) audio('transfer');
    draw();
    if (frame.stage === 'strike') effects.burst(frame.attacker, result.crits[frame.attacker], demons[fighterKinds()[frame.attacker]]?.glow || '#ffbd5c');
    if (frame.stage === 'spoils') animateCapture();
    await sleep(reduced ? Math.max(frame.duration, 1000) : frame.duration);
  }
  if (sequence !== s.sequence) return;
  s.playing = false;
  draw();
}

async function refreshWallet() {
  const [balance, owned, pack] = await Promise.all([client.balance(), client.inventory(), client.pack()]);
  s.balance = balance;
  s.owned = owned;
  s.packPending = Boolean(pack && !pack.opened);
  if (pack?.opened && !s.packProof) s.packProof = await proof(packKey(client.key), 'Starter pack opened:').catch(() => null);
}

async function refreshRoom() {
  if (!s.room) return;
  const previous = s.duel?.phase;
  s.duel = await readDuel(s.room);
  if (!s.duel) throw new Error('This duel link does not point to a live room.');
  const d = s.duel;
  const side = mySide();
  if (!s.staked || !s.opposing) {
    [s.staked, s.opposing] = await Promise.all([side ? d.card2 : d.card1, side ? d.card1 : d.card2]
      .map((key) => keyed(key, ZERO) ? null : readCard(key)));
  }
  if (d.phase === 3) {
    if (previous === undefined) { s.playedId = d.key.toString(); s.frame = { stage: 'finish', attacks: 2 }; }
    s.proof ||= await proof(d.key, 'Demon Duels: winner').catch(() => null);
    if (previous !== 3) {
      localStorage.removeItem(activeRoomKey);
      await refreshWallet().catch(() => {});
    }
    const detail = confirmedSettlement(d, client.key, s.opposing?.kind ?? null, s.proof);
    if (detail && !emittedSettlements.has(detail.duel)) {
      emittedSettlements.add(detail.duel);
      window.dispatchEvent(new CustomEvent('demon-duels:settled', { detail }));
    }
  }
}

async function run(label, action) {
  if (s.busy) return;
  s.busy = label;
  s.waitSince = Date.now();
  s.notice = '';
  draw();
  try { await action(); }
  catch (error) {
    const message = String(error?.message || error);
    s.notice = /insufficient|insufficientfunds|no record of a prior credit/i.test(message) ?
      'Not enough devnet SOL. Fund the guest wallet and retry.' :
      /program is not deployed|program account does not exist/i.test(message) ? 'The devnet program is not responding. Try again later.' :
      message.split('\n')[0].slice(0, 180);
  } finally { s.busy = null; s.waitSince = null; draw(); }
}

function setRoom(key) {
  document.querySelectorAll('.capture-card').forEach((card) => card.remove());
  s.sequence++;
  s.playing = false;
  s.frame = null;
  s.playedId = null;
  s.room = key;
  s.staked = null;
  s.opposing = null;
  s.proof = null;
  s.result = null;
  const url = new URL(location.href);
  if (key) {
    url.searchParams.set('room', key.toBase58());
    const saved = localStorage.getItem(moveKey());
    s.move = saved === null ? null : Number(saved);
  } else {
    url.searchParams.delete('room');
    s.duel = null;
    s.move = null;
  }
  history.replaceState(null, '', url);
}

function progress(label) {
  s.busy = label;
  draw();
}

async function prepareBot() {
  let generation = botGeneration(localStorage.getItem(BOT_GENERATION));
  let bot = botFor(generation);
  let pack = await bot.pack();
  let cards = pack?.opened ? (await bot.inventory()).filter((item) => keyed(item.lock, ZERO)) : [];
  if (pack?.opened && !cards.length) {
    generation += 1;
    bot = botFor(generation);
    localStorage.setItem(BOT_GENERATION, String(generation));
    pack = undefined;
  }
  let card = cards[0];
  if (await bot.balance() < 0.02) await client.transfer(bot.key, 0.03);
  if (!card) {
    await ensurePack(bot, pack);
    card = (await bot.inventory()).find((item) => keyed(item.lock, ZERO));
  }
  if (!card) throw new Error('The bot’s vault is not ready. Retry to prepare a card.');
  return { bot, card, generation };
}

export async function ensureBossCard(demonId) {
  let total = botGeneration(localStorage.getItem(BOSS_GENERATIONS));
  const packFunds = 0.008;
  const botFunds = 0.03;
  const stakeFunds = 0.006;
  const stakeable = (card, bot) => card && keyed(card.owner, bot.key) && keyed(card.lock, ZERO);
  const keys = (bot) => [0, 1, 2].map((i) => cardKey(bot.key, i));
  return stockBossCard(demonId, {
    async find(kind) {
      for (let end = total; end > 0; end -= 30) {
        const generations = Array.from({ length: Math.min(end, 30) }, (_, i) => end - 1 - i);
        const bots = generations.map(bossFor);
        const cards = await readCards(bots.flatMap(keys));
        const i = cards.findIndex((card, index) => card?.kind === kind && stakeable(card, bots[Math.floor(index / 3)]));
        if (i !== -1) {
          const index = Math.floor(i / 3);
          return { bot: bots[index], generation: generations[index], card: cards[i] };
        }
      }
      return null;
    },
    async mint() {
      if (await client.balance() < packFunds + botFunds + stakeFunds) return null;
      const generation = total;
      const bot = bossFor(generation);
      const pack = await bot.pack();
      if (!pack?.opened) {
        const topUp = packFunds - await bot.balance();
        if (topUp > 0) await client.transfer(bot.key, topUp);
      }
      localStorage.setItem(BOSS_GENERATIONS, String(++total));
      await ensurePack(bot, pack);
      const cards = (await readCards(keys(bot))).filter((card) => stakeable(card, bot));
      return { bot, generation, cards };
    },
    async fund(bot) {
      const topUp = botFunds - await bot.balance();
      if (await client.balance() < Math.max(0, topUp) + stakeFunds) {
        throw new Error('Fund the guest wallet to stake against this boss. Your card was not staked.');
      }
      if (topUp > 0) await client.transfer(bot.key, topUp);
    },
  });
}

function saveRoomBot(room, prepared) {
  localStorage.setItem(roomBotKey(room), JSON.stringify({
    generation: prepared.generation, demonId: prepared.demonId, card: prepared.card.key.toBase58(),
  }));
}

function loadRoomBot(room) {
  const raw = localStorage.getItem(roomBotKey(room));
  if (!raw) return null;
  const saved = raw.startsWith('{') ? JSON.parse(raw) : { generation: raw };
  const generation = botGeneration(saved.generation);
  return {
    bot: saved.demonId === undefined ? botFor(generation) : bossFor(generation),
    generation, demonId: saved.demonId, key: readKey(saved.card),
  };
}

async function readyBot(prepared) {
  await refreshRoom();
  const saved = loadRoomBot(s.room);
  let bot = prepared?.bot ?? saved?.bot;
  if (s.duel.phase === 0) {
    if (!prepared && saved?.key) {
      const card = await readCard(saved.key);
      if (!card || !keyed(card.owner, bot.key) || !keyed(card.lock, ZERO) ||
          (saved.demonId !== undefined && card.kind !== saved.demonId)) {
        throw new Error('The prepared card is no longer available. Cancel this duel and try again.');
      }
      prepared = { ...saved, card };
    }
    prepared ??= await prepareBot();
    bot = prepared.bot;
    saveRoomBot(s.room, prepared);
    await bot.joinDuel(s.duel, prepared.card.key);
    await refreshRoom();
  }
  if (s.duel.phase === 1) {
    bot ??= botFor(0);
    if (!keyed(s.duel.p2, bot.key)) return;
    await bot.delegate(s.duel);
    await bot.lock(s.duel, crypto.getRandomValues(new Uint8Array(1))[0] % 3);
  }
}

export async function startDuel(solo, demonId) {
  const card = anyCard();
  if (!card) throw new Error('Choose an unstaked demon first.');
  if (await client.balance() < (solo && demonId === undefined ? 0.037 : 0.006)) {
    s.modal = 'wallet';
    await refreshWallet();
    throw new Error('Fund this guest wallet with devnet SOL before staking.');
  }
  let prepared;
  if (solo) {
    progress(demonId === undefined ? 'Preparing a bot card before staking…' : 'Preparing the boss card before staking…');
    prepared = demonId === undefined ? await prepareBot() : await ensureBossCard(demonId);
  }
  s.solo = solo;
  const { duel } = await client.openDuel(card.key);
  audio('stake');
  setRoom(duel);
  localStorage.setItem(activeRoomKey, duel.toBase58());
  if (solo) {
    saveRoomBot(duel, prepared);
    localStorage.setItem('demon-duels:solo:' + duel, '1');
  }
  await refreshRoom();
  if (solo) {
    progress('The bot is staking and sealing its move…');
    await readyBot(prepared);
  }
  await refreshWallet();
}

function restoreRoom() {
  const saved = readKey(localStorage.getItem(activeRoomKey));
  if (!s.room && saved) {
    s.solo = localStorage.getItem('demon-duels:solo:' + saved) === '1';
    setRoom(saved);
  }
}

async function startQuickDuel() {
  if (s.mode === 'practice') setRoom(null);
  s.mode = 'chain';
  s.quick = true;
  s.result = null;
  s.move = null;
  await run('Checking your guest wallet…', async () => {
    restoreRoom();
    if (s.room) {
      await Promise.all([refreshRoom(), refreshWallet()]);
      if (s.duel.phase < 3) {
        if (s.solo && s.duel.phase === 0) await readyBot();
        return;
      }
      setRoom(null);
    }
    await prepareGuest(client, progress);
    await refreshWallet();
    if (!anyCard()) throw new Error('This guest vault has no unstaked cards.');
    await startDuel(true, s.requestedOpponent ?? undefined);
  });
}

async function resolveChain() {
  await refreshRoom();
  const duel = s.duel;
  if (!duel || duel.phase > 1) return;
  if (!((await readRound(duel.key))?.moves[0] < 3)) {
    try {
      await client.reveal(duel);
    } catch (error) {
      if (/move.*first|MoveMissing|Custom.*6006/i.test(String(error.message))) {
        s.notice = 'Your move is sealed. Waiting for your opponent.';
        return;
      }
      throw error;
    }
    s.busy = 'Committing the revealed round to Solana…';
    draw();
    await client.commit(duel);
    await until(async () => (await readRound(duel.key))?.moves[0] < 3, 60000, 1400);
  }
  s.busy = 'Requesting MagicBlock VRF…';
  draw();
  await refreshRoom();
  if (s.duel.phase === 1) await client.requestOutcome(s.duel);
  await refreshRoom();
}

async function action(name) {
  if (s.returnToMap && (name === 'home' || name === 'leave')) name = 'return-map';
  sound.unlock(s.sound);
  if (name === 'sound') {
    s.sound = !s.sound;
    sound.unlock(s.sound);
    localStorage.setItem('demon-duels:sound', s.sound ? 'on' : 'off');
    audio('seal'); draw(); return;
  }
  if (name === 'rules' || name === 'wallet' || name === 'close') {
    s.modal = name === 'close' ? null : name; draw();
    if (name === 'wallet') refreshWallet().then(draw).catch(() => {});
    return;
  }
  if (name === 'copy-wallet' || name === 'invite') {
    await run('Copying…', async () => {
      await navigator.clipboard.writeText(name === 'invite' ? location.href : client.key.toBase58());
      s.notice = name === 'invite' ? 'Invite link copied.' : 'Wallet address copied.';
    }); return;
  }
  if (name === 'skip' && s.playing) {
    document.querySelectorAll('.capture-card').forEach((card) => card.remove());
    s.sequence++; s.playing = false; s.frame = { stage: 'finish', attacks: 2 }; draw(); return;
  }
  if (s.busy || s.playing) return;
  if (name === 'return-map') {
    const detail = { result: roundResult(), mode: s.mode, opponentKind: s.requestedOpponent, duel: s.duel?.key?.toString() || null, proof: s.proof };
    setRoom(null); s.mode = 'landing'; s.returnToMap = false; s.requestedOpponent = null; draw();
    window.dispatchEvent(new CustomEvent('demon-duels:return', { detail }));
    return;
  }
  if (name === 'replay' && roundResult()) {
    s.playedId = null; s.frame = null; draw(); return;
  }
  if (name === 'home' || name === 'leave' || name === 'reset') {
    setRoom(null); s.mode = name === 'reset' ? s.mode : 'landing'; s.solo = false; s.quick = false; s.notice = '';
    if (s.mode === 'practice') s.practiceRival = (s.practiceRival + 1) % demons.length;
    draw(); return;
  }
  if (name === 'practice') {
    setRoom(null); s.mode = 'practice'; s.quick = false; s.notice = '';
    if (!s.practiceCards.length) { s.practiceCards = practicePack(); s.practiceStake = s.practiceCards[0]; }
    s.practiceRival = s.requestedOpponent ?? (s.practiceStake + 1) % demons.length;
    audio('seal'); draw(); return;
  }
  if (name === 'practice-pack') {
    s.practiceCards = practicePack(); s.practiceStake = s.practiceCards[0]; s.practiceRival = s.requestedOpponent ?? (s.practiceStake + 1) % demons.length;
    audio('seal'); draw(); return;
  }
  if (name === 'enter') {
    s.mode = 'chain';
    s.quick = false;
    await run('Loading your devnet vault…', async () => {
      restoreRoom();
      await Promise.all([refreshWallet(), refreshRoom()]);
    }); return;
  }
  if (name === 'quick-duel') { await startQuickDuel(); return; }
  if (name.startsWith('select:')) {
    if (s.mode === 'practice') s.practiceStake = Number(name.slice(7));
    else s.selected = readKey(name.slice(7));
    draw(); return;
  }
  if (name.startsWith('move:')) {
    const move = Number(name.slice(5));
    if (!moves[move] || moveLocked()) return;
    if (s.mode === 'practice') {
      await run('Revealing practice moves…', async () => {
        s.move = move; audio('seal'); draw();
        const random = crypto.getRandomValues(new Uint8Array(4));
        const opponent = random[3] % 3;
        await sleep(480);
        s.result = resolve(move, opponent, random); s.resultId++;
      }); return;
    }
    await run('Sealing your move on the Private ER…', async () => {
      await refreshRoom();
      if (!(await readRound(s.duel.key))?.moves.every((id) => id < 3)) {
        await client.delegate(s.duel);
        if (s.solo) await readyBot();
        await client.lock(s.duel, move);
      }
      s.move = move;
      localStorage.setItem(moveKey(), String(move));
      audio('seal'); await resolveChain();
    }); return;
  }
  if (name === 'pack') {
    await run('Opening a MagicBlock VRF starter pack…', async () => {
      if (await client.balance() < 0.008) {
        s.modal = 'wallet';
        await refreshWallet();
        throw new Error('Fund the guest wallet with devnet SOL for the free pack.');
      }
      await ensurePack(client); audio('seal'); await refreshWallet();
    }); return;
  }
  if (name === 'fund-pack') {
    await run('Funding the guest wallet with test SOL…', async () => {
      try { await client.faucet(); }
      catch { s.modal = 'wallet'; throw new Error('Quick airdrop unavailable. Use the Solana faucet, then open your starter pack.'); }
      await refreshWallet();
      s.busy = 'Summoning your three VRF demons…'; draw();
      await ensurePack(client); audio('seal'); await refreshWallet();
    }); return;
  }
  if (name === 'faucet') {
    await run('Requesting devnet SOL…', async () => {
      try { await client.faucet(); }
      catch { throw new Error('Quick airdrop unavailable. Copy the address and use the Solana faucet.'); }
      await refreshWallet(); s.notice = 'Guest wallet funded.';
    }); return;
  }
  if (name === 'wallet-refresh') { await run('Refreshing wallet…', refreshWallet); return; }
  if (name === 'bot' || name === 'create') {
    const solo = name === 'bot';
    await run(solo ? 'Staking a card on Solana…' : 'Creating your duel…',
      () => startDuel(solo, solo ? s.requestedOpponent ?? undefined : undefined));
    return;
  }
  if (name === 'bot-resume') { await run('Resuming the bot…', readyBot); return; }
  if (name === 'join') {
    await run('Staking your card and preparing the private arena…', async () => {
      if (!anyCard()) throw new Error('Choose an unstaked demon first.');
      await client.joinDuel(s.duel, anyCard().key);
      audio('stake');
      localStorage.setItem(activeRoomKey, s.room.toBase58());
      await refreshRoom(); await client.delegate(s.duel); await refreshWallet();
    }); return;
  }
  if (name === 'refund') {
    await run('Returning the stakes…', async () => {
      await client.refund(s.duel);
      localStorage.removeItem(activeRoomKey);
      await Promise.all([refreshRoom(), refreshWallet()]);
    }); return;
  }
  if (name === 'resolve') await run('Checking the sealed moves…', resolveChain);
}

// Campaign integration: launch a selected boss without coupling the arena to a map.
export function launchFight({ opponentKind, mode = 'practice', returnToMap = true } = {}) {
  if (s.busy || s.playing) return false;
  if (!Number.isInteger(opponentKind) || !demons[opponentKind] || !['practice', 'chain'].includes(mode)) return false;
  setRoom(null);
  s.requestedOpponent = opponentKind; s.returnToMap = returnToMap;
  s.notice = ''; s.solo = false;
  if (mode === 'practice') {
    s.mode = 'practice';
    if (!s.practiceCards.length) s.practiceCards = practicePack();
    s.practiceStake = s.practiceCards[0]; s.practiceRival = opponentKind;
    draw();
  } else startQuickDuel().catch(() => {});
  return true;
}
window.addEventListener('demon-duels:launch', (event) => launchFight(event.detail));

let ignorePointerUntil = 0;
app.addEventListener('click', (event) => {
  const element = event.target.closest('[data-action]');
  if (element) {
    if (event.detail && performance.now() < ignorePointerUntil) return;
    if (event.detail && element.dataset.action === 'reset') ignorePointerUntil = performance.now() + 500;
    action(element.dataset.action).catch(() => {});
  }
  else if (event.target.matches('[data-dismiss]')) { s.modal = null; draw(); }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && s.modal) { s.modal = null; draw(); return; }
  if (s.modal || event.repeat || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (/^[123]$/.test(event.key) && (s.mode === 'practice' && s.practiceCards.length || s.duel?.phase === 1 && participant())) {
    event.preventDefault(); action('move:' + (Number(event.key) - 1));
  }
});
draw();
if (s.room) {
  s.solo = localStorage.getItem('demon-duels:solo:' + s.room) === '1';
  setRoom(s.room);
  run('Opening the duel invite…', async () => { await Promise.all([refreshRoom(), refreshWallet()]); });
}
let polling = false;
setInterval(() => {
  const elapsed = app.querySelector('[data-elapsed]');
  if (!elapsed || !s.waitSince) return;
  const seconds = Math.floor((Date.now() - s.waitSince) / 1000);
  elapsed.textContent = seconds + 's';
  if (seconds >= 45) app.querySelector('[data-delay-hint]').textContent = 'Devnet is slow. Keep this tab open; check for reveal again if needed.';
}, 1000);
setInterval(async () => {
  if (!safeMode() || s.busy || polling || document.hidden) return;
  if (!s.room && !s.packPending) return;
  polling = true;
  try {
    const before = JSON.stringify([s.duel?.phase, s.proof, s.packPending]);
    if (s.room) await refreshRoom();
    if (s.packPending) await refreshWallet();
    if (before !== JSON.stringify([s.duel?.phase, s.proof, s.packPending])) draw();
  } catch { /* A transient devnet error does not interrupt play. */ }
  finally { polling = false; }
}, 4000);
