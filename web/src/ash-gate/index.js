import * as T from 'three';
import { loadingScreen, pauseMenu, storyPanel, titleScreen, worldHud } from '../game-ui.js';
import { characters } from '../characters.js';
import { demons } from '../rules.js';
import { installHuntAudio } from '../world/audio.js';
import { huntProfile } from './encounter.js';
import { figure } from './figures.js';
import { ashHunters, emit } from './hunters.js';
import { installModel } from './models.js';
import { braziers, buildGate, cover, limits, roofs, shade } from './scenery.js';
import { cameraSweep, canStrike, circleRules, dampVelocity, inside, mantleTarget, obstruction, outcomeOnReturn, sees } from './stealth.js';
import './style.css';
import '../game-overlays.css';

const TAU = Math.PI * 2;
const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const within = (x, z, bounds) => x > bounds.left && x < bounds.right && z > bounds.far && z < bounds.near;
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const approach = (value, target, rate, dt) => T.MathUtils.lerp(value, target, 1 - Math.exp(-rate * dt));
export const ASH_GATE = {
  id: 0, opponentKind: 0, name: 'Ash Gate', chapter: 'I / THE UNDERWORLD',
  spawn: { x: -.55, z: 12.55 }, bounds: limits,
  boss: { model: 'ash-warden.glb', height: 3, pos: { x: 0, z: -11.65 }, facing: Math.PI },
  patrols: [
    { route: [[.3, 6.2], [-9.7, 6.2], [-9.7, 1.6], [-9.7, -3.9], [-9.7, 6.2], [.3, 6.2]], facing: Math.PI / 2 },
    { route: [[-2, -5.5], [3.95, -5.5], [7.9, -5.5], [7.9, -2.75], [-2, -2.75]], facing: -Math.PI / 2 },
  ],
  palette: { background: 0x232a32 }, fog: { color: 0x232a32, density: .032 },
  audio: {},
  objective: ({ z, touch, outcome }) => outcome === 'won' ? 'The first flame is yours.'
    : outcome === 'lost' ? 'The Warden still holds the gate.'
      : z < -6 ? 'Circle behind the Warden and strike from outside his sight.'
        : touch ? 'Drag to look. Crouch in the ash and climb a marked ledge past the patrol.'
          : 'Drag to look. Crouch (C) in ash; use Space at a marked ledge to pass the patrol.',
  scenery(_three, scene) {
    const animate = buildGate(scene);
    return {
      colliders: [...cover, ...roofs], ledges: cover.filter((b) => b.vaultable), barriers: cover,
      roofs, coverZones: shade, braziers, animate, setLowQuality: animate.setLowQuality, raise: animate.raise,
      cameraBlockers: [
        { x: -11.9, z: 0, w: 1.45, d: 36, h: 4.18 }, { x: 11.9, z: 0, w: 1.45, d: 36, h: 4.18 },
        { x: 0, z: -15.7, w: 24, d: 1.45, h: 8 },
      ],
    };
  },
};

function visionCone(scene, walls) {
  const count = 27, buffer = new Float32Array((count + 2) * 3), indices = [];
  for (let i = 1; i <= count; i++) indices.push(0, i, i + 1);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(buffer, 3));
  geo.setIndex(indices);
  const cone = new T.Mesh(geo, new T.MeshBasicMaterial({
    color: 0xd59963, side: T.DoubleSide, transparent: true, opacity: .20, depthWrite: false,
  }));
  cone.frustumCulled = false;
  const edge = new T.Line(geo.clone(), new T.LineBasicMaterial({ color: 0xd99d65, transparent: true, opacity: .6 }));
  edge.geometry.setIndex(null);
  edge.geometry.setAttribute('position', geo.getAttribute('position'));
  edge.frustumCulled = false;
  scene.add(cone, edge);
  return (state, visible = true) => {
      cone.visible = edge.visible = visible;
      if (!visible) return;
      geo.attributes.position.setXYZ(0, state.x, .068, state.z);
      for (let i = 0; i <= count; i++) {
        const [fx, fz] = forward(state.yaw + state.halfAngle * (i / count * 2 - 1));
        const x = state.x + fx * state.range, z = state.z + fz * state.range;
        const stop = obstruction(state.x, state.z, x, z, walls);
        geo.attributes.position.setXYZ(i + 1, T.MathUtils.lerp(state.x, x, stop), .068, T.MathUtils.lerp(state.z, z, stop));
      }
      geo.attributes.position.needsUpdate = true;
      cone.material.opacity = .16 + state.suspicion * .27;
      edge.material.opacity = .53 + state.suspicion * .3;
  };
}

function patrol(scene, { route, facing, yaw = facing ?? 0, range = 6, halfAngle = .44 }, walls, canWalk) {
  const actor = figure(scene, 'guard');
  const [x, z] = route[0];
  actor.root.position.set(x, 0, z);
  actor.root.rotation.y = yaw;
  const paint = visionCone(scene, walls);
  const state = { x, z, yaw, range, halfAngle, waypoint: 1 % route.length, suspicion: 0, pause: 1.2, pursuit: null };
  const clear = (x, z) => canWalk(x, z) && !walls.some((wall) => inside(x, z, wall, .12));
  return {
    state,
    update(t, dt, targets) {
      let search = null, nearest = Infinity;
      if (!state.pursuit) for (const target of targets) {
        if (target.until <= t) continue;
        const distance = Math.hypot(target.pos.x - state.x, target.pos.z - state.z);
        if (distance < nearest) { search = target.pos; nearest = distance; }
      }
      const [toX, toZ] = state.pursuit ?? (search ? [search.x, search.z] : route[state.waypoint]);
      const dx = toX - state.x, dz = toZ - state.z;
      const dist = Math.hypot(dx, dz);
      state.pause -= dt;
      const moving = (state.pursuit || search || state.pause <= 0) && dist > .1;
      if (dist > .1) state.yaw += angleDelta(state.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 4.6);
      else if (state.pursuit || search) state.yaw += Math.sin(t * 5) * dt * 2;
      if (moving) {
        const travel = Math.min(dist, dt * (state.pursuit ? 2.85 : 1.46));
        const x = state.x + dx / dist * travel, z = state.z + dz / dist * travel;
        if (clear(x, state.z)) state.x = x;
        if (clear(state.x, z)) state.z = z;
      } else if (!state.pursuit && !search && dist <= .1) {
        state.waypoint = (state.waypoint + 1) % route.length;
        state.pause = .7;
      }
      actor.root.position.set(state.x, 0, state.z);
      actor.root.rotation.y = state.yaw;
      actor.pose(t * 7, moving ? .52 : 0);
    },
    paint,
  };
}

export const mountAshGate = (options) => mountCircle(ASH_GATE, options);

export function mountCircle(descriptor = ASH_GATE, { getCampaign, hasSeal, hasAshSeal, setExploring = () => {}, startInPlay = false } = {}) {
  const { id, name, chapter, opponentKind, spawn, hooks = {}, fog, palette, audio: audioCues = {} } = { ...ASH_GATE, ...descriptor };
  const rules = circleRules(hooks);
  const bossConfig = { ...ASH_GATE.boss, ...descriptor.boss };
  const bossName = descriptor.bossName ?? bossConfig.name ?? demons[opponentKind]?.name ?? 'Guardian';
  const copy = descriptor.copy ?? descriptor.messages ?? {};
  const earnedSeal = hasSeal ?? hasAshSeal ?? (() => getCampaign?.().wins.some((win) => win.bossId === opponentKind) ?? false);
  const arena = document.getElementById('app');
  const world = document.createElement('section');
  world.className = 'ash-gate';
  world.setAttribute('aria-label', name + ', third-person world');
  world.innerHTML = '<div class="ash-shade"></div><div class="ash-overlay"></div>';

  const touch = matchMedia('(any-pointer: coarse)').matches;
  let low = touch, sampleTime = 0, sampleFrames = 0;
  const renderer = new T.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  world.prepend(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(palette.background ?? ASH_GATE.palette.background);
  if (fog) scene.fog = new T.FogExp2(fog.color ?? palette.background, fog.density ?? .032);
  const camera = new T.PerspectiveCamera(55, 1, .08, 100);
  const scenery = (descriptor.scenery ?? ASH_GATE.scenery)(T, scene);
  const customBounds = scenery.limits ?? descriptor.limits ?? descriptor.bounds;
  const bounds = customBounds ?? limits;
  const animate = scenery.animate ?? scenery.update;
  const { roofs: rooftops = [], ledges = [], barriers = [], coverZones = [], braziers: fires = [] } = scenery;
  const walls = scenery.colliders ?? [...new Set([...barriers, ...ledges, ...rooftops])];
  const mantleSurfaces = [...new Set([...ledges, ...barriers.filter((b) => b.vaultable), ...rooftops])];
  const boundary = customBounds && customBounds !== limits ? [
    ...[bounds.left, bounds.right].map((x) => ({ x, z: (bounds.far + bounds.near) / 2, w: .02, d: bounds.near - bounds.far, h: 8 })),
    ...[bounds.far, bounds.near].map((z) => ({ x: (bounds.left + bounds.right) / 2, z, w: bounds.right - bounds.left, d: .02, h: 8 })),
  ] : [];
  const cameraBlockers = [...walls, ...(scenery.cameraBlockers ?? []), ...boundary];
  const peers = ashHunters(scene, world, { circle: id, bounds, roofs: rooftops });
  function setQuality() {
    renderer.shadowMap.enabled = !low;
    scenery.setLowQuality?.(low);
    resize();
  }
  const hunter = figure(scene, 'hunter');
  const warden = figure(scene, 'warden');
  if (id !== 0) warden.root.scale.setScalar(bossConfig.height / 2.30);
  const wardenVisual = new T.Group();
  warden.root.add(wardenVisual);
  wardenVisual.scale.setScalar(1 / warden.root.scale.x);
  const wardenRig = { root: wardenVisual, body: warden.body };
  const models = Promise.all([installModel(hunter, descriptor.hunterModel ?? 'hunter.glb'),
    bossConfig.model && installModel(wardenRig, bossConfig.model, { height: id === 0 ? undefined : bossConfig.height })]);
  const boss = { ...bossConfig.pos, yaw: bossConfig.facing, range: bossConfig.range ?? 6.4, halfAngle: bossConfig.halfAngle ?? .61, suspicion: 0 };
  const bossGround = boss.y ?? 0;
  const drawBossCone = visionCone(scene, walls);
  warden.root.position.set(boss.x, bossGround, boss.z);
  warden.root.rotation.y = boss.yaw;
  const guards = (descriptor.patrols ?? ASH_GATE.patrols).map((route) => patrol(scene, route, walls,
    (x, z) => within(x, z, bounds) && rules.canTraverse({ x, y: 0, z })));

  document.body.append(world);
  const arenaTitle = document.title;
  const gateTitle = 'Demon Duels — ' + name;
  document.title = gateTitle;
  const canvas = renderer.domElement;
  const fade = document.createElement('div');
  fade.className = 'ash-fade';
  world.append(fade);
  canvas.tabIndex = -1;
  const focusCanvas = () => canvas.focus({ preventScroll: true });
  const overlay = world.querySelector('.ash-overlay');
  world.classList.toggle('ash-touch', touch);
  let stick = null, touchX = 0, touchY = 0, jumpButton, strikeButton, crouchButton;
  const touchControls = document.createElement('div');
  touchControls.className = 'ash-touch-controls';
  touchControls.hidden = true;
  if (touch) {
    touchControls.innerHTML = '<div class="ash-joystick" aria-label="Drag to move"><i></i></div><div class="ash-touch-actions"><button type="button" data-hunt="crouch">Crouch</button><button type="button" data-hunt="jump">Jump</button><button type="button" data-hunt="strike" hidden>Strike</button></div>';
    world.append(touchControls);
    [crouchButton, jumpButton, strikeButton] = touchControls.querySelectorAll('button');
    const pad = touchControls.querySelector('.ash-joystick');
    const nub = pad.querySelector('i');
    function moveStick(event) {
      if (event.pointerId !== stick) return;
      const bounds = pad.getBoundingClientRect();
      const radius = bounds.width * .33;
      const dx = (event.clientX - bounds.left - bounds.width / 2) / radius;
      const dy = (event.clientY - bounds.top - bounds.height / 2) / radius;
      const scale = Math.max(1, Math.hypot(dx, dy));
      touchX = dx / scale;
      touchY = -dy / scale;
      nub.style.transform = 'translate(' + touchX * radius + 'px,' + -touchY * radius + 'px)';
    }
    pad.addEventListener('pointerdown', (event) => {
      if (stick !== null) return;
      stick = event.pointerId;
      pad.setPointerCapture(stick);
      useAudio();
      moveStick(event);
    });
    pad.addEventListener('pointermove', moveStick);
    pad.addEventListener('lostpointercapture', () => {
      stick = null;
      touchX = touchY = 0;
      nub.style.transform = '';
    });
  }
  const keys = new Set();
  const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyQ', 'KeyE', 'KeyF', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']);
  const canMoveTo = (x, z) => within(x, z, bounds) && rules.canTraverse({ x, y: height, z })
    && !walls.some((b) => b.h > height + .03 && inside(x, z, b, .28))
    && (outcome === 'won' || Math.abs(height - bossGround) > .7 || Math.hypot(x - boss.x, z - boss.z) >= .74);
  let x = spawn.x, z = spawn.z, facing = spawn.facing ?? 0, yaw = facing, tilt = .16, height = spawn.y ?? 0, falling = 0, climb = null, ledge = null;
  let active = true, crouch = false, gait = 0, bend = 0, step = 0, alert = 0, attack = 0;
  let block = 0, blockLearned = false, blockPrompt = false;
  let interaction = null, crossing = null;
  let vx = 0, vz = 0;
  let wardenSees = false, sneaking = false, searchGuard = null;
  let duelOpen = false, frameRequest = null;
  let seal = earnedSeal();
  let ready = false, pending = null, settlement = null, outcome = seal ? 'won' : null, noticeTime = 0, pointer = null;
  let watched = false, spotted = false, nearbyPeer = null, lastPose = -Infinity, lastFootstep = 0;
  let menu = 'loading', status = 'clear', notice = '', rendered = '', sceneEntered = false;
  let audioEnabled = localStorage.getItem('demon-duels:sound') === 'on';
  const audio = installHuntAudio(import.meta.env.BASE_URL, new AbortController().signal, { ambient: audioCues.ambient });
  const cue = (name) => {
    const sound = audioCues[name] ?? (name === 'step-stone' ? audioCues.footstep : null) ?? name;
    if (sound !== false) emit('audio', { cue: sound, circle: id });
  };
  const useAudio = () => audio.enable(active && audioEnabled);
  if (outcome === 'won') warden.root.visible = false;
  let previous = performance.now(), sceneTime = 0;
  let victoryTime = seal ? 3.5 : 0;
  let flight = false, boom = Infinity, strikeFrame = 0, hunterOpacity = 1;
  const fadedMaterials = new Map();
  const focus = new T.Vector3();
  const pivot = new T.Vector3();
  const cameraGoal = new T.Vector3();
  const controlsGuide = descriptor.guide?.[touch ? 'touch' : 'keyboard'] ?? (touch
    ? 'Drag the left stick to move or sprint. Drag the scene to look.\nTap Crouch for stealth and Jump or Climb at a ledge.\nPractice Block, then circle behind ' + bossName + ' and tap Strike.'
    : 'WASD: move · Drag mouse: look · Shift: sprint\nC or Ctrl: crouch · Space: jump or climb\nQ: hand-block · E: strike · F: challenge a nearby hunter');
  const objectiveCopy = descriptor.objective ?? ASH_GATE.objective;
  const position = () => ({ x, y: height, z });
  const sight = (guard, pos) => hooks.sightRange ? { ...guard, range: hooks.sightRange(guard, pos) ?? guard.range } : guard;
  const button = (action, label, aria = '') => '<button type="button" data-hunt="' + action + '"' + aria + '>' + label + '</button>';
  const exit = button('exit', 'Enter the Pit');

  function renderOverlay() {
    const sound = button('sound', audioEnabled ? 'Sound on' : 'Sound off', ' aria-pressed="' + audioEnabled + '"');
    let html;
    if (menu === 'loading') html = loadingScreen({ label: 'Entering the Underworld', detail: 'Loading ' + name });
    else if (menu === 'title') html = titleScreen({ actions: button('start', 'Enter ' + name) + exit + sound });
    else if (menu === 'pause') html = pauseMenu({ actions: button('resume', 'Resume memory') + button('guide', 'Controls') + sound + exit });
    else if (menu === 'guide') html = storyPanel({
      speaker: 'Hunter’s journal', text: controlsGuide, actions: button('resume', 'Resume memory'),
    });
    else {
      const prompt = blockPrompt ? { key: touch ? 'Tap' : 'Q', label: 'Practice hand-block', action: 'block' }
        : ready ? (touch ? null : { key: 'E', label: 'Strike ' + bossName })
          : interaction ? { key: touch ? 'Tap' : 'E', label: interaction.label, action: 'interact' }
            : ledge && !touch ? { key: 'Space', label: ledge.vaultable ? 'Vault' : 'Climb' }
        : nearbyPeer && !attack && !climb && !alert && !sneaking ? { key: touch ? 'Tap' : 'F', label: 'Challenge ' + (nearbyPeer.name || 'hunter'), action: 'challenge' } : null;
      const objective = typeof objectiveCopy === 'function' ? objectiveCopy({ ...position(), touch, outcome }) : objectiveCopy;
      if (touch) {
        jumpButton.textContent = ledge ? (ledge.vaultable ? 'Vault' : 'Climb') : 'Jump';
        strikeButton.hidden = !ready;
        crouchButton.setAttribute('aria-pressed', crouch);
      }
      html = worldHud({
        location: name, chapter, objective, seals: getCampaign?.().wins.length ?? Number(seal),
        awareness: status === 'seen' ? 'suspicious' : status === 'alert' ? 'alert' : 'clear',
        prompt, message: notice || (wardenSees ? (copy.seen ?? copy.approach ?? 'He sees you — circle behind.') : status === 'roof'
          ? (copy.roof ?? 'Above the patrols') : status === 'hidden' ? (copy.hidden ?? 'Hidden in ash') : ''),
        hunters: peers.count(), actions: button('pause', touch ? 'Pause' : 'Pause <kbd>ESC</kbd>') + (touch ? '' : exit) + sound,
      });
    }
    if (html === rendered) return;
    const current = document.activeElement;
    const action = overlay.contains(current) && current.dataset.hunt;
    rendered = html;
    overlay.classList.toggle('ash-controls', menu === 'guide');
    overlay.innerHTML = html;
    if (action) Array.from(overlay.querySelectorAll('[data-hunt]')).find((item) => item.dataset.hunt === action)?.focus({ preventScroll: true });
  }

  function setMenu(next) {
    menu = next;
    keys.clear();
    touchX = touchY = 0;
    touchControls.hidden = !touch || next !== 'play';
    pointer = null;
    audio.circle(menu === 'play' ? id : null);
    renderOverlay();
    if (next === 'pause' || next === 'guide') overlay.querySelector('[data-hunt="resume"]')?.focus({ preventScroll: true });
    if (next === 'play') {
      if (copy.enter && !sceneEntered) show(copy.enter, 4);
      sceneEntered = true;
      focusCanvas();
    }
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = camera.aspect < .75 ? 67 : 55;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? .85 : 1.5, Math.sqrt(1800000 / (window.innerWidth * window.innerHeight))));
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  function show(text, time = 0) {
    notice = text;
    noticeTime = time;
  }
  function beginStrike() {
    if (!active || menu !== 'play' || !ready || attack || pending) return;
    ready = false;
    facing = Math.atan2(x - boss.x, z - boss.z);
    attack = .001;
    cue('strike');
    show(copy.strike ?? 'You took my name. I’m taking your card.');
  }
  function useInteract() {
    if (ready) { beginStrike(); return; }
    const to = interaction?.destination;
    if (!active || menu !== 'play' || !to || crossing || attack || block || climb || falling ||
        !Number.isFinite(to.x) || !Number.isFinite(to.z) || !within(to.x, to.z, bounds) ||
        !rules.canTraverse({ ...to, y: to.y ?? 0 })) return;
    crossing = { to, time: 0, moved: false };
    interaction = null;
    keys.clear();
  }
  function jumpOrClimb() {
    if (climb || attack || falling || block || crossing) return;
    cue('leap');
    if (!ledge) { falling = -5.2; return; }
    const to = ledge.exit && canMoveTo(ledge.exit.x, ledge.exit.z) ? { ...ledge, ...ledge.exit } : ledge;
    climb = { to, x, z, height, t: 0, duration: to.vaultable ? .4 : .82 };
    facing = Math.atan2(x - to.x, z - to.z);
  }
  function practiceBlock() {
    if (!blockPrompt || block) return;
    blockLearned = true;
    blockPrompt = false;
    block = .72;
    facing = Math.atan2(x - boss.x, z - boss.z);
    show('Ward raises a hand to block in the duel. Now circle behind.', 3);
  }
  function enterArena(kind) {
    pending = kind;
    settlement = null;
    keys.clear();
    active = false;
    stopRendering();
    peers.leave();
    audio.circle(null);
    world.hidden = true;
    arena.hidden = false;
    setExploring(false, name);
    document.title = arenaTitle;
    window.scrollTo(0, 0);
  }
  function returnToGate() {
    pending = null;
    active = true;
    lastPose = -Infinity;
    arena.hidden = true;
    world.hidden = false;
    fade.style.opacity = 0;
    audio.circle(menu === 'play' ? id : null);
    useAudio();
    setExploring(true, name);
    document.title = gateTitle;
    focusCanvas();
    startRendering();
  }
  function showVictory() {
    if (seal || !earnedSeal()) return;
    outcome = 'won';
    seal = true;
    flight = true;
    cue('gate-open');
    show(copy.victory ?? 'One rune returns. It remembers you.');
  }
  function flyCard() {
    const target = overlay.querySelector('.dd-vitals > small');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const origin = new T.Vector3(boss.x, bossGround + 1.5, boss.z).project(camera);
    const card = document.createElement('img');
    card.className = 'ash-captured-card';
    card.src = import.meta.env.BASE_URL + 'art/' + characters[opponentKind].portrait;
    card.alt = bossName + ' captured';
    world.append(card);
    const fromX = Math.max(32, Math.min(innerWidth - 32, (origin.x + 1) * innerWidth / 2));
    const fromY = Math.max(42, Math.min(innerHeight - 42, (1 - origin.y) * innerHeight / 2));
    card.animate([
      { transform: `translate(${fromX}px, ${fromY}px) translate(-50%, -50%) scale(.65)`, opacity: 0 },
      { transform: `translate(${innerWidth / 2}px, ${innerHeight * .42}px) translate(-50%, -50%)`, opacity: 1, offset: .42 },
      { transform: `translate(${rect.left + rect.width / 2}px, ${rect.top + rect.height / 2}px) translate(-50%, -50%) scale(.2)`, opacity: 0 },
    ], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1350, easing: 'ease-in-out' }).finished.then(() => card.remove(), () => card.remove());
    flight = false;
  }
  function challenge() {
    if (active && menu === 'play' && nearbyPeer && !sneaking && !alert && !attack && !climb) emit('challenge-hunter', { id: nearbyPeer.id });
  }
  function stopRendering() {
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    frameRequest = null;
  }
  function startRendering() {
    if (frameRequest !== null || !active || duelOpen) return;
    previous = performance.now();
    frameRequest = requestAnimationFrame(frame);
  }
  function frame(now) {
    frameRequest = requestAnimationFrame(frame);
    const elapsed = (now - previous) / 1000;
    const dt = Math.min(elapsed, .5);
    previous = now;
    if (!active || document.hidden) { sampleTime = sampleFrames = 0; return; }
    if (!low && menu === 'play') {
      sampleTime += Math.min(elapsed, .5);
      sampleFrames++;
      if (sampleTime >= 3) {
        if (sampleFrames / sampleTime < 25) {
          low = true;
          setQuality();
        }
        sampleTime = sampleFrames = 0;
      }
    }
    sceneTime += dt;
    animate?.(sceneTime, dt);
    if (menu === 'loading' || menu === 'title') {
      const orbit = Math.sin(sceneTime * .22);
      camera.position.set(spawn.x - .05 + orbit * .65, 2.35 + .14 * orbit, spawn.z + 2.7);
      camera.lookAt(spawn.x - .5, 1.2, spawn.z - 20.55);
      hunter.root.position.set(spawn.x + 1.8, 0, spawn.z - .87);
      hunter.root.rotation.y = -.18;
      hunter.pose(sceneTime * 2.4);
      hunter.model?.update('Idle', dt);
      wardenRig.model?.update('Idle', dt);
      renderer.render(scene, camera);
      return;
    }
    if (menu !== 'play') return;
    if (noticeTime > 0 && (noticeTime -= dt) <= 0) show('');
    block = Math.max(0, block - dt);
    if (crossing) {
      if (crossing.time >= .13 && !crossing.moved) {
        const { to } = crossing;
        x = to.x; z = to.z; height = to.y ?? 0;
        yaw = facing = to.facing ?? to.yaw ?? facing;
        boom = Infinity;
        strikeFrame = 0;
        lastPose = -Infinity;
        crossing.moved = true;
      }
      crossing.time = Math.min(crossing.time + dt, crossing.moved ? .31 : .13);
      fade.style.opacity = crossing.moved ? 1 - T.MathUtils.smoothstep(crossing.time, .13, .31) : crossing.time / .13;
      if (crossing.time >= .31) crossing = null;
    }
    if (attack) {
      const faded = attack >= .79;
      attack += dt;
      fade.style.opacity = T.MathUtils.smoothstep(attack, .49, .77);
      if (faded) {
        attack = 0;
        enterArena('boss');
        const launched = window.dispatchEvent(new CustomEvent('demon-duels:launch', {
          detail: { opponentKind, mode: 'chain', returnToMap: true, circle: id,
            ...huntProfile(spotted, watched, descriptor.tells ?? (id === 0 ? undefined : {})) }, cancelable: true,
        }));
        if (!launched) { returnToGate(); show('Finish your current duel first.', 4); }
        return;
      }
    }
    const sneak = crouch || keys.has('ControlLeft') || keys.has('ControlRight');
    sneaking = sneak;
    const running = !sneak && (Math.hypot(touchX, touchY) > .85 || keys.has('ShiftLeft') || keys.has('ShiftRight'));
    const vertical = Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + touchY;
    const horizontal = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + touchX;
    const canWalk = !attack && !block && !climb && !crossing;
    const wantsMove = Math.hypot(vertical, horizontal) > .12 && canWalk;
    const initialX = x, initialZ = z;
    const [fx, fz] = forward(yaw), sx = -fz, sz = fx;
    if (canWalk) {
      const pos = position();
      const traction = rules.tractionAt(pos);
      const speed = wantsMove ? (sneak ? 1.75 : running ? 5.65 : 3.25) * (hooks.speedAt?.(pos) ?? 1) / Math.max(1, Math.hypot(horizontal, vertical)) : 0;
      vx = dampVelocity(vx, (fx * vertical + sx * horizontal) * speed, traction, dt);
      vz = dampVelocity(vz, (fz * vertical + sz * horizontal) * speed, traction, dt);
      const dx = vx * dt, dz = vz * dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
      for (let i = 0; i < steps; i++) {
        const [pushX, pushZ] = peers.separate(x, z, height, dx / steps, dz / steps);
        if (canMoveTo(x + pushX, z)) x += pushX;
        else if (canMoveTo(x + dx / steps, z)) x += dx / steps;
        if (canMoveTo(x, z + pushZ)) z += pushZ;
        else if (canMoveTo(x, z + dz / steps)) z += dz / steps;
      }
      if (initialX !== x || initialZ !== z) facing += angleDelta(facing, Math.atan2(initialX - x, initialZ - z)) * Math.min(dt * 13, 1);
    } else vx = vz = 0;
    const moving = Math.hypot(x - initialX, z - initialZ) > dt * .18;
    if (climb) {
      climb.t += dt;
      const progress = climb.t / climb.duration;
      const lift = T.MathUtils.smoothstep(progress, 0, .68);
      const over = T.MathUtils.smoothstep(progress, .52, 1);
      const land = climb.to.land ?? climb.to.h;
      height = T.MathUtils.lerp(climb.height, climb.to.h + .18, lift) -
        (climb.to.h + .18 - land) * T.MathUtils.smoothstep(progress, .78, 1);
      x = T.MathUtils.lerp(climb.x, climb.to.x, over);
      z = T.MathUtils.lerp(climb.z, climb.to.z, over);
      if (progress >= 1) { height = land; climb = null; }
    } else {
      const floor = mantleSurfaces.reduce((top, roof) => inside(x, z, roof) && roof.h <= height + .05 ? Math.max(top, roof.h) : top, 0);
      if (height > floor || falling < 0) {
        height = Math.max(floor, height - falling * dt - 5.5 * dt * dt);
        falling += dt * 11;
      }
      if (height === floor) falling = 0;
    }
    hunter.root.position.set(x, height, z);
    hunter.root.rotation.y = facing;
    gait = approach(gait, moving ? (sneak ? .39 : running ? 1.14 : .68) : 0, 11, dt);
    bend = approach(bend, sneak && !attack ? 1 : 0, 12, dt);
    step += dt * (moving ? (sneak ? 7 : running ? 12 : 9) : 3);
    hunter.pose(step, gait, bend, Math.min(1, attack / .79), climb ? Math.min(1, climb.t / climb.duration) : falling ? .27 : 0, block / .72);
    const hunterClip = attack ? 'Strike' : block ? 'Block' : climb ? 'Climb' : sneak ? (moving ? 'CrouchWalk' : 'Crouch')
      : moving ? (running ? 'Run' : 'Walk') : 'Idle';
    hunter.model?.update(hunterClip, dt, attack ? .79 : block ? .72 : climb?.duration);
    const pos = position();
    const hidden = rules.concealed(pos, { crouched: sneak }, () => height > 2.35 || sneak && coverZones.some((b) => inside(x, z, b)) &&
      fires.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > 2.05));
    const bossBearing = Math.atan2(boss.x - x, boss.z - z);
    wardenSees = outcome !== 'won' && !attack && rules.detectsBoss(pos, { moving, crouched: sneak, running, concealed: hidden },
      () => sees(sight(boss, pos), x, z, walls, hidden));
    boss.suspicion = T.MathUtils.clamp(boss.suspicion + dt * (wardenSees ? .94 : -.8), 0, 1);
    const bossYaw = wardenSees ? bossBearing : bossConfig.facing + Math.sin(sceneTime * .78) * .81;
    if (!attack) boss.yaw += angleDelta(boss.yaw, bossYaw) * (1 - Math.exp(-dt * (wardenSees ? 3.6 : 1.8)));
    const glance = T.MathUtils.clamp(angleDelta(boss.yaw, bossYaw), -.48, .48);
    warden.root.rotation.y = boss.yaw;
    drawBossCone(sight(boss, pos), outcome !== 'won' && (bossConfig.showCone ?? !hooks.detectsBoss));
    warden.pose(sceneTime * 2.3);
    if (outcome === 'won') {
      victoryTime += dt;
      scenery.raise?.(T.MathUtils.smoothstep(victoryTime, .65, 3.2));
      wardenRig.model?.update('Death', dt);
      warden.root.visible = victoryTime < 3.5 && Boolean(wardenRig.model);
    } else {
      wardenRig.model?.update(wardenSees || boss.suspicion > 0 ? 'Alert' : 'Idle', dt, undefined, glance);
    }
    let suspicion = boss.suspicion, clearTrail = true;
    const investigation = hooks.investigateTargets?.(sceneTime) ?? [];
    for (const guard of guards) {
      guard.update(sceneTime, dt, investigation);
      const { state } = guard;
      const adjusted = sight(state, pos);
      const marked = outcome !== 'won' && !attack && sees(adjusted, x, z, walls, hidden);
      state.suspicion = T.MathUtils.clamp(state.suspicion + dt * (marked ? (sneak ? .68 : running ? 1.95 : 1.32) : -1.05), 0, 1);
      guard.paint({ ...adjusted, suspicion: state.suspicion });
      suspicion = Math.max(suspicion, state.suspicion);
      if (state.suspicion === 1 && !searchGuard) {
        searchGuard = state;
        spotted = true;
        show(copy.alerted ?? 'Spotted — break line of sight.', 2.5);
      }
      if (state === searchGuard && marked) {
        state.pursuit = [x, z];
        alert = 4;
        clearTrail = false;
      }
    }
    if (searchGuard && height < 1.05 && Math.hypot(x - searchGuard.x, z - searchGuard.z) < .62) {
      x = spawn.x; z = spawn.z; yaw = facing = spawn.facing ?? 0; height = spawn.y ?? 0; falling = 0; tilt = .16; crouch = false; climb = null;
      vx = vz = 0;
      for (const { state } of guards) state.suspicion = 0;
      alert = 0;
      show(copy.reset ?? 'Caught. Try the marked ledge or hide in the ash.', 3.5);
    } else if (searchGuard && clearTrail && (alert = Math.max(0, alert - dt)) === 0) {
      cue('lose-trail');
      show('You lost them.', 2.5);
    }
    if (searchGuard && alert === 0) {
      searchGuard.pursuit = null;
      searchGuard = null;
    }
    blockPrompt = !blockLearned && !attack && outcome !== 'won' && Math.abs(height - bossGround) < .3 && Math.hypot(x - boss.x, z - boss.z) < 4.6;
    ready = blockLearned && !block && !attack && !crossing && outcome !== 'won' &&
      rules.canStrikeBoss(position(), { crouched: sneak, alert: alert > 0, colliders: walls }, () => !wardenSees &&
        Math.abs(height - bossGround) < .30 && canStrike(x, z, sight(boss, pos),
          bossGround > 0 ? walls.filter((wall) => wall.h > bossGround) : walls, alert > 0));
    interaction = !ready && !block && !attack && !crossing && !climb && !falling ? rules.interactionAt(position()) : null;
    ledge = !climb && !attack && !falling ? mantleTarget(x, z, height, mantleSurfaces) : null;
    nearbyPeer = peers.update(dt, x, z, height);
    if (now - lastPose >= 90) {
      lastPose = now;
      peers.publish(x, z, height, facing, moving ? (sneak ? 'sneak' : running ? 'sprint' : 'walk') : 'idle');
    }
    if (moving && !falling && sceneTime - lastFootstep > (sneak ? .66 : running ? .24 : .40)) {
      lastFootstep = sceneTime;
      cue('step-stone');
      hooks.onStep?.(position(), { crouched: sneak, running });
    }
    const nextStatus = alert > 0 ? 'alert' : height > 2.35 ? 'roof' : suspicion > .05 ? 'seen' : hidden ? 'hidden' : 'clear';
    if (status !== nextStatus) {
      status = nextStatus;
      emit('world-state', { circle: id, alert: status === 'alert' ? 'alert' : status === 'seen' ? 'suspicious' : 'unaware' });
      if (status === 'seen') { watched = true; cue('detect-suspicious'); }
      if (status === 'alert') cue('detect-alert');
      if (status === 'hidden') cue('hide');
    }
    renderOverlay();
    world.style.setProperty('--ash-suspicion', suspicion.toFixed(3));
    world.style.setProperty('--ash-alert', alert > 0 ? '.32' : (suspicion * .27).toFixed(3));

    strikeFrame = approach(strikeFrame, ready || attack ? 1 : 0, 5, dt);
    const cameraYaw = yaw + angleDelta(yaw, bossBearing + Math.PI) * strikeFrame;
    const [cx, cz] = forward(cameraYaw);
    const dist = 3.28 + 1.05 * strikeFrame;
    const shoulder = (.47 + .66 * strikeFrame) * Math.min(1, camera.aspect / .8);
    pivot.set(x, height + 1.58 - bend * .12, z);
    cameraGoal.set(x - cx * dist - cz * shoulder, height + 1.82 + tilt * 2.68 - bend * .17, z - cz * dist + cx * shoulder);
    const length = pivot.distanceTo(cameraGoal);
    const fraction = cameraSweep(pivot, cameraGoal, cameraBlockers);
    const allowed = Math.max(.035, length * fraction - (fraction < 1 ? .045 : 0));
    boom = boom > allowed ? allowed : approach(boom, allowed, 7, dt);
    camera.position.copy(pivot).lerp(cameraGoal, boom / length);
    focus.set(x + cx * 3 - cz * shoulder * (boom / length), height + 1.59 - tilt * 2.13 - bend * .12, z + cz * 3 + cx * shoulder * (boom / length));
    camera.lookAt(focus);
    camera.updateMatrixWorld();
    peers.drawLabels(camera, !sneaking && !alert && !ready && !ledge && !climb && !attack && nearbyPeer?.id);
    const opacity = T.MathUtils.smoothstep(boom, .4, 1.4);
    if (opacity < 1 || hunterOpacity < 1) {
      hunter.root.traverse((node) => {
        if (!node.isMesh) return;
        const dim = (material) => {
          if (!fadedMaterials.has(material)) fadedMaterials.set(material, { opacity: material.opacity, transparent: material.transparent });
          const original = fadedMaterials.get(material);
          const transparent = original.transparent || opacity < 1;
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          material.opacity = original.opacity * opacity;
        };
        if (Array.isArray(node.material)) node.material.forEach(dim);
        else dim(node.material);
      });
    }
    hunterOpacity = opacity;
    if (flight) flyCard();
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => { keys.clear(); pointer = null; touchX = touchY = 0; });
  function toggleCrouch() { crouch = !crouch; if (crouch) cue('sneak-on'); }
  window.addEventListener('keydown', (e) => {
    if (!active || e.altKey || e.metaKey || e.repeat && e.code === 'Escape') return;
    if (e.code === 'Escape' && menu !== 'loading' && menu !== 'title') {
      e.preventDefault();
      if (!attack) setMenu(menu === 'play' ? 'pause' : 'play');
      return;
    }
    if (menu !== 'play' || !controls.has(e.code)) return;
    useAudio();
    e.preventDefault();
    keys.add(e.code);
    if (!e.repeat && e.code === 'KeyC') toggleCrouch();
    if (!e.repeat && e.code === 'KeyQ') practiceBlock();
    if (!e.repeat && e.code === 'KeyE') useInteract();
    if (!e.repeat && e.code === 'KeyF') challenge();
    if (!e.repeat && e.code === 'Space') jumpOrClimb();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  world.addEventListener('click', (event) => {
    const action = event.target.closest('[data-hunt]')?.dataset.hunt;
    if (action === 'start' || action === 'resume') { useAudio(); setMenu('play'); }
    if (action === 'pause' && !attack) setMenu('pause');
    if (action === 'exit') location.href = '?world=arena';
    if (action === 'guide') setMenu('guide');
    if (action === 'strike') beginStrike();
    if (action === 'interact') useInteract();
    if (action === 'jump') jumpOrClimb();
    if (action === 'block') practiceBlock();
    if (action === 'crouch') toggleCrouch();
    if (action === 'challenge') challenge();
    if (action === 'sound') { audioEnabled = !audioEnabled; useAudio(); emit('mute', { enabled: audioEnabled }); }
    if (action && menu === 'play' && event.detail > 0) focusCanvas();
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || menu !== 'play') return;
    if (pointer) return;
    useAudio();
    focusCanvas();
    pointer = { id: e.pointerId, motion: 0, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer?.id) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    Object.assign(pointer, { x: e.clientX, y: e.clientY, motion: pointer.motion + Math.abs(dx) + Math.abs(dy) });
    if (pointer.motion < 4) return;
    yaw -= dx * .0054;
    tilt = T.MathUtils.clamp(tilt + dy * .0034, -.11, .57);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointer?.id) return;
    if (e.pointerType !== 'touch' && pointer.motion < 4) beginStrike();
    pointer = null;
  });
  canvas.addEventListener('pointercancel', () => { pointer = null; });
  window.addEventListener('demon-duels:mute', ({ detail }) => {
    if (typeof detail?.enabled !== 'boolean') return;
    audioEnabled = detail.enabled;
    if (active) useAudio();
    renderOverlay();
  });
  window.addEventListener('demon-duels:launch', (event) => {
    if (active && !event.defaultPrevented && event.detail?.mode === 'pvp') enterArena('pvp');
  });
  window.addEventListener('demon-duels:duel3d-open', () => {
    duelOpen = true;
    world.hidden = true;
    stopRendering();
  });
  window.addEventListener('demon-duels:duel3d-close', () => {
    duelOpen = false;
    if (active) world.hidden = false;
    startRendering();
  });
  window.addEventListener('demon-duels:settled', ({ detail }) => {
    if (pending === 'boss' && detail?.bossBound && detail.opponentKind === opponentKind) settlement = detail;
  });
  window.addEventListener('demon-duels:finisher-done', ({ detail }) => {
    if (active && detail?.opponentKind === opponentKind && detail.duel) showVictory();
  });
  window.addEventListener('demon-duels:return', ({ detail }) => {
    if (!pending) return;
    const encounter = pending;
    const result = outcomeOnReturn(settlement, detail, opponentKind);
    settlement = null;
    returnToGate();
    if (encounter !== 'boss') return;
    watched = spotted = false;
    if (result === 'won') {
      showVictory();
    } else if (result === 'lost') {
      outcome = 'lost';
      show(copy.defeat ?? (id === 0 ? 'Defeat confirmed. Approach again to challenge the Warden.' : 'Defeat confirmed. Approach again to challenge ' + bossName + '.'));
    } else {
      show(id === 0 ? 'No duel was settled. The Warden is still waiting.' : 'No duel was settled. ' + bossName + ' is still waiting.', 4.5);
    }
  });
  arena.hidden = true;
  setExploring(true, name);
  renderOverlay();
  Promise.race([models, new Promise((resolve) => setTimeout(resolve, 2600))])
    .then(() => setMenu(startInPlay ? 'play' : 'title'));
  setQuality();
  camera.position.set(x + .54, 2.35, z + 3.13);
  startRendering();
}
