import './style.css';
import './finishers/style.css';
import { bossFinisher, matchesBossStake, previewFinisher, settlementCinematics } from './finishers/index.js';
import './arena.css';
import { PublicKey } from '@solana/web3.js';
import { ArenaClient, PROGRAM, ZERO, addressExplorer, cardKey, explorer, localKey, packKey, proof, readCard, readCards, readDuel, readRound, until, sleep } from './chain.js';
import { icon } from './icons.js';
import { botGeneration, ensurePack, prepareGuest, recoverGuestPack, stockBossCard } from './onboarding.js';
import { demons, moves, practicePack, resolve } from './rules.js';
import { characters } from './characters.js';
import { arenaCardSide, confirmedFight, confirmedSettlement, fightReason, privateMoveRetryMessage } from './fight.js';
import { mount as mountDuel } from './duel3d/index.js';
import { bossHeight } from './duel3d/fighter.js';
import { meleeTimeline } from './duel3d/timeline.js';
import './duel3d/style.css';
import { PitSound } from './sound.js';
import { circles, campaignKey, encounterKey, readCampaign, circleState, pitUnlocked, prepareBossWin, carryCampaign } from './campaign.js';
import { storyView, mapView, codexView, campaignResult } from './campaign-view.js';
import { startPresence } from './presence-live.js';
import { initialJourney, isAshGate } from './route.js';
import { profileFor, profileKey, savedProfile } from './ash-gate/encounter.js';
import { bossMove } from './world/bot-profile.js';
import { duelHud, installDialogKeys, movePicker } from './game-ui.js';
import './game-ui.css';
import './game-overlays.css';

const app = document.getElementById('app');
installDialogKeys(app);
const params = new URLSearchParams(location.search);
const ashGate = isAshGate(params);
const readKey = (value) => { try { return value ? new PublicKey(value) : null; } catch { return null; } };
const PLAYER_GENERATION = 'demon-duels:player-generation';
const playerFor = (generation, options) => {
  const key = localKey(generation ? 'player-' + generation : 'player', options);
  return key && new ArenaClient(key);
};
let playerGeneration = botGeneration(localStorage.getItem(PLAYER_GENERATION));
let client = playerFor(playerGeneration);
function assertCurrentGuest() {
  if (playerGeneration !== botGeneration(localStorage.getItem(PLAYER_GENERATION))) {
    throw new Error('Your guest wallet changed in another tab. Reload to continue with the current wallet.');
  }
}
const BOT_GENERATION = 'demon-duels:rival-generation';
const BOSS_GENERATIONS = 'demon-duels:boss-generations';
const activeRoomKey = 'demon-duels:active';
export const hasAshSeal = () => readCampaign(localStorage, client.key).wins.some((win) => win.bossId === 0);
const botFor = (generation) => new ArenaClient(localKey(generation ? 'rival-' + generation : 'rival'));
const bossFor = (generation) => new ArenaClient(localKey('boss-' + generation));
const roomBotKey = (room) => 'demon-duels:room-bot:' + room;
const ASSET = import.meta.env.BASE_URL + 'art/';
const sound = new PitSound(import.meta.env.BASE_URL + 'audio/');
export const setExploring = (active) => sound.unlock(!active && s.sound);
const emittedSettlements = new Set();
const s = {
  mode: params.has('room') ? 'chain' : 'landing',
  journey: initialJourney(params, localStorage.getItem('demon-duels:story-seen')),
  campaign: readCampaign(localStorage, client.key), circle: 0,
  balance: null, owned: [], selected: null, practiceCards: [], practiceStake: 0, practiceRival: 1,
  result: null, move: null, duel: null, busy: null, notice: '', modal: null, quick: false,
  sound: localStorage.getItem('demon-duels:sound') === 'on',
  room: readKey(params.get('room')), solo: false, opposing: null, proof: null, packProof: null, packPending: false, packOpened: false,
  playing: false, frame: null, playedId: null, sequence: 0, resultId: 0,
  waitSince: null,
  retrySeal: null,
  requestedOpponent: null, returnToMap: false,
};
s.circle = Math.min(s.campaign.wins.length, circles.length - 1);
const short = (key) => key?.toString().slice(0, 4) + '…' + key?.toString().slice(-4);
const keyed = (value, key) => Boolean(value && key && value.equals(key));
function clearSavedRoom(room) {
  if (localStorage.getItem(activeRoomKey) === room?.toString()) localStorage.removeItem(activeRoomKey);
}
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
const activeDuel = () => Boolean(s.room && (!s.duel || s.duel.phase < 3 && participant()));
const campaignBoss = () => s.mode === 'chain' && s.returnToMap && Number.isInteger(s.requestedOpponent) ? s.requestedOpponent : null;
const roomBoss = (room) => localStorage.getItem(encounterKey(room)) ?? String(savedProfile(localStorage, room)?.opponentKind ?? '');

function showMap() {
  localStorage.setItem('demon-duels:story-seen', '1');
  s.journey = 'map';
  s.circle = Math.min(s.campaign.wins.length, circles.length - 1);
  s.notice = '';
  draw();
}

function campaignPage() {
  if (s.journey === 'story') return storyView(button);
  if (s.journey === 'map') return mapView(s.campaign, s.circle, button, activeDuel() || Boolean(readKey(localStorage.getItem(activeRoomKey))));
  if (s.journey === 'codex') return codexView(s.campaign);
  return null;
}

function bossOutcome() {
  const boss = campaignBoss();
  if (ashGate || boss === null || s.duel?.phase !== 3 || !emittedSettlements.has(fightId()) || !participant() || s.playing || guardianFinisher.pending) return '';
  return campaignResult(boss, keyed(s.duel.winner, client.key), s.campaign, button);
}

const roundResult = () => s.result || (bossEncounter() && !emittedSettlements.has(fightId()) ? null : confirmedFight(s.duel, mySide()));
const fightId = () => s.result ? 'practice:' + s.resultId : s.duel?.key?.toString();
const bossEncounter = () => s.mode === 'chain' && s.solo && Number.isInteger(s.requestedOpponent) && participant();
const checkingBossSettlement = () => bossEncounter() && s.duel?.phase === 3 && !emittedSettlements.has(fightId());
function isBoundBossSettlement(detail, duel) {
  if (!bossEncounter() || !keyed(duel.p1, client.key)) return false;
  try {
    const saved = loadRoomBot(duel.key);
    const binding = saved && { kind: saved.demonId, player: saved.bot.key.toString(), card: saved.key?.toString() };
    return matchesBossStake(detail, s.requestedOpponent, fightId(), duel.p2.toString(), duel.card2.toString(), binding);
  } catch { return false; }
}
let liveSettlement;
let ashEncounter = null;
let hostingRival = false;
const finishers = settlementCinematics(window, (detail) => detail === liveSettlement, audio);
const guardianFinisher = bossFinisher(window, finishers, (campaign, duel) => {
  s.campaign = campaign;
  clearSavedRoom(duel);
});
const presentFinisher = () => guardianFinisher.play(guardianFinisher.pending?.duel ?? fightId());
const fighterKinds = () => [
  s.mode === 'practice' ? s.practiceStake : s.mode === 'landing' ? 0 : s.staked?.kind ?? anyCard()?.kind,
  s.mode === 'practice' ? s.practiceRival : s.mode === 'landing' ? 1 : s.opposing?.kind,
];

const arenaPhase = (frame) => frame?.stage === 'decision' ? 'crit' :
  frame?.stage === 'finish' && !s.playing ? 'return' :
    ['spoils', 'finish'].includes(frame?.stage) ? 'take' : frame ? 'clash' :
      s.duel?.phase === 2 ? 'crit' : moveLocked() || s.duel?.phase === 1 || (s.mode === 'practice' && s.practiceCards.length) ? 'seal' :
        s.duel ? 'faceoff' : 'stake';

function battlefield() {
  const result = roundResult();
  const frame = result ? s.frame : null;
  const taking = ['spoils', 'finish'].includes(frame?.stage);
  const phase = arenaPhase(frame);
  const title = taking ? (result.winner === 0 ? 'VICTORY' : 'DEFEAT') : frame?.label ||
    (frame?.stage === 'reveal' ? 'MOVES REVEALED' : frame?.stage === 'decision' ?
      (frame.tied ? s.result ? 'PRACTICE TIE-BREAK' : 'VRF TIE-BREAK' :
        s.result ? 'PRACTICE CRIT ROLL' : 'MAGICBLOCK VRF') : moveLocked() ? 'MOVE SEALED' : '');
  const [player, opponent] = fighterKinds().map((kind, side) => ({
    label: side ? (s.mode === 'practice' || s.solo || Number.isInteger(s.requestedOpponent) ? 'GUARDIAN' : 'CHALLENGER') :
      s.duel && s.duel.phase !== 0 && !participant() ? 'PLAYER ONE' : 'HUNTER',
    name: demons[kind]?.name || 'Awaiting stake',
    card: demons[kind]?.type,
    detail: frame ? moves[result.moves[side]].name + (frame.attacks > side ? ' / ' + result.score[side] + ' POWER' : '') :
      side === 0 && moveLocked() ? moves[s.move].name + ' / SEALED' : (phase === 'seal' || phase === 'crit') && s.mode !== 'practice' ? 'HIDDEN' : '',
    crit: ['decision', 'counter', 'spoils', 'finish'].includes(frame?.stage) && result.crits[side],
    winner: taking && result.winner === side,
  }));
  return `<section class="duel-scene" aria-label="3D melee arena" data-phase="${phase}" data-beat="${frame?.stage || 'guard'}">
    <div class="duel-viewport" data-duel-viewport></div>
    <div class="duel-overlay">
      ${duelHud({ player, opponent, phase })}
      <div class="duel-banner" role="status">${title ? `<strong>${title}</strong>` : ''}
        ${taking ? `<small>${s.result ? 'SIMULATED CAPTURE' : 'SETTLED ON SOLANA / WINNER TAKES BOTH'}</small>` :
          frame?.stage === 'decision' ? `<small>${result.score.join(' / ')} · ${result.crits.some(Boolean) ? 'CRITICAL HIT' : 'NO CRITICAL HITS'}</small>` : ''}
      </div>
      <span class="duel-mode">${s.mode === 'practice' ? 'OFFCHAIN PRACTICE' : 'SOLANA DEVNET'}</span>
    </div>
  </section>`;
}

let duelView, duel3DUnavailable = false, duelSceneOpen = false;
function syncDuelView() {
  const host = app.querySelector('[data-duel-viewport]');
  if (!host) {
    duelView?.dispose();
    duelView = null;
    return;
  }
  const result = roundResult();
  const fighters = fighterKinds().map((kind, side) => {
    if (kind === undefined && (side === 0 || !Number.isInteger(s.requestedOpponent))) return null;
    const id = kind ?? s.requestedOpponent;
    const guardian = side === 1 && (s.mode !== 'chain' || s.solo || Number.isInteger(s.requestedOpponent));
    return { role: guardian ? id : 'hunter', color: side === 0 ? '#d9b382' : demons[id]?.glow || '#bc99ff',
      size: guardian ? bossHeight(id) : 1.85 };
  });
  const onUnavailable = () => {
    duel3DUnavailable = true;
    duelView = null;
    const fallback = app.querySelector('.duel-no-webgl');
    if (fallback) { fallback.hidden = false; fallback.closest('.duel-screen').classList.add('duel-text-only'); }
  };
  const roundData = { fighters, result, frame: result ? s.frame : null, onUnavailable };
  if (duelView) { duelView.attach(host); duelView.update(roundData); }
  else if (duel3DUnavailable || !(duelView = mountDuel(host, roundData))) onUnavailable();
}

function moveSelector() {
  return movePicker({ selected: s.move, locked: moveLocked(), busy: Boolean(s.busy || s.playing) });
}

function resultPanel() {
  const both = roundResult();
  const spectating = s.duel && !participant();
  const title = s.result ? (both.winner === 0 ? 'Practice victory.' : 'A lesson from the Underworld.') :
    spectating ? (both.winner === 0 ? 'Player one wins' : 'Player two wins') :
    both.winner === 0 ? 'The pit is yours.' : 'The pit takes its due.';
  const line = both.moves.map((id, index) => '<span><b>' + moves[id].name + '</b> · ' + both.score[index] + ' DMG' +
    (both.crits[index] ? ' <em>CRIT</em>' : '') + '</span>').join('<small>VS</small>');
  return '<div class="control has-result"><div class="result-copy"><span class="eyebrow">' + (s.result ? 'PRACTICE COMPLETE' : 'SETTLED ON SOLANA DEVNET') +
    '</span><h2>' + title + '</h2><div class="damage">' + line + '</div></div><div class="actions">' +
    (s.result && !s.returnToMap ? button('quick-duel', 'Play a real devnet duel', 'primary', 'blade') : '') +
    button('replay', 'Replay fight', 'text') + button('duel-receipt', 'Details', 'text') +
    button(s.returnToMap ? 'return-map' : 'reset', s.returnToMap ? 'Return to map' : s.result ? 'Fight again' : 'Back to the pit', 'primary', 'arrow') + '</div></div>';
}

function resultReceipt(both) {
  const lostCard = both.winner === 0 ? s.opposing : s.staked;
  const breakdown = both.moves.map((move, side) => '<div><b>' + (side ? 'OPPONENT' : 'PLAYER 01') + ' / ' + moves[move].name + '</b><span>2 base + ' +
    Number((move + 1) % 3 === both.moves[1 - side]) + ' advantage + ' + (both.crits[side] ? '2' : '0') + ' crit = <strong>' + both.score[side] + '</strong></span></div>').join('');
  return '<div class="proof-receipt"><div class="score-breakdown">' + breakdown + '</div><p>' +
    fightReason(both, Boolean(s.result)) + '</p><p>Each demon has a 25% crit chance: +2 clash power on a critical hit. Equal scores use ' +
    (s.result ? 'local randomness' : 'MagicBlock VRF') + ' to break the tie.</p>' + (s.result ? '<p>Practice uses local randomness. No blockchain transaction or card transfer.</p>' :
    '<div class="proof-explanation"><span><b>Settlement receipt</b><small>MagicBlock VRF chose crits and ties; the same transaction assigned both cards to the winner.</small></span>' +
    (proofLink(s.proof, 'View settlement proof') || '<span class="muted">Indexing Explorer proof…</span>') + '</div><a class="proof-link" href="' + addressExplorer(s.duel.key) + '" target="_blank" rel="noreferrer">Duel account: cards, winner & scores ' + icon('outside', 14) + '</a>' +
    (lostCard ? '<br><a class="proof-link" href="' + addressExplorer(lostCard.key) + '" target="_blank" rel="noreferrer">Captured card account ' + icon('outside', 14) + '</a>' : '')) + '</div>' + bossOutcome();
}

function controls() {
  if (s.playing) return '<div class="control cinematic-control"><div><span class="eyebrow">' + (s.result ? 'OFFCHAIN PRACTICE' : 'CONFIRMED RESULT · COMBAT REPLAY') + '</span><h2>The demons have spoken.</h2></div><button type="button" class="button secondary" data-action="skip">Skip animation ' + icon('arrow') + '</button></div>';
  if (roundResult()) return resultPanel();
  if (s.duel?.phase === 3) return '<div class="control"><h2>Reading the settlement…</h2></div>';
  if (s.mode === 'landing') return '<div class="control intro"><div><span class="eyebrow">THE STAKES ARE REAL. THE SOL IS NOT.</span><h2>One demon in. Two demons out.</h2><p>Get a free starter pack and stake one demon against the bot. No wallet extension or real SOL.</p></div><div class="actions">' +
    button('quick-duel', 'Play a real devnet duel', 'primary', 'blade') + button('practice', 'Offchain tutorial', 'secondary', 'spark') +
    '<a class="button secondary" href="?world=3d">Enter Ash Gate (3D)</a>' +
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
      (moveLocked() ? '<p>Only your wallet can read your move until both are locked.</p>' : (s.retrySeal !== null
        ? button('move:' + s.retrySeal, 'Retry ' + moves[s.retrySeal].name, 'primary', 'lock') : moveSelector())) +
      (Date.now() >= s.duel.deadline ? button('refund', 'Release both stakes', 'secondary') : '') + '</div>';
  }
  if (s.busy && !s.duel && s.room) return '<div class="control"><h2>Finding the arena…</h2></div>';
  if (s.duel?.phase === 0 && keyed(s.duel.p1, client.key)) return '<div class="control"><div><span class="eyebrow">01 / ONCHAIN CARD ESCROW</span>' +
    (s.solo ? '<h2>Preparing the bot</h2><p>The bot will stake a card and privately seal its move.</p>' :
      '<h2>Waiting for a challenger</h2><p>Send the duel link; only the first opponent to stake can join.</p>') + '</div><div class="actions">' +
    button(s.solo ? 'bot-resume' : 'invite', s.solo ? 'Resume bot' : 'Copy invite', 'primary', s.solo ? 'spark' : 'copy') + button('refund', 'Cancel duel', 'secondary') + '</div></div>';
  if (s.packOpened && !s.owned.length && !s.busy) return '<div class="control"><div><span class="eyebrow">01 / MAGICBLOCK VRF</span><h2>Out of cards</h2>' +
    '<p>Open a fresh guest wallet with a free starter pack. Your previous wallet and campaign progress stay in this browser.</p></div><div class="actions">' +
    button('recover-guest', 'Get a fresh starter pack', 'primary', 'box') + '</div></div>';
  if (s.quick && !s.room) return '<div class="control"><div><span class="eyebrow">SOLANA DEVNET / QUICK DUEL</span><h2>' +
    (s.busy ? 'Preparing your duel…' : 'Quick duel paused') + '</h2><p>' +
    (s.busy ? 'Setting up a guest wallet, starter cards and a bot opponent.' : 'Retry setup, open your vault, or play the offchain tutorial.') + '</p></div>' +
    (s.busy ? '' : '<div class="actions">' + button('quick-duel', 'Retry quick duel', 'primary') + button('enter', 'Open devnet vault') +
      button('practice', 'Offchain tutorial', 'text') + '</div>') + '</div>';
  const card = anyCard();
  if (!card && s.owned.length) return '<div class="control"><div><h2>All demons are staked</h2><p>Finish or cancel your active duel to use your cards again.</p></div></div>';
  if (!card) {
    return '<div class="control"><div><span class="eyebrow">01 / MAGICBLOCK VRF</span><h2>' + (s.packPending ? 'Starter pack is rolling…' : 'Summon your starter pack') + '</h2><p>' +
      (s.packPending ? 'Awaiting the verifiable randomness callback.' : 'Claim three random demons. The pack is free; devnet SOL covers transaction fees.') + '</p></div><div class="actions">' +
      button(s.balance !== null && s.balance < 0.008 && !s.packPending ? 'fund-pack' : 'pack', s.packPending ? 'Retry starter pack' : s.balance !== null && s.balance < 0.008 ? 'Fund guest & open pack' : 'Open starter pack', 'primary', 'box') + '</div></div>';
  }
  return '<div class="control"><div><span class="eyebrow">01 / ONCHAIN CARD ESCROW</span><h2>' + (s.duel?.phase === 0 ? 'Match the stake' : 'Choose your challenger') +
    '</h2><p>' + (s.duel?.phase === 0 ? 'Pick a demon from your vault and join this duel.' : 'Select one card. The victor keeps both staked demons.') +
    '</p></div><div class="actions">' + (s.duel?.phase === 0 ? button('join', 'Stake & join', 'primary', 'blade') :
      (campaignBoss() !== null ? button('bot', 'Face ' + demons[campaignBoss()].name, 'primary', 'blade') :
        button('bot', 'Duel the bot', 'primary', 'blade') + button('create', 'Invite a friend', 'secondary', 'people'))) + '</div></div>';
}

function stakePicker() {
  if (s.playing || roundResult() || s.duel?.phase > 0 || s.staked) return '';
  const practice = s.mode === 'practice';
  const cards = practice ? s.practiceCards.map((kind) => ({ kind, key: kind })) :
    s.owned.filter((card) => keyed(card.lock, ZERO));
  const selected = practice ? s.practiceStake : anyCard()?.key?.toString();
  if (!cards.length) return '';
  return '<div class="duel-stakes" role="group" aria-label="Choose a demon card">' +
    (practice ? '' : proofLink(s.packProof, 'Starter pack proof')) + cards.map(({ key, kind }) =>
    '<button type="button" data-action="select:' + key + '" aria-pressed="' + (selected === (practice ? key : key.toString())) +
    '"' + (s.busy ? ' disabled' : '') + '>' + demons[kind].name + '</button>').join('') + '</div>';
}

function capturedVault() {
  const result = roundResult();
  if (!result || !['spoils', 'finish'].includes(s.frame?.stage)) return '';
  const loser = 1 - result.winner;
  const kind = fighterKinds()[loser];
  const demon = demons[kind];
  const spectator = s.duel && !participant();
  const owner = spectator ? (result.winner ? 'PLAYER TWO' : 'PLAYER ONE') : result.winner ? 'PIT RIVAL' : 'YOUR';
  return `<section class="spoils-vault ${s.frame.stage === 'finish' ? 'landed' : ''}" aria-label="Winner's captured card"><div><span class="eyebrow">${s.result ? 'SIMULATED CAPTURE' : 'OWNED ON SOLANA DEVNET'}</span><h2>${owner} VAULT</h2><p>${demon?.name || 'Demon'} · ${s.result ? 'Practice only · no ownership change' : 'Confirmed winner takes both cards'}</p></div><div class="captured-slot" data-capture-target>${demon ? `<img src="${ASSET + characters[kind].portrait}" alt="${demon.name}">` : ''}${icon('box', 24)}</div></section>`;
}

function animateCapture() {
  const result = roundResult();
  const loser = 1 - result.winner;
  const origin = duelView?.fighterPoint(loser);
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
  const from = `translate(${origin.x - 50}px, ${origin.y - 65}px) scale(.8)`;
  const center = `translate(${innerWidth / 2 - 50}px, ${Math.min(innerHeight - 180, origin.y - 65)}px) scale(1.15)`;
  const to = `translate(${target.x + target.width / 2 - 50}px, ${target.y + target.height / 2 - 65}px) scale(.4)`;
  card.animate([{ transform: from, opacity: 0 }, { transform: center, opacity: 1, offset: .32 }, { transform: center, opacity: 1, offset: .6 }, { transform: to, opacity: 0 }], { duration, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.then(() => card.remove(), () => card.remove());
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
  if (s.modal === 'duel-receipt') {
    const result = roundResult();
    return result ? '<div class="overlay" data-dismiss><section class="modal duel-receipt" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button type="button" class="square close" data-action="close" aria-label="Close dialog">' +
      icon('cross') + '</button><h2 id="dialog-title">Duel details</h2>' + resultReceipt(result) + '</section></div>' : '';
  }
  const fund = s.modal === 'wallet';
  return '<div class="overlay" data-dismiss><section class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button type="button" class="square close" data-action="close" aria-label="Close dialog">' +
    icon('cross') + '</button><span class="eyebrow">' + (fund ? 'ISOLATED DEVNET ACCOUNT' : 'THE PIT / FIELD GUIDE') + '</span><h2 id="dialog-title">' +
    (fund ? 'Guest wallet' : 'Know the stakes.') + '</h2>' + (fund ?
      '<p>This browser holds your guest key. Send devnet SOL only. Clearing browser storage will lose access to this wallet and its cards.</p>' +
      '<div class="wallet-address"><code>' + client.key + '</code><button type="button" class="square" data-action="copy-wallet" aria-label="Copy wallet address">' + icon('copy') + '</button></div>' +
      '<p>Balance: <strong>' + (s.balance === null ? 'checking…' : s.balance.toFixed(3) + ' devnet SOL') + '</strong>. Around 0.05 SOL is enough to get started.</p>' +
      ((s.busy || s.notice) ? '<p role="status">' + esc(s.busy || s.notice) + '</p>' : '') +
      '<div class="actions">' + button('faucet', 'Try quick airdrop', 'primary', 'spark') + '<a class="button secondary" href="https://faucet.solana.com" target="_blank" rel="noreferrer">Solana faucet ' + icon('outside', 15) + '</a>' + button('wallet-refresh', 'Refresh balance', 'text') +
      (playerGeneration > 0 ? button('recover-sol', 'Move SOL from previous guests', 'text') : '') + '</div>'
    :
      '<ol><li><b>Stake.</b> Open a free starter pack, then each player stakes one owned card.</li><li><b>Seal.</b> Rend beats Ward. Ward beats Hex. Hex beats Rend. The private rollup hides both moves until they are locked.</li><li><b>Settle.</b> Each move starts with 2 damage. Advantage adds 1; a 25% crit adds 2. VRF breaks ties; the winner gets both cards on devnet.</li></ol>' +
      '<p>Devnet cards have no monetary value. The practice mode uses no blockchain.</p>') + '</section></div>';
}

function feedback() {
  return '<div class="feedback" role="status" aria-live="polite">' +
    (s.busy ? '<i class="spinner"></i>' + esc(s.busy) : esc(s.notice)) + '</div>';
}

function duelScreen() {
  const vault = capturedVault();
  const intel = s.returnToMap && ashEncounter?.tells.length ?
    '<section class="control"><div><span class="eyebrow">' + esc(ashEncounter.grade.toUpperCase()) +
    ' / ASH GATE INTEL</span><ul>' + ashEncounter.tells.map((tell) => '<li>' + esc(tell) + '</li>').join('') + '</ul></div></section>' : '';
  return '<main class="duel-screen">' + battlefield() +
    '<nav class="duel-tools" aria-label="Duel options">' +
      (ashGate && s.returnToMap ? button('return-map', 'Return to Ash Gate', 'secondary', 'arrow') :
        button('map', 'Map', 'secondary', 'arrow')) +
      '<button type="button" class="button secondary" data-action="sound" aria-label="' + (s.sound ? 'Mute sound' : 'Enable sound') + '">' +
      icon(s.sound ? 'volume' : 'mute', 16) + '</button>' +
      button('rules', 'Rules', 'secondary') +
      (safeMode() ? button('wallet', 'Wallet', 'secondary', 'wallet') : '') +
    '</nav><p class="duel-no-webgl" hidden>3D combat is unavailable. You can still play and see the duel result.</p>' +
    '<div class="duel-panels' + (vault ? ' is-result' : '') + '">' + feedback() + stakePicker() + controls() +
      (vault ? '' : intel) + networkProgress() + vault + '</div></main>';
}

let dialogReturnAction;
function draw() {
  const page = campaignPage();
  const fallbackScroll = app.querySelector('.duel-text-only')?.scrollTop;
  const focus = document.activeElement?.dataset?.action;
  const hadDialog = Boolean(app.querySelector('[role=dialog]'));
  const kind = s.mode === 'practice' ? 'PRACTICE MODE' : 'SOLANA DEVNET';
  app.dataset.screen = s.journey === 'story' ? 'prologue' : s.journey === 'arena' ? 'arena' : 'campaign';
  app.innerHTML = (page === null ? duelScreen() :
    '<header><div class="nav"><button type="button" class="wordmark" data-action="home"><img src="' + ASSET + 'sigil.svg" alt=""><span>DEMON<span>DUELS</span></span></button><div class="nav-right">' +
    statusText(kind) + '<button type="button" class="square sound" data-action="sound" aria-label="' + (s.sound ? 'Mute sound' : 'Enable sound') + '">' +
    icon(s.sound ? 'volume' : 'mute') + '</button><button type="button" class="square help" data-action="rules" aria-label="Duel rules">' + icon('info') + '</button><button type="button" class="button wallet secondary" data-action="wallet" aria-label="Guest wallet and devnet funding">' +
    icon('wallet', 16) + '<span>' + (safeMode() ? short(client.key) : 'Guest wallet') + '</span></button></div></div></header>' +
    '<main>' + page + feedback() +
    '<div class="mechanics"><div>' + icon('lock') + '<span><b>PRIVATE MOVES</b><small>MagicBlock Private ER</small></span></div><div>' + icon('spark') +
    '<span><b>VERIFIABLE CRITS</b><small>MagicBlock VRF</small></span></div><div>' + icon('coin') +
    '<span><b>WINNER TAKES BOTH</b><small>Solana card ownership</small></span></div></div></main>' +
    '<footer><div><span>DEMON DUELS</span> <span>·</span> <span>MAGICBLOCK BLITZ V10</span></div><a href="' + addressExplorer(PROGRAM) +
    '" target="_blank" rel="noreferrer">Devnet program ' + icon('outside', 13) + '</a></footer>') + modal();
  if (s.modal && !hadDialog) {
    dialogReturnAction = focus;
    app.querySelector('.modal .close')?.focus({ preventScroll: true });
  } else if (!s.modal && hadDialog) {
    [...app.querySelectorAll('[data-action]')].find((element) => element.dataset.action === dialogReturnAction)?.focus({ preventScroll: true });
  } else if (focus) {
    const previous = [...app.querySelectorAll('[data-action]')].find((element) => element.dataset.action === focus && !element.disabled);
    (previous || (s.modal ? app.querySelector('.modal .close') : null))?.focus({ preventScroll: true });
  }
  syncDuelView();
  if (fallbackScroll) {
    const fallback = app.querySelector('.duel-text-only');
    if (fallback) fallback.scrollTop = fallbackScroll;
  }
  const sceneOpen = Boolean(app.querySelector('.duel-screen'));
  if (sceneOpen !== duelSceneOpen) {
    duelSceneOpen = sceneOpen;
    window.dispatchEvent(new CustomEvent(sceneOpen ? 'demon-duels:duel3d-open' : 'demon-duels:duel3d-close'));
  }
  sound.setScene(s.playing || s.mode === 'practice' || s.duel?.phase === 1 || s.duel?.phase === 2 ? 'fight' : 'menu');
  if (s.journey === 'arena' && roundResult() && !s.busy && s.playedId !== fightId()) {
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
  if (!duelView) {
    await guardianFinisher.play(fightId());
    if (sequence !== s.sequence) return;
    s.playing = false; s.frame = { stage: 'finish', attacks: 2 }; draw(); return;
  }
  for (const frame of meleeTimeline(result)) {
    if (sequence !== s.sequence) return;
    s.frame = frame;
    if (frame.sound && !(s.duel && !participant() && (frame.sound === 'victory' || frame.sound === 'defeat'))) audio(frame.sound);
    if (frame.stage === 'finish' && !s.result && participant() && result.winner === 0) audio('transfer');
    draw();
    if (frame.stage === 'counter') audio('strike');
    if (frame.stage === 'spoils') animateCapture();
    await sleep(reduced ? Math.min(frame.duration, 1150) : frame.duration);
  }
  if (sequence !== s.sequence) return;
  await guardianFinisher.play(fightId());
  if (sequence !== s.sequence) return;
  s.playing = false;
  draw();
}

async function refreshWallet() {
  const owner = client;
  const [balance, owned, pack] = await Promise.all([owner.balance(), owner.inventory(), owner.pack()]);
  if (owner !== client) return;
  s.balance = balance;
  s.owned = owned;
  s.packOpened = Boolean(pack?.opened);
  s.packPending = Boolean(pack && !pack.opened);
  if (pack?.opened && !s.packProof) {
    const packProof = await proof(packKey(owner.key), 'Starter pack opened:').catch(() => null);
    if (owner === client) s.packProof = packProof;
  }
}

async function refreshRoom() {
  const room = s.room;
  const owner = client;
  if (!room) return;
  const previous = s.duel?.phase;
  const d = await readDuel(room);
  if (room !== s.room || owner !== client) return;
  if (!d) throw new Error('This duel link does not point to a live room.');
  s.duel = d;
  const side = arenaCardSide(d, client.key);
  if (!s.staked || !s.opposing) {
    const cards = await Promise.all([side ? d.card2 : d.card1, side ? d.card1 : d.card2]
      .map((key) => keyed(key, ZERO) ? null : readCard(key)));
    if (room !== s.room || owner !== client) return;
    [s.staked, s.opposing] = cards;
  }
  if (d.phase === 3) {
    if (previous === undefined) { s.playedId = d.key.toString(); s.frame = { stage: 'finish', attacks: 2 }; }
    const settlement = s.proof || await proof(d.key, 'Demon Duels: winner').catch(() => null);
    if (room !== s.room || owner !== client) return;
    s.proof = settlement;
    if (previous !== 3) {
      await refreshWallet().catch(() => {});
      if (room !== s.room || owner !== client) return;
    }
    const settled = confirmedSettlement(d, client.key, s.opposing?.kind ?? null, s.proof);
    const detail = settled && !s.solo ? { ...settled, mode: 'pvp' } : settled;
    if (detail && !emittedSettlements.has(detail.duel)) {
      emittedSettlements.add(detail.duel);
      const boundBoss = isBoundBossSettlement(detail, d);
      const profile = boundBoss ? savedProfile(localStorage, room) : null;
      if (boundBoss) detail.bossBound = true;
      if (boundBoss && detail.won && roomBoss(room) === String(detail.opponentKind)) {
        const commit = prepareBossWin(localStorage, owner.key, {
          bossId: detail.opponentKind, phase: d.phase, player: detail.player, winner: detail.winner,
          opponent: d.p2.toString(), bot: loadRoomBot(room).bot.key.toString(), opposingKind: detail.opponentKind,
          duel: detail.duel, mode: detail.mode,
        });
        if (commit) guardianFinisher.queue(detail, profile?.grade ?? 'shadow', commit);
      }
      if (boundBoss && (guardianFinisher.pending === detail || !detail.won && previous !== undefined)) {
        liveSettlement = detail;
      }
      try { window.dispatchEvent(new CustomEvent('demon-duels:settled', { detail })); }
      finally { liveSettlement = undefined; }
      if (guardianFinisher.pending === detail && s.journey !== 'arena') await presentFinisher();
      else if (previous === undefined && finishers.has(detail.duel)) {
        s.playedId = null; s.frame = null;
      }
    }
    if (guardianFinisher.pending?.duel !== room.toString()) clearSavedRoom(room);
  }
  if (d.phase === 4) clearSavedRoom(room);
}

async function run(label, action, recoveryMessage) {
  if (s.busy) return;
  s.busy = label;
  s.waitSince = Date.now();
  s.notice = '';
  draw();
  try { assertCurrentGuest(); await action(); }
  catch (error) {
    const message = String(error?.message || error);
    s.notice = recoveryMessage?.(error) ?? (/insufficient|insufficientfunds|no record of a prior credit/i.test(message) ?
      'Not enough devnet SOL. Fund the guest wallet and retry.' :
      /program is not deployed|program account does not exist/i.test(message) ? 'The devnet program is not responding. Try again later.' :
      message.split('\n')[0].slice(0, 180));
  } finally { s.busy = null; s.waitSince = null; draw(); }
}

function setRoom(key) {
  guardianFinisher.roomChanged();
  document.querySelectorAll('.capture-card').forEach((card) => card.remove());
  s.sequence++;
  s.playing = false;
  s.frame = null;
  s.playedId = null;
  s.room = key;
  s.duel = null;
  s.staked = null;
  s.opposing = null;
  s.proof = null;
  s.result = null;
  s.retrySeal = null;
  const url = new URL(location.href);
  if (key) {
    const savedBoss = roomBoss(key);
    if (savedBoss !== '' && circles[Number(savedBoss)]) {
      s.requestedOpponent = Number(savedBoss);
      s.returnToMap = true;
    } else {
      s.requestedOpponent = null;
      s.returnToMap = false;
    }
    url.searchParams.set('room', key.toBase58());
    const saved = localStorage.getItem(moveKey());
    s.move = saved === null ? null : Number(saved);
  } else {
    url.searchParams.delete('room');
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
    const profile = savedProfile(localStorage, s.duel.key);
    const roll = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    await bot.lock(s.duel, bossMove(profile?.opponentKind, profile?.grade, roll));
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
  assertCurrentGuest();
  s.solo = solo;
  const { duel } = await client.openDuel(card.key);
  audio('stake');
  if (solo && demonId === campaignBoss()) localStorage.setItem(encounterKey(duel), String(demonId));
  setRoom(duel);
  localStorage.setItem(activeRoomKey, duel.toBase58());
  if (solo && ashEncounter && ashEncounter.opponentKind === demonId) localStorage.setItem(profileKey(duel), JSON.stringify(ashEncounter));
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
    s.mode = 'chain';
    setRoom(saved);
    const profile = s.solo && savedProfile(localStorage, saved);
    if (profile) { ashEncounter = profile; s.requestedOpponent = profile.opponentKind; s.returnToMap = true; }
  }
}

export async function recoverGuestCards() {
  let recovered = false;
  await run('Checking whether your guest needs new cards…', async () => {
    const savedRoom = localStorage.getItem(activeRoomKey);
    const saved = readKey(savedRoom);
    for (const key of [saved, s.room]) {
      if (!key) continue;
      const duel = await readDuel(key);
      if (duel?.phase < 3 && [duel.p1, duel.p2].some((owner) => keyed(owner, client.key))) {
        throw new Error('Finish or cancel your active duel before replacing your guest wallet.');
      }
    }
    s.mode = 'chain';
    s.quick = false;
    try {
      recovered = await recoverGuestPack(client, {
        progress,
        replace() {
          assertCurrentGuest();
          if (localStorage.getItem(activeRoomKey) !== savedRoom) {
            throw new Error('Your saved duel changed in another tab. Open your vault again before refilling.');
          }
          const next = playerGeneration + 1;
          const replacement = playerFor(next);
          // Save before switching keys, even if funding or VRF later fails.
          s.campaign = carryCampaign(localStorage, client.key, replacement.key);
          localStorage.setItem(PLAYER_GENERATION, String(next));
          playerGeneration = next;
          client = replacement;
          if (s.duel?.phase >= 3) setRoom(null);
          s.balance = null;
          s.owned = [];
          s.selected = null;
          s.packProof = null;
          s.packOpened = false;
          s.packPending = false;
          return replacement;
        },
      });
      if (recovered) {
        if (s.duel?.phase >= 3) setRoom(null);
        s.notice = 'Your new demons are ready.';
      }
    } catch (error) {
      s.modal = 'wallet';
      throw error;
    } finally {
      await refreshWallet().catch(() => {});
    }
    recovered = Boolean(anyCard());
  });
  return recovered;
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
        if (ashGate && s.requestedOpponent !== null && (!s.solo || loadRoomBot(s.room)?.demonId !== s.requestedOpponent)) {
          setRoom(null);
          throw new Error('You have another open duel. Finish or cancel it from the arena before striking the Warden.');
        }
        if (s.solo && s.duel.phase === 0) await readyBot();
        return;
      }
      if (guardianFinisher.pending?.duel === s.room.toString()) return;
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
  sound.unlock(s.sound);
  if (name === 'sound') {
    s.sound = !s.sound;
    sound.unlock(s.sound);
    window.dispatchEvent(new CustomEvent('demon-duels:mute', { detail: { enabled: s.sound } }));
    audio('seal'); draw(); return;
  }
  if (name === 'rules' || name === 'wallet' || name === 'close' || (name === 'duel-receipt' && !s.playing && roundResult())) {
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
    const sequence = ++s.sequence;
    await guardianFinisher.play(fightId());
    if (sequence !== s.sequence) return;
    s.playing = false; s.frame = { stage: 'finish', attacks: 2 }; draw(); return;
  }
  if (s.busy || s.playing) return;
  if (name === 'begin') {
    localStorage.setItem('demon-duels:story-seen', '1'); showMap(); return;
  }
  if (name === 'home' || name === 'map' || name === 'leave') { showMap(); return; }
  if (name === 'codex') { s.journey = 'codex'; s.notice = ''; draw(); return; }
  if (name.startsWith('circle:')) {
    const id = Number(name.slice(7));
    if (Number.isInteger(id) && circles[id]) { s.circle = id; draw(); }
    return;
  }
  if (name === 'resume') {
    s.journey = 'arena'; s.mode = 'chain';
    await run('Resuming your saved duel…', async () => {
      const saved = readKey(localStorage.getItem(activeRoomKey));
      if (!activeDuel() && saved && !keyed(s.room, saved)) { setRoom(null); restoreRoom(); }
      await Promise.all([refreshRoom(), refreshWallet()]);
    }); return;
  }
  if (name === 'pit') {
    s.modal = null;
    if (!pitUnlocked(s.campaign)) { showMap(); s.notice = 'Defeat all six guardians to unlock the open pit.'; draw(); return; }
    if (activeDuel()) { s.journey = 'arena'; s.mode = 'chain'; draw(); return; }
    setRoom(null); s.requestedOpponent = null; s.returnToMap = false; s.journey = 'arena';
    await action('enter'); return;
  }
  if (name.startsWith('boss:')) {
    const id = Number(name.slice(5));
    if (!Number.isInteger(id) || !circles[id] || circleState(s.campaign, id) === 'locked') return;
    window.dispatchEvent(new CustomEvent('demon-duels:launch', { detail: { opponentKind: id, mode: 'chain', returnToMap: true } }));
    return;
  }
  if (name === 'campaign-return') {
    s.modal = null;
    if (guardianFinisher.pending) await presentFinisher();
    if (activeDuel() || checkingBossSettlement()) { showMap(); return; }
    setRoom(null); s.requestedOpponent = null; s.returnToMap = false;
    showMap(); return;
  }
  if (name === 'return-map') {
    if (guardianFinisher.pending) await presentFinisher();
    const savedAsh = s.room && savedProfile(localStorage, s.room);
    const detail = { result: roundResult(), mode: s.mode, opponentKind: s.requestedOpponent, duel: s.duel?.key?.toString() || null, proof: s.proof };
    if (activeDuel() || checkingBossSettlement()) {
      showMap();
      if (!ashGate) return;
    } else {
      setRoom(null); s.mode = 'landing'; s.returnToMap = false; s.requestedOpponent = null;
      ashEncounter = null;
      showMap();
    }
    window.dispatchEvent(new CustomEvent('demon-duels:return', { detail }));
    if (!ashGate && savedAsh) location.href = '?world=3d';
    return;
  }
  if (name === 'replay' && roundResult()) {
    s.playedId = null; s.frame = null; draw(); return;
  }
  if (name === 'reset' && campaignBoss() !== null) { await action('campaign-return'); return; }
  if (name === 'reset') {
    setRoom(null); s.mode = name === 'reset' ? s.mode : 'landing'; s.solo = false; s.quick = false; s.notice = '';
    if (s.mode === 'practice') s.practiceRival = (s.practiceRival + 1) % demons.length;
    draw(); return;
  }
  if (name === 'practice') {
    if (activeDuel()) { s.journey = 'arena'; s.mode = 'chain'; draw(); return; }
    s.journey = 'arena'; s.returnToMap = true; s.requestedOpponent = null;
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
    s.journey = 'arena';
    s.mode = 'chain';
    s.quick = false;
    await run('Loading your devnet vault…', async () => {
      restoreRoom();
      await Promise.all([refreshWallet(), refreshRoom()]);
    }); return;
  }
  if (name === 'quick-duel') { await startQuickDuel(); return; }
  if (name === 'recover-guest') { await recoverGuestCards(); return; }
  if (name.startsWith('select:')) {
    if (s.mode === 'practice') s.practiceStake = Number(name.slice(7));
    else s.selected = readKey(name.slice(7));
    draw(); return;
  }
  if (name.startsWith('move:')) {
    const move = Number(name.slice(5));
    if (!moves[move] || moveLocked() || (s.retrySeal !== null && s.retrySeal !== move)) return;
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
      if (!navigator.onLine) throw new Error('Offline');
      await refreshRoom();
      const duel = s.duel;
      if (duel?.phase !== 1 || !participant()) return;
      const round = await readRound(duel.key);
      let choice = round?.moves[mySide()];
      if (!(choice < 3)) {
        await client.delegate(duel);
        if (s.solo) await readyBot();
        const signature = await client.lock(duel, move);
        choice = signature ? move : await client.pick(duel);
        if (!(choice >= 0 && choice < 3) || choice === null) throw new Error('The network is still processing. Retry to resume.');
      }
      s.move = choice;
      s.retrySeal = null;
      localStorage.setItem(moveKey(), String(choice));
      audio('seal'); await resolveChain();
    }, (error) => {
      const message = privateMoveRetryMessage(error, { online: navigator.onLine, sealed: moveLocked() });
      s.retrySeal = message && !moveLocked() ? move : null;
      return message;
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
  if (name === 'recover-sol') {
    await run('Checking previous guest balances…', async () => {
      let moved = 0;
      try {
        for (let generation = playerGeneration - 1; generation >= 0; generation--) {
          assertCurrentGuest();
          const previous = playerFor(generation, { create: false });
          if (await previous?.moveRemainingSol(client.key)) moved++;
        }
        s.notice = moved ? 'Previous guest devnet SOL moved here.' : 'No previous guest balance can cover a transfer fee.';
      } finally {
        await refreshWallet().catch(() => {});
      }
    }); return;
  }
  if (name === 'bot' || name === 'create') {
    const solo = name === 'bot';
    await run(solo ? 'Staking a card on Solana…' : 'Creating your duel…',
      () => startDuel(solo, solo ? campaignBoss() ?? undefined : undefined));
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
      clearSavedRoom(s.room);
      await Promise.all([refreshRoom(), refreshWallet()]);
    }); return;
  }
  if (name === 'resolve') await run('Checking the sealed moves…', resolveChain,
    (error) => privateMoveRetryMessage(error, { online: navigator.onLine, sealed: true }));
}

// Campaign integration: launch a selected boss without coupling the arena to a map.
export function launchFight({ opponentKind, mode = 'practice', returnToMap = true, room, join = false, grade, tells } = {}) {
  if (s.busy || s.playing || hostingRival || guardianFinisher.pending) return false;
  if (mode === 'pvp') return launchRivalDuel(readKey(room), join, returnToMap);
  if (!Number.isInteger(opponentKind) || !demons[opponentKind] || !['practice', 'chain'].includes(mode)) return false;
  const hunt = ashGate ? profileFor({ mode, opponentKind, grade, tells }) : null;
  if (activeDuel()) {
    if (mode === 'chain' && roomBoss(s.room) === String(opponentKind)) {
      s.journey = 'arena'; s.mode = 'chain';
      if (hunt) startQuickDuel().catch(() => {});
      else draw();
      return true;
    }
    s.notice = 'Finish or cancel your current duel before challenging another guardian.'; draw(); return false;
  }
  const saved = readKey(localStorage.getItem(activeRoomKey));
  if (mode === 'chain' && saved && roomBoss(saved) !== String(opponentKind)) {
    s.notice = 'Resume or finish your saved duel before challenging this guardian.'; draw(); return false;
  }
  if (mode === 'chain' && circleState(s.campaign, opponentKind) === 'locked') return false;
  s.journey = 'arena';
  setRoom(null);
  ashEncounter = hunt;
  s.requestedOpponent = opponentKind; s.returnToMap = returnToMap;
  s.notice = ''; s.solo = false;
  if (mode === 'practice') {
    s.mode = 'practice';
    if (!s.practiceCards.length) s.practiceCards = practicePack();
    s.practiceStake = s.practiceCards[0]; s.practiceRival = opponentKind;
    draw();
  } else if (hunt) startQuickDuel().catch(() => {});
  else {
    s.mode = 'chain'; s.quick = false;
    run('Preparing your guardian encounter…', async () => {
      restoreRoom();
      if (s.room) { await Promise.all([refreshRoom(), refreshWallet()]); return; }
      await prepareGuest(client, progress);
      await refreshWallet();
    }).catch(() => {});
  }
  return true;
}
window.addEventListener('demon-duels:launch', (event) => {
  if (!launchFight(event.detail)) event.preventDefault();
});
window.addEventListener('demon-duels:return', showMap);
window.addEventListener('storage', (event) => {
  if (event.key !== campaignKey(client.key)) return;
  s.campaign = readCampaign(localStorage, client.key);
  draw();
});

// Live hunters: a challenge accepted in the world becomes an ordinary open/join PvP duel.
function launchRivalDuel(room, join, returnToMap) {
  if (!room) return false;
  const saved = readKey(localStorage.getItem(activeRoomKey));
  if ((activeDuel() && !keyed(s.room, room)) || (saved && !keyed(saved, room))) {
    s.notice = 'Resume or finish your saved duel before opening another hunter duel.';
    draw(); return false;
  }
  ashEncounter = null;
  setRoom(room);
  s.journey = 'arena';
  s.mode = 'chain'; s.solo = false; s.quick = false; s.notice = '';
  s.requestedOpponent = null; s.returnToMap = returnToMap;
  localStorage.setItem(activeRoomKey, room.toBase58());
  run(join ? 'Staking your card and preparing the private arena…' : 'Opening your duel…', async () => {
    await Promise.all([refreshRoom(), refreshWallet()]);
    if (join && s.duel.phase === 0 && !participant()) {
      if (!anyCard()) throw new Error('Choose an unstaked demon first.');
      await client.joinDuel(s.duel, anyCard().key);
      audio('stake');
      await refreshRoom(); await client.delegate(s.duel); await refreshWallet();
    }
  });
  return true;
}

async function rivalReady() {
  if (guardianFinisher.pending) return { ok: false, reason: 'Claim your Ash Gate seal before challenging a hunter.' };
  assertCurrentGuest();
  if (client !== presenceGuest) return { ok: false, reason: 'Reload to challenge hunters with your recovered guest.' };
  if (s.busy || s.playing) return { ok: false, reason: 'Finish your current duel first.' };
  const active = readKey(localStorage.getItem(activeRoomKey));
  const boss = active && roomBoss(active);
  const open = active && await readDuel(active).catch(() => null);
  if (boss && (!open || open.phase === 3 && keyed(open.p1, client.key) && keyed(open.winner, client.key)
      && !readCampaign(localStorage, client.key).wins.some((win) => win.bossId === Number(boss)))) {
    return { ok: false, reason: 'Claim your guardian seal before challenging a hunter.' };
  }
  if (open && open.phase < 3 && (keyed(open.p1, client.key) || keyed(open.p2, client.key))) {
    return { ok: false, reason: 'Finish or cancel your open duel first.' };
  }
  if (open?.phase >= 3) clearSavedRoom(active);
  await refreshWallet();
  if (!anyCard()) return { ok: false, reason: 'You need an unstaked demon card to duel another hunter.' };
  if (s.balance < 0.006) return { ok: false, reason: 'Fund the guest wallet to stake a card.' };
  return { ok: true };
}

async function hostRivalDuel(stillWanted) {
  const ready = await rivalReady();
  if (!ready.ok) throw new Error(ready.reason);
  if (s.busy || s.playing || hostingRival || guardianFinisher.pending) throw new Error('Finish your current duel first.');
  if (!stillWanted()) throw new Error('The other hunter backed out before you staked.');
  assertCurrentGuest();
  hostingRival = true;
  try {
    const { duel } = await client.openDuel(anyCard().key);
    audio('stake');
    localStorage.setItem(activeRoomKey, duel.toBase58());
    return duel.toBase58();
  } finally { hostingRival = false; }
}

async function verifyRivalDuel(room, challenger) {
  const key = readKey(room);
  const duel = key && await until(() => readDuel(key), 20000).catch(() => null);
  if (!duel || duel.phase !== 0 || !duel.p1.equals(new PublicKey(challenger)) || !keyed(duel.p2, ZERO)) {
    throw new Error('That duel is not open on chain. No card was taken.');
  }
}

const presenceGuest = client;
startPresence({ keypair: presenceGuest.keypair, host: hostRivalDuel, check: rivalReady, verify: verifyRivalDuel });
window.addEventListener('demon-duels:mute', ({ detail }) => {
  if (typeof detail?.enabled !== 'boolean') return;
  s.sound = detail.enabled;
  localStorage.setItem('demon-duels:sound', s.sound ? 'on' : 'off');
});

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
  if (s.journey === 'arena' && /^[123]$/.test(event.key) && (s.mode === 'practice' && s.practiceCards.length || s.duel?.phase === 1 && participant())) {
    event.preventDefault(); action('move:' + (Number(event.key) - 1));
  }
});
restoreRoom();
if (s.room) s.journey = 'arena';
draw();
if (import.meta.env.DEV) previewFinisher(params)?.catch(() => {});
if (s.room) {
  s.solo = localStorage.getItem('demon-duels:solo:' + s.room) === '1';
  const profile = s.solo && savedProfile(localStorage, s.room);
  if (profile) { ashEncounter = profile; s.requestedOpponent = profile.opponentKind; s.returnToMap = true; }
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
