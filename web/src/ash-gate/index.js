import * as T from 'three';
import { loadingScreen, pauseMenu, storyPanel, titleScreen, worldHud } from '../game-ui.js';
import { installHuntAudio } from '../world/audio.js';
import { huntProfile } from './encounter.js';
import { figure } from './figures.js';
import { ashHunters, emit } from './hunters.js';
import { installModel } from './models.js';
import { buildGate, cover, limits, roofs, shade } from './scenery.js';
import { ASH_WARDEN, canStrike, inside, mantleTarget, obstruction, outcomeOnReturn, sees } from './stealth.js';
import './style.css';
import '../game-overlays.css';

const TAU = Math.PI * 2;
const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const approach = (value, target, rate, dt) => T.MathUtils.lerp(value, target, 1 - Math.exp(-rate * dt));
const spawn = { x: -.55, z: 12.55 };
const walls = [...cover, ...roofs];
const cameraBlockers = [
  ...walls, { x: -11.9, z: 0, w: 1.45, d: 36, h: 6 }, { x: 11.9, z: 0, w: 1.45, d: 36, h: 6 },
  { x: 0, z: -15.7, w: 24, d: 1.45, h: 8 },
];

function patrol(scene, route, yaw) {
  const actor = figure(scene, 'guard');
  const [x, z] = route[0];
  actor.root.position.set(x, 0, z);
  actor.root.rotation.y = yaw;
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
  const state = { x, z, yaw, range: 6, halfAngle: .44, waypoint: 1, suspicion: 0, pause: 1.2 };

  return {
    state,
    update(t, dt) {
      const [toX, toZ] = route[state.waypoint];
      const dx = toX - state.x, dz = toZ - state.z;
      const dist = Math.hypot(dx, dz);
      state.pause -= dt;
      const moving = state.pause <= 0 && dist > .1;
      if (dist > .1) state.yaw += angleDelta(state.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 3.8);
      if (moving) {
        state.x += dx / dist * dt * 1.46;
        state.z += dz / dist * dt * 1.46;
      } else if (dist <= .1) {
        state.waypoint = (state.waypoint + 1) % route.length;
        state.pause = .7;
      }
      actor.root.position.set(state.x, 0, state.z);
      actor.root.rotation.y = state.yaw;
      actor.pose(t * 7, moving ? .52 : 0);
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
    },
  };
}

export function mountAshGate({ hasAshSeal, setExploring }) {
  const arena = document.getElementById('app');
  const world = document.createElement('section');
  world.className = 'ash-gate';
  world.setAttribute('aria-label', 'Ash Gate, third-person world');
  world.innerHTML = '<div class="ash-shade"></div><div class="ash-overlay"></div>';

  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  world.prepend(renderer.domElement);
  const scene = new T.Scene();
  const peers = ashHunters(scene);
  scene.background = new T.Color(0x232a32);
  scene.fog = new T.FogExp2(0x232a32, .032);
  const camera = new T.PerspectiveCamera(55, 1, .08, 100);
  const animateGate = buildGate(scene);
  const hunter = figure(scene, 'hunter');
  const warden = figure(scene, 'warden');
  const wardenVisual = new T.Group();
  warden.root.add(wardenVisual);
  wardenVisual.scale.setScalar(1 / warden.root.scale.x);
  const wardenRig = { root: wardenVisual, body: warden.body };
  const models = Promise.all([installModel(hunter, 'hunter.glb'), installModel(wardenRig, 'ash-warden.glb')]);
  const boss = { x: 0, z: -11.65, yaw: Math.PI, range: 6.4, halfAngle: .61 };
  warden.root.position.set(boss.x, 0, boss.z);
  warden.root.rotation.y = boss.yaw;
  const guards = [
    patrol(scene, [[.3, 6.2], [6.85, 6.2], [6.85, 2], [-.4, 2], [-.4, 6.2]], -Math.PI / 2),
    patrol(scene, [[-2, -5.5], [3.95, -5.5], [7.9, -5.5], [7.9, -2.75], [-2, -2.75]], -Math.PI / 2),
  ];

  document.body.append(world);
  const arenaTitle = document.title;
  const gateTitle = 'Demon Duels — Ash Gate';
  document.title = gateTitle;
  const canvas = renderer.domElement;
  const overlay = world.querySelector('.ash-overlay');
  const keys = new Set();
  const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyE', 'KeyF', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']);
  const canMoveTo = (x, z) => x > limits.left && x < limits.right && z > limits.far && z < limits.near
    && !walls.some((b) => b.h > height + .03 && inside(x, z, b, .28))
    && (outcome === 'won' || Math.hypot(x - boss.x, z - boss.z) >= .74);
  let x = spawn.x, z = spawn.z, facing = 0, yaw = 0, tilt = .16, height = 0, falling = 0, climb = null, ledge = null;
  let active = true, crouch = false, gait = 0, bend = 0, step = 0, alert = 0, attack = 0;
  let seal = hasAshSeal();
  let ready = false, pending = null, settlement = null, outcome = seal ? 'won' : null, noticeTime = 0, pointer = null;
  let watched = false, spotted = false, nearbyPeer = null, lastPose = -Infinity, lastFootstep = 0;
  let menu = 'loading', status = 'clear', notice = '', rendered = '';
  let audioEnabled = localStorage.getItem('demon-duels:sound') === 'on';
  const audio = installHuntAudio(import.meta.env.BASE_URL, new AbortController().signal);
  const cue = (name) => emit('audio', { cue: name, circle: 0 });
  const useAudio = () => audio.enable(active && audioEnabled);
  if (outcome === 'won') warden.root.visible = false;
  let previous = performance.now(), sceneTime = 0;
  let victoryTime = seal ? 3.5 : 0;
  const focus = new T.Vector3();
  const cameraGoal = new T.Vector3();
  const controlsGuide = 'WASD: move · Drag mouse: look · Shift: sprint\nC or Ctrl: crouch · Space: jump or climb\nE: strike · F: challenge a nearby hunter';
  const button = (action, label, aria = '') => '<button type="button" data-hunt="' + action + '"' + aria + '>' + label + '</button>';
  const exit = button('exit', 'Enter the Pit');

  function renderOverlay() {
    const sound = button('sound', audioEnabled ? 'Sound on' : 'Sound off', ' aria-pressed="' + audioEnabled + '"');
    let html;
    if (menu === 'loading') html = loadingScreen({ label: 'Entering the Underworld', detail: 'Loading Ash Gate' });
    else if (menu === 'title') html = titleScreen({ actions: button('start', 'Enter Ash Gate') + exit + sound });
    else if (menu === 'pause') html = pauseMenu({ actions: button('resume', 'Resume memory') + button('guide', 'Controls') + sound + exit });
    else if (menu === 'guide') html = storyPanel({
      speaker: 'Hunter’s journal', text: controlsGuide, actions: button('resume', 'Resume memory'),
    });
    else {
      const prompt = ready ? { key: 'E', label: 'Strike Ash Warden' } : ledge ? { key: 'Space', label: 'Climb' }
        : nearbyPeer && !attack && !climb && !alert ? { key: 'F', label: 'Challenge ' + (nearbyPeer.name || 'hunter'), action: 'challenge' } : null;
      const objective = outcome === 'won' ? 'The first flame is yours.' : outcome === 'lost' ? 'The Warden still holds the gate.'
        : (z < -6 ? 'Approach the Warden from the flank.' : 'Reach the Warden unseen.');
      html = worldHud({
        objective, seals: Number(seal),
        awareness: status === 'seen' ? 'suspicious' : status === 'alert' ? 'alert' : 'clear',
        prompt, message: notice || (status === 'roof' ? 'Above the patrols' : status === 'hidden' ? 'Hidden in ash' : ''),
        hunters: peers.count(), actions: button('pause', 'Pause <kbd>ESC</kbd>') + exit + sound,
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
    pointer = null;
    audio.circle(menu === 'play' ? 0 : null);
    renderOverlay();
    if (next === 'pause' || next === 'guide') overlay.querySelector('[data-hunt="resume"]')?.focus({ preventScroll: true });
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5, Math.sqrt(1800000 / (window.innerWidth * window.innerHeight))));
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
    show('You took my name. I’m taking your card.');
  }
  function jumpOrClimb() {
    if (climb || attack || alert > 0 || falling) return;
    cue('leap');
    if (!ledge) { falling = -5.2; return; }
    const to = ledge;
    climb = { to, x, z, height, t: 0 };
    facing = Math.atan2(x - to.x, z - to.z);
  }
  function enterArena(kind) {
    pending = kind;
    settlement = null;
    keys.clear();
    active = false;
    peers.leave();
    audio.circle(null);
    world.hidden = true;
    arena.hidden = false;
    setExploring(false);
    document.title = arenaTitle;
    window.scrollTo(0, 0);
  }
  function returnToGate() {
    pending = null;
    active = true;
    lastPose = -Infinity;
    arena.hidden = true;
    world.hidden = false;
    audio.circle(menu === 'play' ? 0 : null);
    useAudio();
    setExploring(true);
    document.title = gateTitle;
  }
  function showVictory() {
    if (seal || !hasAshSeal()) return;
    outcome = 'won';
    seal = true;
    cue('gate-open');
    show('One rune returns. It remembers you.');
  }
  function challenge() {
    if (active && menu === 'play' && nearbyPeer) emit('challenge-hunter', { id: nearbyPeer.id });
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, .1);
    previous = now;
    if (!active || document.hidden) return;
    sceneTime += dt;
    animateGate(sceneTime, dt);
    if (menu === 'loading' || menu === 'title') {
      const orbit = Math.sin(sceneTime * .22);
      camera.position.set(-.6 + orbit * .65, 2.35 + .14 * orbit, 15.25);
      camera.lookAt(-1.05, 1.2, -8);
      hunter.root.position.set(1.25, 0, 11.68);
      hunter.root.rotation.y = -.18;
      hunter.pose(sceneTime * 2.4);
      hunter.model?.update('Idle', dt);
      wardenRig.model?.update('Idle', dt);
      renderer.render(scene, camera);
      return;
    }
    if (menu !== 'play') return;
    if (noticeTime > 0 && (noticeTime -= dt) <= 0) show('');
    if (alert > 0 && (alert -= dt) <= 0) {
      x = spawn.x; z = spawn.z; yaw = facing = height = falling = 0; tilt = .16; crouch = false; climb = null;
      for (const guard of guards) guard.state.suspicion = 0;
      cue('lose-trail');
      show('Back at the threshold. Use stone and ash for cover.', 3.5);
    }
    if (attack) {
      attack += dt;
      if (attack >= .79) {
        attack = 0;
        enterArena('boss');
        const launched = window.dispatchEvent(new CustomEvent('demon-duels:launch', {
          detail: { ...ASH_WARDEN, ...huntProfile(spotted, watched) }, cancelable: true,
        }));
        if (!launched) { returnToGate(); show('Finish your current duel first.', 4); }
        return;
      }
    }
    const sneak = crouch || keys.has('ControlLeft') || keys.has('ControlRight');
    const running = !sneak && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
    const vertical = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const horizontal = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const moving = Boolean(vertical || horizontal) && !attack && !climb && alert <= 0;
    const [fx, fz] = forward(yaw), sx = -fz, sz = fx;
    if (moving) {
      const speed = (sneak ? 1.75 : running ? 5.65 : 3.25) * dt / Math.hypot(horizontal, vertical);
      const dx = (fx * vertical + sx * horizontal) * speed;
      const dz = (fz * vertical + sz * horizontal) * speed;
      if (canMoveTo(x + dx, z)) x += dx;
      if (canMoveTo(x, z + dz)) z += dz;
      facing += angleDelta(facing, Math.atan2(-dx, -dz)) * Math.min(dt * 13, 1);
    }
    if (climb) {
      climb.t += dt;
      const lift = T.MathUtils.smoothstep(climb.t, 0, .63);
      const over = T.MathUtils.smoothstep(climb.t, .44, .82);
      height = T.MathUtils.lerp(climb.height, climb.to.h + .16, lift) - .16 * over;
      x = T.MathUtils.lerp(climb.x, climb.to.x, over);
      z = T.MathUtils.lerp(climb.z, climb.to.z, over);
      if (climb.t >= .82) { height = climb.to.h; climb = null; }
    } else {
      const floor = roofs.reduce((top, roof) => inside(x, z, roof) && roof.h <= height + .05 ? Math.max(top, roof.h) : top, 0);
      falling = height > floor || falling < 0 ? falling + dt * 11 : 0;
      height = Math.max(floor, height - falling * dt);
      if (height === floor) falling = 0;
    }
    hunter.root.position.set(x, height, z);
    hunter.root.rotation.y = facing;
    gait = approach(gait, moving ? (sneak ? .39 : running ? 1.14 : .68) : 0, 11, dt);
    bend = approach(bend, sneak && !attack ? 1 : 0, 12, dt);
    step += dt * (moving ? (sneak ? 7 : running ? 12 : 9) : 3);
    hunter.pose(step, gait, bend, Math.min(1, attack / .79), climb ? Math.min(1, climb.t / .82) : falling ? .27 : 0);
    const hunterClip = attack ? 'Strike' : climb ? 'Climb' : sneak ? (moving ? 'CrouchWalk' : 'Crouch')
      : moving ? (running ? 'Run' : 'Walk') : 'Idle';
    hunter.model?.update(hunterClip, dt, attack ? .79 : climb ? .82 : undefined);
    warden.pose(sceneTime * 2.3);
    if (outcome === 'won') {
      victoryTime += dt;
      wardenRig.model?.update('Death', dt);
      warden.root.visible = victoryTime < 3.5 && Boolean(wardenRig.model);
    } else {
      wardenRig.model?.update(alert > 0 ? 'Alert' : 'Idle', dt);
    }
    const hidden = height > 2.35 || sneak && shade.some((b) => inside(x, z, b));
    let suspicion = 0;
    for (const guard of guards) {
      guard.update(sceneTime, dt);
      const { state } = guard;
      const marked = outcome !== 'won' && !attack && sees(state, x, z, walls, hidden);
      state.suspicion = T.MathUtils.clamp(state.suspicion + dt * (marked ? (sneak ? .68 : running ? 1.95 : 1.32) : -1.05), 0, 1);
      suspicion = Math.max(suspicion, state.suspicion);
    }
    if (suspicion === 1 && alert <= 0) {
      alert = .95;
      spotted = true;
      show('Spotted — fall back.');
    }
    ready = !attack && height < .30 && outcome !== 'won' && canStrike(x, z, boss, walls, alert > 0);
    ledge = !climb && !attack && !falling && alert <= 0 ? mantleTarget(x, z, height, roofs) : null;
    nearbyPeer = peers.update(sceneTime, x, z, height);
    if (now - lastPose >= 90) {
      lastPose = now;
      peers.publish(x, z, height, facing, moving ? (sneak ? 'sneak' : running ? 'sprint' : 'walk') : 'idle');
    }
    if (moving && !falling && sceneTime - lastFootstep > (sneak ? .66 : running ? .24 : .40)) {
      lastFootstep = sceneTime;
      cue('step-stone');
    }
    const nextStatus = alert > 0 ? 'alert' : height > 2.35 ? 'roof' : suspicion > .05 ? 'seen' : hidden ? 'hidden' : 'clear';
    if (status !== nextStatus) {
      status = nextStatus;
      emit('world-state', { circle: 0, alert: status === 'alert' ? 'alert' : status === 'seen' ? 'suspicious' : 'unaware' });
      if (status === 'seen') { watched = true; cue('detect-suspicious'); }
      if (status === 'alert') cue('detect-alert');
      if (status === 'hidden') cue('hide');
    }
    renderOverlay();
    world.style.setProperty('--ash-alert', alert > 0 ? '.32' : (suspicion * .27).toFixed(3));

    const dist = 3.28;
    const desiredX = x - fx * dist + sx * .54, desiredZ = z - fz * dist + sz * .54;
    const fraction = Math.max(.21, obstruction(x, z, desiredX, desiredZ, cameraBlockers.filter((b) => b.h > height + 1.32), .14) - .037);
    cameraGoal.set(T.MathUtils.lerp(x, desiredX, fraction), height + 1.82 + tilt * 2.68 - bend * .17, T.MathUtils.lerp(z, desiredZ, fraction));
    camera.position.lerp(cameraGoal, Math.min(dt * 17, 1));
    focus.set(x + fx * 3 + sx * .54, height + 1.59 - tilt * 2.13 - bend * .12, z + fz * 3 + sz * .54);
    camera.lookAt(focus);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => { keys.clear(); pointer = null; });
  window.addEventListener('keydown', (e) => {
    if (!active || e.altKey || e.metaKey || e.repeat && e.code === 'Escape') return;
    if (e.code === 'Escape' && menu !== 'loading' && menu !== 'title') {
      e.preventDefault();
      if (!attack) setMenu(menu === 'play' ? 'pause' : 'play');
      return;
    }
    if (menu !== 'play' || !controls.has(e.code) || e.code === 'Space' && e.target.closest?.('button, a')) return;
    useAudio();
    e.preventDefault();
    keys.add(e.code);
    if (!e.repeat && e.code === 'KeyC') { crouch = !crouch; if (crouch) cue('sneak-on'); }
    if (!e.repeat && e.code === 'KeyE') beginStrike();
    if (!e.repeat && e.code === 'KeyF') challenge();
    if (!e.repeat && e.code === 'Space') jumpOrClimb();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  overlay.addEventListener('click', (event) => {
    const action = event.target.closest('[data-hunt]')?.dataset.hunt;
    if (action === 'start' || action === 'resume') { useAudio(); setMenu('play'); }
    if (action === 'pause' && !attack) setMenu('pause');
    if (action === 'exit') location.href = '?world=arena';
    if (action === 'guide') setMenu('guide');
    if (action === 'strike') beginStrike();
    if (action === 'challenge') challenge();
    if (action === 'sound') { audioEnabled = !audioEnabled; useAudio(); emit('mute', { enabled: audioEnabled }); }
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || menu !== 'play') return;
    useAudio();
    pointer = { id: e.pointerId, motion: 0 };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer?.id) return;
    const motion = Math.abs(e.movementX) + Math.abs(e.movementY);
    pointer.motion += motion;
    if (pointer.motion < 4) return;
    yaw -= e.movementX * .0054;
    tilt = T.MathUtils.clamp(tilt + e.movementY * .0034, -.11, .57);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId === pointer?.id && pointer.motion < 4) beginStrike();
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
  window.addEventListener('demon-duels:settled', ({ detail }) => {
    if (pending === 'boss' && detail?.bossBound && detail.opponentKind === ASH_WARDEN.opponentKind) settlement = detail;
  });
  window.addEventListener('demon-duels:finisher-done', ({ detail }) => {
    if (active && detail?.opponentKind === ASH_WARDEN.opponentKind && detail.duel) showVictory();
  });
  window.addEventListener('demon-duels:duel3d-close', ({ detail }) => {
    if (pending && detail?.tutorialCancelled) returnToGate();
  });
  window.addEventListener('demon-duels:return', ({ detail }) => {
    if (!pending) return;
    const encounter = pending;
    const result = outcomeOnReturn(settlement, detail);
    settlement = null;
    returnToGate();
    if (encounter !== 'boss') return;
    watched = spotted = false;
    if (result === 'won') {
      showVictory();
    } else if (result === 'lost') {
      outcome = 'lost';
      show('Defeat confirmed. Approach again to challenge the Warden.');
    } else {
      show('No duel was settled. The Warden is still waiting.', 4.5);
    }
  });
  arena.hidden = true;
  setExploring(true);
  renderOverlay();
  Promise.race([models, new Promise((resolve) => setTimeout(resolve, 2600))])
    .then(() => setMenu('title'));
  resize();
  camera.position.set(x + .54, 2.35, z + 3.13);
  requestAnimationFrame(frame);
}
