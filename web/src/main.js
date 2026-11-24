import './style.css';
import { PublicKey } from '@solana/web3.js';
import { ArenaClient, PROGRAM, ZERO, addressExplorer, explorer, localKey, packKey, proof, readCard, readDuel, readRound, until, sleep } from './chain.js';
import { icon } from './icons.js';
import { demons, moves, practicePack, resolve } from './rules.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const readKey = (value) => { try { return value ? new PublicKey(value) : null; } catch { return null; } };
const client = new ArenaClient(localKey('player'));
const bot = new ArenaClient(localKey('rival'));
const ASSET = import.meta.env.BASE_URL + 'art/';
const s = {
  mode: params.has('room') ? 'chain' : 'landing',
  balance: null, owned: [], selected: null, practiceCards: [], practiceStake: 0, practiceRival: 1,
  result: null, move: null, duel: null, busy: null, notice: '', modal: null,
  sound: localStorage.getItem('demon-duels:sound') === 'on',
  room: readKey(params.get('room')), solo: false, opposing: null, proof: null, packProof: null, packPending: false,
};
const short = (key) => key?.toString().slice(0, 4) + '…' + key?.toString().slice(-4);
const keyed = (value, key) => Boolean(value && key && value.equals(key));
const anyCard = () => s.owned.find((card) => keyed(card.key, s.selected) && keyed(card.lock, ZERO)) ??
  s.owned.find((card) => keyed(card.lock, ZERO));
const audio = (name) => { if (s.sound) new Audio(ASSET + name + '.ogg').play().catch(() => {}); };
const button = (action, label, cls = 'secondary', glyph = '') =>
  '<button type="button" data-action="' + action + '" class="button ' + cls + '"' + (s.busy ? ' disabled' : '') + '>' + (glyph ? icon(glyph) : '') + label + '</button>';
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const statusText = (status) => '<span class="status-tag"><i></i>' + status + '</span>';
const proofLink = (sig, label) => sig ? '<a class="proof-link" href="' + explorer(sig) + '" target="_blank" rel="noreferrer">' + label + icon('outside', 14) + '</a>' : '';
const moveKey = () => 'demon-duels:pick:' + s.room;
const safeMode = () => s.mode === 'chain';
const mySide = () => keyed(s.duel?.p2, client.key) ? 1 : 0;
const participant = () => keyed(s.duel?.p1, client.key) || keyed(s.duel?.p2, client.key);
const moveLocked = () => s.move !== null;

function cardMarkup(id, { side = 'front', className = '', placeholder = 'EMPTY SLOT', tag = '' } = {}) {
  const d = demons[id];
  if (!d) return '<div class="demon-card empty ' + className + '"><div class="card-border"></div><span class="corner tl">+</span><span class="corner br">+</span><div class="empty-icon">' +
    icon(side === 'rival' ? 'people' : 'skull', 38) + '</div><span class="empty-label">' + placeholder + '</span></div>';
  return '<div class="demon-card ' + className + '" style="--card-glow:' + d.glow + ';--card-hue:' + d.hue + 'deg">' +
    '<div class="card-border"></div><span class="corner tl">+</span><span class="corner br">+</span><div class="card-id"><span>DEMON / 0' + (id + 1) + '</span><span>' + icon('hex', 13) + '</span></div>' +
    '<img draggable="false" src="' + ASSET + d.art + '" alt="">' +
    '<div class="card-name"><span>' + d.type + '</span><strong>' + d.name + '</strong></div>' +
    (tag ? '<span class="card-tag">' + tag + '</span>' : '') + '</div>';
}

function battlefield() {
  const d = s.duel;
  const settled = s.result || d?.phase === 3;
  const myCard = s.mode === 'practice' ? s.practiceStake : s.mode === 'landing' ? 0 :
    ((s.staked && s.staked.kind) ?? anyCard()?.kind);
  const rivalCard = s.mode === 'practice' ? s.practiceRival : s.mode === 'landing' ? 1 : s.opposing?.kind;
  let winner = null;
  if (s.result) winner = s.result.winner;
  else if (settled) winner = keyed(d.winner, mySide() ? d.p2 : d.p1) ? 0 : 1;
  const rival = s.mode === 'practice' || s.solo ? 'PIT BOT' : s.mode === 'landing' ? 'CHALLENGER' : 'OPPONENT';
  return '<section class="battlefield" aria-label="Duel arena"><div class="arena-grid"></div><div class="arena-label"><span class="bracket">[</span> THE PIT <span class="bracket">]</span></div>' +
    '<div class="fighter fighter-left"><div class="fighter-label"><i></i>' + (d && !participant() ? 'PLAYER ONE' : 'YOUR STAKE') + '</div>' +
    cardMarkup(myCard, { className: winner === 0 ? 'victor' : winner === 1 ? 'defeated' : '', tag: winner === 0 ? 'VICTOR' : '', placeholder: 'NO DEMON STAKED' }) + '</div>' +
    '<div class="versus"><div class="versus-mark">' + icon('blade', 20) + '<b>VS</b></div><div class="versus-caption">WINNER<br>TAKES BOTH</div></div>' +
    '<div class="fighter fighter-right"><div class="fighter-label"><i></i>' + (d && !participant() ? 'PLAYER TWO' : rival) + '</div>' +
    cardMarkup(rivalCard, { side: 'rival', className: winner === 1 ? 'victor' : winner === 0 ? 'defeated' : '', tag: winner === 1 ? 'VICTOR' : '', placeholder: 'AWAITING STAKE' }) + '</div>' +
    '<span class="arena-coordinate">PIT // 001</span><span class="arena-coordinate right">STAKE // 01</span></section>';
}

function moveSelector() {
  const disabled = Boolean(s.busy || moveLocked());
  return '<div class="move-grid">' + moves.map((move, i) =>
    '<button type="button" class="move ' + (s.move === i ? 'chosen' : '') + '" data-action="move:' + i + '"' + (disabled ? ' disabled' : '') + '><span class="move-icon">' + icon(move.icon, 23) +
    '</span><span><b>' + move.name + '</b><small>Beats ' + move.beats + '</small></span></button>').join('') + '</div>';
}

function resultPanel() {
  const side = mySide();
  const both = s.result || {
    winner: keyed(s.duel.winner, side ? s.duel.p2 : s.duel.p1) ? 0 : 1,
    moves: side ? [...s.duel.moves].reverse() : s.duel.moves,
    crits: side ? [...s.duel.crits].reverse() : s.duel.crits,
    score: side ? [...s.duel.scores].reverse() : s.duel.scores,
  };
  const spectating = s.duel && !participant();
  const title = spectating ? (both.winner === 0 ? 'Player one wins' : 'Player two wins') :
    both.winner === 0 ? 'The pit is yours.' : 'The pit takes its due.';
  const line = both.moves.map((id, index) => '<span><b>' + moves[id].name + '</b> · ' + both.score[index] + ' DMG' +
    (both.crits[index] ? ' <em>CRIT</em>' : '') + '</span>').join('<small>VS</small>');
  return '<div class="control has-result"><div class="result-copy"><span class="eyebrow">' + (s.result ? 'PRACTICE COMPLETE' : 'SETTLED ON SOLANA DEVNET') +
    '</span><h2>' + title + '</h2><div class="damage">' + line + '</div></div><div class="actions">' +
    (s.result ? '' : proofLink(s.proof, 'Settlement transaction') || '<span class="muted">Indexing Explorer proof…</span>') +
    button('reset', s.result ? 'Play again' : 'Back to the pit', 'secondary', 'arrow') + '</div></div>';
}

function controls() {
  if (s.result || s.duel?.phase === 3) return resultPanel();
  if (s.mode === 'landing') return '<div class="control intro"><div><span class="eyebrow">THE STAKES ARE REAL. THE SOL IS NOT.</span><h2>One demon in. Two demons out.</h2><p>Stake a card, seal a move, and fight for both.</p></div><div class="actions">' +
    button('enter', 'Enter devnet', 'primary', 'blade') + button('practice', 'Practice vs bot', 'secondary', 'spark') + '</div></div>';
  if (s.mode === 'practice') return '<div class="control"><div class="control-title"><div><span class="eyebrow">OFFCHAIN PRACTICE · NO REAL STAKES</span><h2>' +
    (s.practiceCards.length ? 'Seal your move' : 'Summon your starter pack') + '</h2></div>' + button('leave', 'Exit practice', 'text') + '</div>' +
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
  if (s.duel?.phase === 0 && keyed(s.duel.p1, client.key)) return '<div class="control"><div><span class="eyebrow">01 / ONCHAIN CARD ESCROW</span><h2>Waiting for a challenger</h2><p>Send the duel link; only the first opponent to stake can join.</p></div><div class="actions">' +
    button(s.solo ? 'bot-resume' : 'invite', s.solo ? 'Resume bot' : 'Copy invite', 'primary', s.solo ? 'spark' : 'copy') + button('refund', 'Cancel duel', 'secondary') + '</div></div>';
  const card = anyCard();
  if (!card) {
    return '<div class="control"><div><span class="eyebrow">01 / MAGICBLOCK VRF</span><h2>' + (s.packPending ? 'Starter pack is rolling…' : 'Summon your starter pack') + '</h2><p>' +
      (s.packPending ? 'Awaiting the verifiable randomness callback.' : 'Claim three random demons. The pack is free; devnet SOL covers transaction fees.') + '</p></div><div class="actions">' +
      button('pack', s.packPending ? 'Check pack' : 'Open starter pack', 'primary', 'box') + '</div></div>';
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
      const selected = practice ? s.practiceStake === card.kind : keyed(anyCard()?.key, card.key);
      return '<button type="button" class="vault-card' + (selected ? ' selected' : '') + '" data-action="select:' + (practice ? card.kind : card.key) + '"' +
        (s.busy || !keyed(card.lock, ZERO) || s.duel?.phase === 1 || s.duel?.phase === 2 ? ' disabled' : '') + ' aria-pressed="' + selected + '">' +
        '<div class="vault-art" style="--card-glow:' + d.glow + ';--card-hue:' + d.hue + 'deg"><img src="' + ASSET + d.art + '" alt=""></div><span><b>' +
        d.name + '</b><small>' + (keyed(card.lock, ZERO) ? d.type : 'STAKED') + '</small></span>' + (selected ? '<span class="picked">' + icon('hex', 13) + '</span>' : '') + '</button>';
    }).join('') + '</div></section>';
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
      '<div class="actions">' + button('faucet', 'Try quick airdrop', 'primary', 'spark') + '<a class="button secondary" href="https://faucet.solana.com" target="_blank" rel="noreferrer">Solana faucet ' + icon('outside', 15) + '</a>' + button('wallet-refresh', 'Refresh balance', 'text') + '</div>'
    :
      '<ol><li><b>Stake.</b> Open a free starter pack, then each player stakes one owned card.</li><li><b>Seal.</b> Rend beats Ward. Ward beats Hex. Hex beats Rend. The private rollup hides both moves until they are locked.</li><li><b>Settle.</b> Each move starts with 2 damage. Advantage adds 1; a 25% crit adds 2. VRF breaks ties; the winner gets both cards on devnet.</li></ol>' +
      '<p>Devnet cards have no monetary value. The practice mode uses no blockchain.</p>') + '</section></div>';
}

function draw() {
  const focus = document.activeElement?.dataset?.action;
  const hadDialog = Boolean(app.querySelector('[role=dialog]'));
  const kind = s.mode === 'practice' ? 'PRACTICE MODE' : 'SOLANA DEVNET';
  app.innerHTML = '<header><div class="nav"><button type="button" class="wordmark" data-action="home"><img src="' + ASSET + 'sigil.svg" alt=""><span>DEMON<span>DUELS</span></span></button><div class="nav-right">' +
    statusText(kind) + '<button type="button" class="square sound" data-action="sound" aria-label="' + (s.sound ? 'Mute sound' : 'Enable sound') + '">' +
    icon(s.sound ? 'volume' : 'mute') + '</button><button type="button" class="square help" data-action="rules" aria-label="Duel rules">' + icon('info') + '</button><button type="button" class="button wallet secondary" data-action="wallet">' +
    icon('wallet', 16) + '<span>' + (safeMode() ? short(client.key) : 'Guest wallet') + '</span></button></div></div></header>' +
    '<main><div class="hero"><div class="superline"><span></span> THE UNDERWORLD ARCADE <span></span></div><h1>DEMON <em>DUELS</em></h1><p>Stake a demon. Seal a move. <strong>Take the spoils.</strong></p></div>' +
    battlefield() + controls() + '<div class="feedback" role="status" aria-live="polite">' + (s.busy ? '<i class="spinner"></i>' + esc(s.busy) : esc(s.notice)) + '</div>' + inventory() +
    '<div class="mechanics"><div>' + icon('lock') + '<span><b>PRIVATE MOVES</b><small>MagicBlock Private ER</small></span></div><div>' + icon('spark') +
    '<span><b>VERIFIABLE CRITS</b><small>MagicBlock VRF</small></span></div><div>' + icon('coin') +
    '<span><b>WINNER TAKES BOTH</b><small>Solana card ownership</small></span></div></div></main>' +
    '<footer><div><span>DEMON DUELS</span> <span>·</span> <span>MAGICBLOCK BLITZ V10</span></div><a href="' + addressExplorer(PROGRAM) +
    '" target="_blank" rel="noreferrer">Devnet program ' + icon('outside', 13) + '</a></footer>' + modal();
  if (s.modal && !hadDialog) app.querySelector('.modal .close')?.focus({ preventScroll: true });
  else if (focus) [...app.querySelectorAll('[data-action]')].find((element) => element.dataset.action === focus)?.focus({ preventScroll: true });
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
    s.proof ||= await proof(d.key, 'Demon Duels: winner').catch(() => null);
    if (previous !== 3) {
      localStorage.removeItem('demon-duels:active');
      audio('strike');
      await refreshWallet().catch(() => {});
    }
  }
}

async function run(label, action) {
  if (s.busy) return;
  s.busy = label;
  s.notice = '';
  draw();
  try { await action(); }
  catch (error) {
    const message = String(error?.message || error);
    s.notice = /insufficient|insufficientfunds|no record of a prior credit/i.test(message) ?
      'Not enough devnet SOL. Fund the guest wallet and retry.' :
      /program is not deployed|program account does not exist/i.test(message) ? 'The devnet program is not responding. Try again later.' :
      message.split('\n')[0].slice(0, 180);
  } finally { s.busy = null; draw(); }
}

function setRoom(key) {
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

async function ensurePack(owner) {
  const existing = await owner.pack();
  if (!existing) await owner.requestPack();
  await until(async () => (await owner.pack())?.opened, 60000);
}

async function readyBot() {
  if (await bot.balance() < 0.02) await client.transfer(bot.key, 0.03);
  await ensurePack(bot);
  const cards = (await bot.inventory()).filter((card) => keyed(card.lock, ZERO));
  if (!cards.length) throw new Error('The bot has no unstaked cards left on this browser.');
  await refreshRoom();
  if (s.duel.phase === 0) {
    await bot.joinDuel(s.duel, cards[0].key);
    await refreshRoom();
  }
  if (s.duel.phase === 1) {
    await bot.delegate(s.duel);
    await bot.lock(s.duel, crypto.getRandomValues(new Uint8Array(1))[0] % 3);
  }
}

async function startDuel(solo) {
  const card = anyCard();
  if (!card) throw new Error('Choose an unstaked demon first.');
  if (await client.balance() < (solo ? 0.037 : 0.006)) {
    s.modal = 'wallet';
    await refreshWallet();
    throw new Error('Fund this guest wallet with devnet SOL before staking.');
  }
  s.solo = solo;
  const { duel } = await client.openDuel(card.key);
  setRoom(duel);
  localStorage.setItem('demon-duels:active', duel.toBase58());
  if (solo) localStorage.setItem('demon-duels:solo:' + duel, '1');
  await refreshRoom();
  if (solo) {
    s.busy = 'The bot is staking and sealing its move…';
    draw();
    await readyBot();
  }
  await refreshWallet();
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
  if (name === 'sound') {
    s.sound = !s.sound;
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
  if (s.busy) return;
  if (name === 'home' || name === 'leave' || name === 'reset') {
    setRoom(null); s.mode = name === 'reset' ? s.mode : 'landing'; s.solo = false; s.notice = '';
    if (s.mode === 'practice') s.practiceRival = (s.practiceRival + 1) % demons.length;
    draw(); return;
  }
  if (name === 'practice') {
    s.mode = 'practice'; s.notice = ''; draw(); return;
  }
  if (name === 'practice-pack') {
    s.practiceCards = practicePack(); s.practiceStake = s.practiceCards[0]; s.practiceRival = (s.practiceStake + 1) % demons.length;
    audio('seal'); draw(); return;
  }
  if (name === 'enter') {
    s.mode = 'chain';
    await run('Loading your devnet vault…', async () => {
      const saved = readKey(localStorage.getItem('demon-duels:active'));
      if (!s.room && saved) {
        s.solo = localStorage.getItem('demon-duels:solo:' + saved) === '1';
        setRoom(saved);
      }
      await Promise.all([refreshWallet(), refreshRoom()]);
    }); return;
  }
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
        s.result = resolve(move, opponent, random); audio('strike');
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
  if (name === 'faucet') {
    await run('Requesting devnet SOL…', async () => {
      try { await client.faucet(); }
      catch { throw new Error('Quick airdrop unavailable. Copy the address and use the Solana faucet.'); }
      await refreshWallet(); s.notice = 'Guest wallet funded.';
    }); return;
  }
  if (name === 'wallet-refresh') { await run('Refreshing wallet…', refreshWallet); return; }
  if (name === 'bot' || name === 'create') {
    await run(name === 'bot' ? 'Staking a card on Solana…' : 'Creating your duel…', () => startDuel(name === 'bot')); return;
  }
  if (name === 'bot-resume') { await run('Resuming the bot…', readyBot); return; }
  if (name === 'join') {
    await run('Staking your card and preparing the private arena…', async () => {
      if (!anyCard()) throw new Error('Choose an unstaked demon first.');
      await client.joinDuel(s.duel, anyCard().key);
      localStorage.setItem('demon-duels:active', s.room.toBase58());
      await refreshRoom(); await client.delegate(s.duel); await refreshWallet();
    }); return;
  }
  if (name === 'refund') {
    await run('Returning the stakes…', async () => {
      await client.refund(s.duel);
      localStorage.removeItem('demon-duels:active');
      await Promise.all([refreshRoom(), refreshWallet()]);
    }); return;
  }
  if (name === 'resolve') await run('Checking the sealed moves…', resolveChain);
}

app.addEventListener('click', (event) => {
  const element = event.target.closest('[data-action]');
  if (element) action(element.dataset.action).catch(() => {});
  else if (event.target.matches('[data-dismiss]')) { s.modal = null; draw(); }
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && s.modal) { s.modal = null; draw(); } });
draw();
if (s.room) {
  s.solo = localStorage.getItem('demon-duels:solo:' + s.room) === '1';
  setRoom(s.room);
  run('Opening the duel invite…', async () => { await Promise.all([refreshRoom(), refreshWallet()]); });
}
let polling = false;
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
