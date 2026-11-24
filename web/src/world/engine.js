import './world.css';
import { demons } from '../rules.js';
import { circles } from '../campaign.js';
import { installHuntAudio } from './audio.js';
import { levels, TILE } from './levels.js';
import { acceptedWin, activeKey, campaignKey, gradeScore, readJSON, readWins, worldKey } from './progress.js';
import { createPresence, worldEvent } from './presence.js';
import { createRenderer } from './render.js';
import { loadWorldArt } from './environment.js';
import { sprites } from './sprites.js';
import { advance, advancePit, interaction, newRun, throwEmber } from './simulation.js';
import { gradeFor, distance } from './stealth.js';

let current;
const rom = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const button = (label, action, cls = 'secondary') => '<button type="button" class="button ' + cls + '" data-hunt="' + action + '">' + label + '</button>';
const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
const keys = new Set([...movementKeys, 'shift', 'c', 'e', 'q', 'f', ' ', 'escape']);
const short = (key) => key.slice(0, 4) + '…' + key.slice(-4);
const intro = [
  ['The Pit', 'Every soul that falls here keeps one thing. Its name.'],
  ['The Pit', 'Except you.'],
  ['Ash Warden', 'No name, no way out. The fire thanks you.'],
  ['The Pit', 'Your name broke into six runes. Six guardians caught them.'],
  ['The Pit', 'They chain the Pit. They keep every soul in their cards.'],
  ['Hunter', 'Then I take them back. One rune at a time.'],
  ['The Pit', 'Swear the Hunter’s Oath. The dark will choose three demons for you.'],
];

export function unmountWorld() {
  current?.dispose();
  current = null;
}

export function mountWorld(el, { wallet, chain }) {
  unmountWorld();
  const controller = new AbortController();
  const { signal } = controller;
  const listen = (target, event, fn) => target.addEventListener(event, fn, { signal });
  const presence = createPresence(levels, signal);
  const asset = import.meta.env.BASE_URL + 'art/';
  const art = loadWorldArt(asset);
  const huntAudio = installHuntAudio(import.meta.env.BASE_URL, signal);
  let player = String(wallet);
  const loadFlavor = () => ({ intel: {}, bestGrade: {}, grades: {}, vantage: {}, checkpoint: null, ...readJSON(localStorage, worldKey(player)) });
  let flavor = loadFlavor();
  const save = () => localStorage.setItem(worldKey(player), JSON.stringify(flavor));
  const wins = () => readWins(localStorage, player);
  const marketOpen = () => wins().length === levels.length;
  const audio = (cue, pos) => worldEvent('audio', { cue, circle: kind, ...(pos ? { pos: { x: pos.x / TILE, y: pos.y / TILE } } : {}) });
  let scene = 'title';
  let kind = null;
  let run;
  let renderer;
  let frame = 0;
  let suspended = false;
  let paused = false;
  let sneaking = false;
  let touchSight = false;
  let sprinting = false;
  let lastTime = 0;
  let lastStep = 0;
  let lastState = '';
  let stick = { id: null, x: 0, y: 0 };
  let encounter = null;
  let striking = false;
  let strikeTimer;
  let finishingWin = null;
  let finishedScene = null;
  let pauseBoss = 0;
  let objective = null;
  const down = new Set();
  const finished = new Set();
  let introIndex = 0;
  let chapter;
  let pitRenderer;
  let pitPeer;
  let bountyRooms = [];
  let enterCutscene = null;
  const preloads = [...Object.values(sprites.hunter), sprites.circles[0].boss].filter(Boolean).map((path) => {
    const img = new Image(); img.src = asset + path;
    return img.decode().catch(() => {});
  });
  const query = (name) => el.querySelector('[data-hunt-' + name + ']');
  const pitPose = { x: 8 * TILE, y: 4 * TILE, angle: Math.PI / 2, anim: 'idle' };
  const message = (text) => { const node = query('notice'); if (node) node.textContent = text; };
  const resetInput = () => {
    down.clear(); stick = { id: null, x: 0, y: 0 }; touchSight = false;
    query('stick')?.style.setProperty('--stick-x', '0px');
    query('stick')?.style.setProperty('--stick-y', '0px');
  };
  const movement = () => [
    Number(down.has('d') || down.has('arrowright')) - Number(down.has('a') || down.has('arrowleft')) + stick.x,
    Number(down.has('s') || down.has('arrowdown')) - Number(down.has('w') || down.has('arrowup')) + stick.y,
  ];

  function title() {
    scene = 'title';
    el.innerHTML = '<div class="hunt-title"><img src="' + asset + 'sigil.svg" alt=""><span class="hunt-kicker">DEMON DUELS / THE SEALED HAND</span><h1>UNDERWORLD<br><em>HUNT</em></h1><p>Six guardians stole your name. Take it back.</p>' +
      '<small class="hunt-kicker" data-hunt-loading>Loading hunter gear…</small>' +
      button('Press start', 'start', 'primary') + button('Enable sound', 'sound', 'text') + button('Campaign map', 'exit', 'text') + '</div>';
    Promise.all(preloads).then(() => { if (query('loading')) query('loading').textContent = 'The gates are ready'; });
  }

  function startStory(id, lines, done) {
    chapter = { id, lines, done };
    introIndex = 0;
    worldEvent('cutscene', { id });
    story();
  }

  function story() {
    scene = 'story';
    const [speaker, line] = chapter.lines[introIndex];
    el.innerHTML = '<div class="hunt-title hunt-story"><img src="' + asset + 'sigil.svg" alt=""><span class="hunt-kicker">' +
      (chapter.id === 'intro' ? 'HUNTER’S OATH' : chapter.id === 'outro' ? 'THE OPEN PIT' : 'THE DESCENT') + ' / ' +
      (introIndex + 1) + ' OF ' + chapter.lines.length + '</span><h2></h2><p></p>' +
      button('Continue', 'story-next', 'primary') + button('Skip story', 'story-skip', 'text') + '</div>';
    el.querySelector('h2').textContent = speaker;
    el.querySelector('p').textContent = line;
    el.querySelector('[data-hunt=story-next]').focus();
  }

  function finishStory() {
    const { id, done } = chapter;
    chapter = null;
    worldEvent('cutscene-done', { id });
    done();
  }

  function endStory() {
    flavor.intro = true;
    save();
    pit();
    el.querySelector('[data-hunt=vault]').focus();
  }

  async function loadPitBoard() {
    const board = query('bounties');
    const ledger = query('ledger');
    if (!board || !ledger) return;
    bountyRooms = [];
    const open = marketOpen();
    board.textContent = open ? 'Reading open devnet duels…' : 'Six chains. Six guardians. The board stays shut until they fall.';
    ledger.textContent = 'Reading recent settlements…';
    await Promise.all([
      open && Promise.resolve().then(() => chain.market()).then((rows) => {
        if (!board.isConnected || suspended) return;
        bountyRooms = rows.map(({ room }) => room);
        board.innerHTML = rows.length ? rows.map(({ owner, kind }, i) =>
          '<div class="hunt-market-row"><span>' + (demons[kind]?.name ?? 'Demon') + ' staked by hunter ' + short(owner) + '</span>' +
          button('Challenge', 'bounty:' + i) + '</div>').join('') : 'The board is empty. Post the first bounty.';
      }).catch(() => { board.textContent = 'The bounty board is unavailable. Try again later.'; }),
      Promise.resolve().then(() => chain.ledger()).then((rows) => {
        if (!ledger.isConnected || suspended) return;
        ledger.innerHTML = rows.length ? rows.map(({ winner, loser, kind, duel }) => {
          const boss = wins().find((win) => win.duel === duel);
          const grade = boss && flavor.grades[duel];
          const demon = demons[kind]?.name ?? 'demon';
          return '<div class="hunt-market-row">Hunter ' + short(winner) + (boss ? ' slew the ' + demon +
            (Object.hasOwn(gradeScore, grade) ? ' (' + grade + ', local/unverified)' : '') :
            ' took ' + short(loser) + '’s ' + demon) + '</div>';
        }).join('') : 'No settlements in recent program activity.';
      }).catch(() => { ledger.textContent = 'The hunter ledger is unavailable. Try again later.'; }),
    ]);
  }

  function pit(notice = '') {
    if (scene === 'circle') presence.leave();
    scene = 'pit'; kind = null; resetInput(); el.classList.remove('hunt--circle'); huntAudio.circle(null); chain.surface?.('pit');
    const progress = wins().length;
    const saved = localStorage.getItem(activeKey);
    el.innerHTML = '<div class="hunt-pit"><div class="hunt-top"><span class="hunt-kicker">DEMON DUELS / HUNTER’S REFUGE</span>' +
      button('Campaign map', 'exit', 'text') + '</div><h1>THE <em>PIT</em></h1><p class="hunt-deck">Take the Hunter’s Oath, read the gates, and choose which demon to stake.</p>' +
      '<div class="hunt-pit-actions">' + button('Hunter’s Oath · Open vault', 'vault', 'primary') +
      (saved ? button('Resume your duel', 'resume') : '') + '</div><div class="hunt-gates">' +
      levels.map((level, i) => '<button data-hunt="circle:' + i + '" type="button" ' + (i > progress ? 'disabled' : '') +
        '><span>' + rom[i] + ' / ' + (i < progress ? 'CLEARED' : i === progress ? 'OPEN' : 'SEALED') +
        '</span><strong>' + level.name + '</strong><small>' + demons[i].name + '</small></button>').join('') +
      '</div><div class="hunt-refuge"><p>Move with WASD or the arrow keys to approach another hunter.</p><canvas width="512" height="256" aria-label="Hunters in The Pit"></canvas>' +
      '<button type="button" class="button secondary" data-hunt="pit-challenge" hidden></button></div>' +
      '<section class="hunt-market" aria-label="Open Pit market"><h2>The Bounty Board</h2>' +
      '<p>Every bounty is a demon on the table. Answer it with yours. The winner takes both.</p><div class="hunt-pit-actions">' +
      (marketOpen() ? button('Post a bounty', 'post', 'primary') + button('Challenge a friend', 'friend') : '') + button('Refresh board and ledger', 'market', 'text') +
      '</div><p class="hunt-notice" data-hunt-notice role="status"></p><div data-hunt-bounties>' +
      (marketOpen() ? 'Refresh to show open devnet duels.' : 'Six chains. Six guardians. The board stays shut until they fall.') + '</div>' +
      '<h2>The Hunter Ledger</h2><p>Duels are settled onchain. Grades are local and unverified.</p><div data-hunt-ledger>Refresh to show recent settlements.</div></section></div>';
    pitRenderer = createRenderer(el.querySelector('canvas'), asset, art);
    pitPeer = null;
    message(notice);
    if (!suspended) presence.publish('pit', pitPose, performance.now());
  }

  function enter(number, notice = '', cutscene = true) {
    if (number > wins().length || !levels[number]) return;
    if (scene === 'pit') presence.leave();
    objective = null;
    scene = 'circle'; kind = number; paused = false; resetInput(); sneaking = false; sprinting = false; lastState = '';
    const level = levels[kind];
    chain.surface?.('circle');
    huntAudio.circle(kind);
    const checkpoint = level.checkpoints[flavor.checkpoint?.circle === kind ? flavor.checkpoint.index : 0] ?? level.start;
    run = newRun(level, flavor.intel[kind], flavor.vantage[kind], checkpoint);
    run.lookoutUntil = cutscene && !matchMedia('(prefers-reduced-motion: reduce)').matches ? performance.now() + 2400 : 0;
    flavor.checkpoint = { circle: kind, index: level.checkpoints.indexOf(checkpoint) };
    save();
    el.classList.add('hunt--circle');
    el.innerHTML = '<div class="hunt-top"><div><span class="hunt-kicker">CIRCLE ' + rom[kind] + ' / UNDERWORLD HUNT</span><h1>' +
      level.name + '</h1></div>' + button('The Pit', 'pit') + '</div><div class="hunt-stage" data-hunt-stage><canvas aria-label="Scrollable stealth level"></canvas>' +
      '<div class="hunt-reveal" data-hunt-reveal hidden><span class="hunt-kicker">GUARDIAN SIGHTED</span><strong>' + demons[kind].name + '</strong></div>' +
      '<div class="hunt-hud"><span data-hunt-watch>UNAWARE</span><progress aria-label="Highest watcher detection" data-hunt-meter max="100" value="0"></progress><small data-hunt-grade>GHOST</small></div>' +
      '<div class="hunt-prompt" data-hunt-prompt hidden>' + button('', 'interact', 'primary') +
      button('Practice strike', 'practice') + '</div><div class="hunt-touch"><div class="hunt-stick" data-hunt-stick aria-label="Movement joystick"><i></i></div>' +
      '<div>' + button('Sneak', 'sneak') + button('Sight', 'sight') + button('Sprint', 'sprint') + '</div></div>' +
      '<div class="hunt-pause" data-hunt-pause hidden><h2>Hunt paused</h2>' + button('Resume', 'pause', 'primary') + '</div></div>' +
      '<div class="hunt-bottom"><span class="hunt-notice" data-hunt-notice role="status"></span><span class="hunt-controls">WASD / ARROWS · SHIFT SPRINT · C SNEAK · Q SIGHT · F EMBER · ESC PAUSE</span></div>';
    renderer = createRenderer(el.querySelector('canvas'), asset, art, kind);
    objective = null;
    message(notice || (kind === 0 ? 'Stay in shadow or ash grass. Douse braziers with E; the gold diamond marks your quarry.' :
      kind === 1 ? 'The Wraith listens instead of looking. Sneak near it; E enters a purple void tear.' : 'Follow the gold diamond to your quarry.'));
    enterCutscene = cutscene ? 'circle-' + kind + '-enter' : null;
    if (enterCutscene) {
      worldEvent('cutscene', { id: enterCutscene });
      if (!run.lookoutUntil) endLookout();
    }
    audio(level.ambience);
    if (run.lookoutUntil) audio('boss-reveal', run.boss);
  }

  function endLookout() {
    if (!enterCutscene) return;
    worldEvent('cutscene-done', { id: enterCutscene });
    enterCutscene = null;
  }

  function handleInteraction(isPractice) {
    if (paused || striking || !objective || (isPractice && objective.name !== 'strike')) return;
    const level = levels[kind];
    const { name, target } = objective;
    if (name === 'strike') {
      const grade = gradeFor(run);
      const tells = level.intel.filter((scroll) => run.intel.includes(scroll.id)).slice(0, gradeScore[grade]).map((scroll) => scroll.text);
      const detail = { opponentKind: kind, mode: isPractice ? 'practice' : 'chain', returnToMap: true, source: 'world', grade, tells };
      striking = true;
      run.hunter.anim = 'strike'; run.hunter.animStart = performance.now();
      run.strike = run.hunter.animStart;
      presence.publish(kind, run.hunter, performance.now());
      query('stage').classList.add('hunt-striking');
      audio('strike', run.hunter);
      strikeTimer = setTimeout(() => {
        striking = false; run.strike = null;
        query('stage')?.classList.remove('hunt-striking');
        if (!window.dispatchEvent(new CustomEvent('demon-duels:launch', { detail, cancelable: true }))) {
          message(localStorage.getItem(activeKey) ? 'Resume or finish your saved duel at the Pit first.' : 'The arena is busy. Try again shortly.');
        }
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 510);
    } else if (name === 'douse') {
      target.doused = true; message('Brazier doused. The lane darkens.'); audio('douse', target);
    } else if (name === 'tear') {
      Object.assign(run.hunter, target, { vx: 0, vy: 0 });
      renderer.snap(); message('The void folded the path.');
    } else if (name === 'intel') {
      run.intel.push(target.id); flavor.intel[kind] = run.intel; save();
      message(target.text); audio('intel', target);
    } else if (name === 'vantage') {
      run.synced = true; flavor.vantage[kind] = true; save();
      pauseBoss = performance.now() + 550;
      message('Synchronized. The map now shows the boss route and intel.'); audio('vantage-sync', level.vantage);
    } else if (name === 'takedown') {
      run.guards = run.guards.filter((guard) => guard !== target);
      run.hunter.takedownUntil = performance.now() + 840;
      message('Thrall silently removed.'); audio('takedown', target);
    } else if (name === 'challenge') worldEvent('challenge-hunter', { id: target.id });
  }

  function loop(now) {
    if (suspended) return;
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.035, (now - (lastTime || now)) / 1000);
    lastTime = now;
    if (scene === 'pit') {
      const [dx, dy] = movement();
      advancePit(pitPose, dx, dy, dt);
      presence.publish('pit', pitPose, now);
      const peers = presence.inCircle('pit');
      pitRenderer.renderPit(pitPose, peers, now);
      pitPeer = peers.find((peer) => !peer.busy && distance(peer, pitPose) <= TILE * 1.5);
      const prompt = el.querySelector('[data-hunt=pit-challenge]');
      prompt.hidden = !pitPeer;
      if (pitPeer) prompt.textContent = 'E: Challenge ' + pitPeer.name;
      return;
    }
    if (scene !== 'circle' || !run) return;
    const level = levels[kind];
    const peers = presence.inCircle(kind);
    if (run.lookoutUntil && (now >= run.lookoutUntil || down.size || stick.x || stick.y)) {
      if (now < run.lookoutUntil) renderer.snap();
      run.lookoutUntil = 0;
      endLookout();
    }
    query('reveal').hidden = !run.lookoutUntil;
    if (!paused && !striking && now >= pauseBoss) {
      const [dx, dy] = movement();
      const previouslyHidden = run.hunter.hidden;
      const sprint = sprinting || down.has('shift');
      const result = advance(level, run, { dx, dy, sneak: sneaking, sprint, sight: touchSight || down.has('q') }, dt, now);
      if (result.caught) {
        const { intel, synced, checkpoint } = run;
        run = newRun(level, intel, synced, checkpoint);
        run.marked = true; run.boss.alert = true; run.boss.meter = 100;
        renderer.snap(); audio('detect-alert');
        message('Marked. You wake at the checkpoint. The guardian is now alerted.');
      } else if (run.hunter.moving && now - lastStep > (sneaking ? 510 : sprint ? 230 : 340)) {
        lastStep = now; audio('step-' + result.surface, run.hunter);
      }
      if (!previouslyHidden && run.hunter.hidden) audio('hide', run.hunter);
      const prompt = interaction(level, run, peers);
      if (prompt?.name !== objective?.name || prompt?.label !== objective?.label) {
        query('prompt').hidden = !prompt;
        query('prompt').querySelector('[data-hunt=interact]').textContent = prompt ? 'E: ' + prompt.label : '';
        query('prompt').querySelector('[data-hunt=practice]').hidden = prompt?.name !== 'strike';
      }
      objective = prompt;
      const grade = gradeFor(run);
      const state = run.watch + ':' + grade;
      query('watch').textContent = run.watch.toUpperCase() + (run.hunter.hidden ? ' · COVER' : '');
      if (state !== lastState) {
        const previous = lastState.split(':')[0];
        lastState = state;
        if (previous !== run.watch) {
          if (run.watch !== 'unaware') audio('detect-' + run.watch);
          else if (previous) audio('lose-trail');
        }
        query('watch').dataset.watch = run.watch;
        query('grade').textContent = grade.toUpperCase();
        worldEvent('world-state', { circle: kind, alert: run.watch, grade });
      }
      query('meter').value = run.meter;
    }
    renderer.render(level, kind, run, peers, dt, now);
    presence.publish(kind, run.hunter, now);
  }

  function pause() {
    paused = !paused; resetInput();
    query('pause').hidden = !paused;
  }

  function sneak() {
    sneaking = !sneaking;
    el.querySelector('[data-hunt=sneak]')?.setAttribute('aria-pressed', String(sneaking));
    if (sneaking) audio('sneak-on', run?.hunter);
  }

  function act(action) {
    if (action === 'exit') { chain.exit(); return; }
    if (action === 'sound') { chain.sound?.(); return; }
    if (action === 'start' && scene === 'title') {
      huntAudio.enable(Boolean(chain.start?.()));
      if (flavor.intro) pit();
      else startStory('intro', intro, endStory);
    } else if (action === 'story-next' && ++introIndex < chapter.lines.length) story();
    else if (action === 'story-next' || action === 'story-skip') finishStory();
    else if (action === 'vault' || action === 'resume') chain[action]();
    else if (action === 'post' && marketOpen()) chain.post();
    else if (action === 'friend') Promise.resolve().then(chain.friend).then(message, () => message('Could not copy the open duel invite.'));
    else if (action === 'market') loadPitBoard();
    else if (action === 'pit-challenge' && pitPeer) worldEvent('challenge-hunter', { id: pitPeer.id });
    else if (action?.startsWith('bounty:') && marketOpen()) {
      const room = bountyRooms[Number(action.slice(7))];
      if (room && !window.dispatchEvent(new CustomEvent('demon-duels:launch', {
        cancelable: true, detail: { source: 'market', mode: 'pvp', room, join: false, returnToMap: true },
      }))) message('Return to your current duel before challenging another hunter.');
    }
    else if (action === 'pit' && !striking) { endLookout(); pit(); }
    else if (action?.startsWith('circle:')) enter(Number(action.slice(7)));
    else if (action === 'interact' || action === 'practice') handleInteraction(action === 'practice');
    else if (action === 'pause') pause();
    else if (action === 'sneak') sneak();
    else if (action === 'sight') touchSight = !touchSight;
    else if (action === 'sprint') sprinting = !sprinting;
  }

  listen(el, 'click', (event) => act(event.target.closest('[data-hunt]')?.dataset.hunt));
  listen(window, 'keydown', (event) => {
    if (suspended || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName) && event.key === ' ') return;
    if (scene === 'title' && event.key === 'Enter') { event.preventDefault(); act('start'); return; }
    if (scene === 'story' && event.key === 'Escape') { event.preventDefault(); finishStory(); return; }
    const key = event.key.toLowerCase();
    if (scene === 'pit') {
      if (key === 'e' && !event.repeat) act('pit-challenge');
      if (movementKeys.includes(key)) { event.preventDefault(); down.add(key); }
      return;
    }
    if (scene !== 'circle') return;
    if (!keys.has(key)) return;
    event.preventDefault();
    down.add(key);
    if (event.repeat || striking) return;
    if (key === 'escape') pause();
    else if (!paused && key === 'c') sneak();
    else if (!paused && key === 'e') handleInteraction(false);
    else if (!paused && key === 'f' && throwEmber(levels[kind], run, performance.now())) audio('ember-throw', run.hunter);
  });
  listen(window, 'keyup', (event) => down.delete(event.key.toLowerCase()));
  listen(window, 'blur', resetInput);
  listen(el, 'pointerdown', (event) => {
    const pad = event.target.closest('[data-hunt-stick]');
    if (!pad || stick.id !== null) return;
    pad.setPointerCapture(event.pointerId);
    stick.id = event.pointerId;
    updateStick(event, pad);
  });
  listen(el, 'pointermove', (event) => {
    if (event.pointerId === stick.id) updateStick(event, query('stick'));
  });
  for (const type of ['pointerup', 'lostpointercapture', 'pointercancel']) listen(el, type, (event) => {
    if (event.pointerId !== stick.id) return;
    stick = { id: null, x: 0, y: 0 };
    updateStick(null, query('stick'));
  });
  function updateStick(event, pad) {
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const x = event ? event.clientX - rect.left - rect.width / 2 : 0;
    const y = event ? event.clientY - rect.top - rect.height / 2 : 0;
    const divisor = Math.max(rect.width * 0.31, Math.hypot(x, y));
    stick.x = x / divisor; stick.y = y / divisor;
    pad.style.setProperty('--stick-x', stick.x * 23 + 'px');
    pad.style.setProperty('--stick-y', stick.y * 23 + 'px');
  }

  function show(next, notice) {
    el.hidden = false; suspended = false; lastTime = 0; lastState = '';
    if (Number.isInteger(next)) enter(next, notice, false);
    else pit(notice);
    cancelAnimationFrame(frame); frame = requestAnimationFrame(loop);
  }

  listen(window, 'demon-duels:settled', ({ detail }) => {
    queueMicrotask(() => {
      if (signal.aborted || !chain.finisherReady(detail) || detail.duel !== encounter?.duel || finished.has(detail.duel)) return;
      finished.add(detail.duel);
      finishingWin = detail;
      worldEvent('finisher', { opponentKind: encounter.opponentKind, grade: encounter.grade, duel: detail.duel });
    });
  });
  listen(window, 'demon-duels:finisher-done', ({ detail }) => {
    if (detail?.opponentKind !== encounter?.opponentKind || !acceptedWin(wins(), player, encounter, finishingWin)) return;
    const { opponentKind, grade, duel } = encounter;
    if (gradeScore[grade] > (gradeScore[flavor.bestGrade[opponentKind]] ?? -1)) {
      flavor.bestGrade[opponentKind] = grade;
    }
    flavor.grades[duel] = grade;
    save();
    finishingWin = null;
    finishedScene = duel;
  });
  listen(window, 'demon-duels:return', ({ detail }) => {
    if (!suspended) return;
    const last = encounter; encounter = null;
    const won = last?.duel && last.duel === finishedScene;
    finishedScene = null;
    if (won) {
      audio('gate-open');
      suspended = false; el.hidden = false; el.classList.remove('hunt--circle');
      const boss = last.opponentKind;
      startStory('circle-' + boss + '-clear', [[demons[boss].name, circles[boss].victory]], () => {
        if (wins().length < levels.length || flavor.outro) {
          show(null, 'Guardian down. Return to the gates.');
          return;
        }
        const name = short(player);
        startStory('outro', [
          ['Gloam Shade', 'So you know. The Pit was never mine. I only kept it chained.'],
          ['The Pit', 'Six runes. One name. ' + name + '. Written where no fire can reach it.'],
          ['Hunter', 'I remember.'],
          ['The Pit', 'The chains are broken. The board is open. Not just to you.'],
          ['The Pit', 'No guardians now. No house. Only the Old Pact. The winner takes both.'],
          ['Hunter', 'Then let’s see who’s hungry.'],
          ['The Pit', 'Welcome to the Pit, ' + name + '. It always takes.'],
        ], () => {
          flavor.outro = true; save();
          show(null, 'The chains are broken. The board is open.');
          query('bounties')?.scrollIntoView({ block: 'center' });
          loadPitBoard();
        });
      });
    } else if (Number.isInteger(last?.opponentKind) || scene === 'circle') {
      const note = last?.mode === 'practice' ? 'Practice grants no clear or cards.' : detail?.phase === 4 ? 'The boss fled. Your stake was returned.' :
        detail?.mode === 'chain' && detail?.result?.winner === 1 ? 'Your demon fell. The guardian still waits.' : '';
      show(last?.opponentKind ?? kind, note);
    } else show(null);
  });
  listen(window, 'storage', ({ key }) => { if (key === campaignKey(player) && scene === 'pit' && !suspended) pit(); });

  current = {
    hide(detail) {
      encounter = detail ?? null;
      suspended = true; el.hidden = true; resetInput(); presence.leave();
      endLookout();
      huntAudio.circle(null);
      cancelAnimationFrame(frame);
    },
    bind(duel) { if (encounter?.mode === 'chain') encounter.duel = duel; },
    rekey(wallet) { player = String(wallet); flavor = loadFlavor(); },
    setSound(enabled) {
      huntAudio.enable(enabled);
      const control = el.querySelector('[data-hunt=sound]');
      if (control) control.textContent = enabled ? 'Mute sound' : 'Enable sound';
    },
    finishReturn() { if (encounter?.duel && finishedScene === encounter.duel) chain.returnToWorld(); },
    dispose() {
      controller.abort(); cancelAnimationFrame(frame); clearTimeout(strikeTimer);
      presence.leave(); el.replaceChildren(); el.hidden = true;
    },
  };
  el.classList.add('hunt');
  el.hidden = false;
  title();
  frame = requestAnimationFrame(loop);
  return current;
}
