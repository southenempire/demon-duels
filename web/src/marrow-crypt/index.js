import * as T from 'three';
import { figure } from '../ash-gate/figures.js';
import { emit } from '../ash-gate/hunters.js';
import { installModel } from '../ash-gate/models.js';
import { inside, obstruction, sees } from '../ash-gate/stealth.js';
import { loadingScreen, pauseMenu, storyPanel, worldHud } from '../game-ui.js';
import { installHuntAudio } from '../world/audio.js';
import { citadelGuard } from './patrol.js';
import { buildCitadel } from './scenery.js';
import { MARROW_KING, boss, crowdCover, heardOnBone, limits, nextLedge, obstacles, patrols, roofs, spawn, strikeFrom, watchMarrowClear } from './stealth.js';
import '../game-overlays.css';
import './style.css';

const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
const cameraWalls = [...obstacles, { x: -10.65, z: 0, w: 1.15, d: 31, h: 7.6 },
  { x: 10.65, z: 0, w: 1.15, d: 31, h: 7.6 }, { x: 0, z: -14.75, w: 22, d: 1.25, h: 8.8 }];
const directions = new Map([
  ['KeyW', [0, 1]], ['ArrowUp', [0, 1]], ['KeyS', [0, -1]], ['ArrowDown', [0, -1]],
  ['KeyD', [1, 0]], ['ArrowRight', [1, 0]], ['KeyA', [-1, 0]], ['ArrowLeft', [-1, 0]],
]);
const controls = new Set([...directions.keys(), 'KeyC', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']);
const button = (action, label) => '<button type="button" data-hunt="' + action + '">' + label + '</button>';
const courtTitle = 'Demon Duels — Bone Citadel';
const routeHint = 'Blend with the court on the left, then climb the bone roofs to the throne.';

export function mountMarrowCrypt({ setExploring = () => {}, hasSeal = () => false } = {}) {
  const arena = document.getElementById('app');
  const world = document.createElement('section');
  world.className = 'marrow-crypt';
  world.setAttribute('aria-label', 'Bone Citadel, third-person world');
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  const canvas = renderer.domElement;
  const overlay = document.createElement('div');
  overlay.className = 'marrow-overlay';
  world.append(canvas, overlay);

  const scene = new T.Scene();
  scene.background = new T.Color(0x292338);
  scene.fog = new T.FogExp2(0x292338, .038);
  const camera = new T.PerspectiveCamera(55, 1, .08, 90);
  const cameraGoal = new T.Vector3(), focus = new T.Vector3();
  const courtiers = buildCitadel(scene);
  const hunter = figure(scene, 'hunter');
  const king = figure(scene, 'warden', 0x65395c);
  const kingVisual = new T.Group();
  kingVisual.scale.setScalar(1 / king.root.scale.x);
  king.root.add(kingVisual);
  const kingRig = { root: kingVisual, body: king.body };
  king.root.position.set(boss.x, 0, boss.z);
  king.root.rotation.y = boss.yaw;
  const guards = patrols.map((route) => citadelGuard(scene, route));
  const models = Promise.all([installModel(hunter, 'hunter.glb'), installModel(kingRig, 'marrow-king.glb')]);

  const { signal } = new AbortController();
  const audio = installHuntAudio(import.meta.env.BASE_URL, signal);
  const cue = (name) => emit('audio', { cue: name, circle: MARROW_KING.opponentKind });
  const keys = new Set();
  const confirmation = watchMarrowClear();
  const previousTitle = document.title;
  let active = true, pending = false, cleared = hasSeal(MARROW_KING.opponentKind);
  let menu = 'loading', message = '', rendered = '', pointer = null;
  let x = spawn.x, z = spawn.z, yaw = 0, facing = 0, tilt = .12, height = 0, rise = 0;
  let crouch = false, blended = false, ledge = null, climb = null, striking = 0, strike = null;
  let previous = performance.now(), time = 0, reset = 0, stepAt = 0, awareness = 'clear';
  let muted = localStorage.getItem('demon-duels:sound') !== 'on';
  king.root.visible = !cleared;

  function renderOverlay() {
    const exit = button('exit', 'Return to campaign');
    const sound = button('sound', muted ? 'Sound off' : 'Sound on');
    const prompt = striking || reset ? null : strike ? { key: 'E', label: strike === 'above' ? 'Strike from above' : 'Strike Marrow King' }
      : ledge ? { key: 'Space', label: 'Climb' } : null;
    const html = menu === 'loading' ? loadingScreen({ label: 'Entering the Underworld', detail: 'Loading Bone Citadel' })
      : menu === 'intro' ? storyPanel({
        speaker: 'III / BONE CITADEL', text: 'A palace built of challengers. Mind where you step. The floors talk.',
        actions: button('resume', 'Enter the Court') + exit,
      })
      : menu === 'pause' ? pauseMenu({ actions: button('resume', 'Resume memory') + sound + exit })
      : worldHud({
        location: 'Bone Citadel', chapter: 'III / THE UNDERWORLD', seals: cleared ? 3 : 2, awareness, prompt,
        objective: cleared ? 'The crown has fallen.' : blended ? 'Blended with the court. Stay low to reach the roofs.' : routeHint, message,
        actions: button('pause', 'Pause · Esc') + exit,
      });
    if (html !== rendered) { rendered = html; overlay.innerHTML = html; }
  }

  function activate(value) {
    if (!value) {
      keys.clear();
      pointer = null;
    }
    active = value;
    world.hidden = !value;
    arena.hidden = value;
    document.title = value ? courtTitle : previousTitle;
    setExploring(value);
    audio.enable(value && !muted);
    audio.circle(value && menu === 'play' ? MARROW_KING.opponentKind : null);
  }

  function resumeWorld() {
    if (active) return;
    if (pending && !cleared) message = 'The King still holds court. Approach again to strike.';
    pending = false;
    activate(true);
    renderOverlay();
  }

  function beginStrike() {
    if (!active || menu !== 'play' || cleared || striking || !strike) return;
    striking = .001;
    facing = Math.atan2(x - boss.x, z - boss.z);
    message = 'I’m not here for the throne. Just the crown.';
    cue('strike');
  }

  function launch() {
    pending = true;
    confirmation.reset();
    activate(false);
    const accepted = window.dispatchEvent(new CustomEvent('demon-duels:launch', { detail: { ...MARROW_KING }, cancelable: true }));
    if (!accepted) {
      resumeWorld();
      message = 'Finish or cancel your current duel before striking the King.';
      renderOverlay();
    }
  }

  function moveOrClimb() {
    if (striking || reset || climb || rise || !active) return;
    cue('leap');
    if (!ledge) { rise = 5; return; }
    climb = { x, z, height, to: ledge, elapsed: 0 };
    facing = Math.atan2(x - ledge.x, z - ledge.z);
  }

  function stepHunter(dt, sneak, running) {
    let horizontal = 0, vertical = 0;
    for (const code of keys) {
      const movement = directions.get(code);
      if (movement) { horizontal += movement[0]; vertical += movement[1]; }
    }
    horizontal = Math.sign(horizontal);
    vertical = Math.sign(vertical);
    const moving = Boolean((horizontal || vertical) && !climb && !reset && !striking);
    if (moving) {
      const [fx, fz] = forward(yaw);
      const speed = dt * (sneak ? 1.72 : running ? 5.55 : 3.2) / Math.hypot(horizontal, vertical);
      const dx = (fx * vertical - fz * horizontal) * speed, dz = (fz * vertical + fx * horizontal) * speed;
      const passable = (xx, zz) => xx > limits.left && xx < limits.right && zz > limits.far && zz < limits.near
        && !obstacles.some((wall) => wall.h > height + .03 && inside(xx, zz, wall, .25))
        && (cleared || height > 2.75 || Math.hypot(xx - boss.x, zz - boss.z) >= .75);
      if (passable(x + dx, z)) x += dx;
      if (passable(x, z + dz)) z += dz;
      const delta = Math.atan2(-dx, -dz) - facing;
      facing += Math.atan2(Math.sin(delta), Math.cos(delta)) * Math.min(dt * 13, 1);
    }
    if (climb) {
      climb.elapsed += dt;
      const lift = T.MathUtils.smoothstep(climb.elapsed, 0, .6);
      const over = T.MathUtils.smoothstep(climb.elapsed, .43, .83);
      height = T.MathUtils.lerp(climb.height, climb.to.h + .15, lift) - .15 * over;
      x = T.MathUtils.lerp(climb.x, climb.to.x, over);
      z = T.MathUtils.lerp(climb.z, climb.to.z, over);
      if (climb.elapsed >= .83) { height = climb.to.h; climb = null; }
    } else {
      const floor = roofs.reduce((top, roof) => height + .03 >= roof.h && inside(x, z, roof) ? Math.max(top, roof.h) : top, 0);
      if (height > floor || rise) {
        rise -= dt * 13;
        height = Math.max(floor, height + rise * dt);
        if (height === floor && rise < 0) rise = 0;
      }
    }
    hunter.root.position.set(x, height, z);
    hunter.root.rotation.y = facing;
    hunter.pose(time * (running ? 11 : 7), moving ? (sneak ? .4 : running ? 1.15 : .7) : 0,
      sneak ? 1 : 0, striking / .79, climb ? climb.elapsed / .83 : rise ? .27 : 0);
    const clip = striking ? 'Strike' : climb ? 'Climb' : sneak ? (moving ? 'CrouchWalk' : 'Crouch')
      : moving ? (running ? 'Run' : 'Walk') : 'Idle';
    hunter.model?.update(clip, dt, striking ? .79 : climb ? .83 : undefined);
    if (moving && !rise && time >= stepAt) {
      stepAt = time + (sneak ? .65 : running ? .24 : .4);
      cue('step-stone');
    }
    return moving ? (sneak ? 'sneak' : running ? 'sprint' : 'walk') : 'idle';
  }

  function updateStealth(dt, gait) {
    let danger = 0;
    for (const guard of guards) {
      guard.update(dt, time);
      const { state } = guard;
      if (cleared || striking || reset) continue;
      const concealed = blended && Math.hypot(x - state.x, z - state.z) > 1;
      const visible = height < 1.2 && sees(state, x, z, obstacles, concealed);
      const audible = heardOnBone(state, x, z, height, gait);
      state.suspicion = T.MathUtils.clamp(state.suspicion + dt * (visible ? 1.3 : audible ? .48 : -.69), 0, 1);
      danger = Math.max(danger, state.suspicion);
    }
    if (danger >= 1 && !reset) {
      reset = .9;
      message = 'Uninvited guest! Back to the threshold.';
      cue('detect-alert');
    }
    const status = reset ? 'alert' : danger >= .3 ? 'suspicious' : 'clear';
    if (status === awareness) return;
    awareness = status;
    if (status === 'suspicious') cue('detect-suspicious');
    emit('world-state', { circle: MARROW_KING.opponentKind, alert: status === 'clear' ? 'unaware' : status });
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.065, (now - previous) / 1000);
    previous = now;
    if (!active || document.hidden) return;
    if (menu === 'play') {
      time += dt;
      if (reset && (reset -= dt) <= 0) {
        x = spawn.x; z = spawn.z; height = rise = yaw = facing = reset = 0;
        crouch = false; climb = null;
        for (const guard of guards) guard.state.suspicion = 0;
        message = 'Bone carries sound. Crouch in the court or take the catwalks.';
        cue('lose-trail');
      }
      if (striking && (striking += dt) >= .79) {
        striking = 0;
        launch();
        return;
      }
      const sneak = crouch || keys.has('ControlLeft') || keys.has('ControlRight');
      const running = !sneak && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
      const gait = stepHunter(dt, sneak, running);
      blended = crowdCover(x, z, height, sneak);
      updateStealth(dt, gait);
      king.pose(time * 2.2);
      kingRig.model?.update(reset ? 'Alert' : 'Idle', dt);
      courtiers.forEach((actor, i) => actor.pose(time * 2.1 + i * .5));
      strike = !cleared && !climb && !rise && !striking ? strikeFrom(x, z, height, reset) : null;
      ledge = !climb && !rise && !striking && !reset ? nextLedge(x, z, height) : null;
    }
    const [fx, fz] = forward(yaw), sx = -fz;
    const desiredX = x - fx * 3.65 + sx * .57, desiredZ = z - fz * 3.65 + fx * .57;
    const fraction = Math.max(.21, obstruction(x, z, desiredX, desiredZ, cameraWalls.filter((wall) => wall.h > height + 1.3), .13) - .036);
    cameraGoal.set(T.MathUtils.lerp(x, desiredX, fraction), height + 1.98 + tilt * 2.7, T.MathUtils.lerp(z, desiredZ, fraction));
    camera.position.lerp(cameraGoal, Math.min(dt * 17, 1));
    focus.set(x + fx * 3 + sx * .56, height + 1.67 - tilt * 2.1, z + fz * 3 + fx * .56);
    camera.lookAt(focus);
    renderOverlay();
    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5, Math.sqrt(1800000 / (innerWidth * innerHeight))));
    renderer.setSize(innerWidth, innerHeight);
  }

  window.addEventListener('resize', resize, { signal });
  window.addEventListener('blur', () => { keys.clear(); pointer = null; }, { signal });
  window.addEventListener('keydown', (event) => {
    if (!active || event.metaKey || event.altKey) return;
    if (event.code === 'Escape' && !event.repeat && !striking && (menu === 'play' || menu === 'pause')) {
      event.preventDefault();
      menu = menu === 'play' ? 'pause' : 'play';
      keys.clear();
      renderOverlay();
    }
    if (menu !== 'play' || !controls.has(event.code) || event.code === 'Space' && event.target.closest?.('button')) return;
    event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyC') { crouch = !crouch; if (crouch) cue('sneak-on'); }
    if (event.code === 'KeyE') beginStrike();
    if (event.code === 'Space') moveOrClimb();
  }, { signal });
  window.addEventListener('keyup', (event) => keys.delete(event.code), { signal });
  overlay.addEventListener('click', (event) => {
    const action = event.target.closest('[data-hunt]')?.dataset.hunt;
    if (action === 'resume') {
      menu = 'play';
      activate(true);
    } else if (action === 'pause' && !striking) {
      menu = 'pause';
      keys.clear();
    } else if (action === 'sound') {
      muted = !muted;
      audio.enable(!muted);
      emit('mute', { enabled: !muted });
    } else if (action === 'exit') {
      location.href = '?world=campaign';
    } else if (action === 'strike') {
      beginStrike();
    }
    renderOverlay();
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || menu !== 'play') return;
    pointer = { id: event.pointerId, moved: 0 };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (pointer?.id !== event.pointerId) return;
    pointer.moved += Math.abs(event.movementX) + Math.abs(event.movementY);
    if (pointer.moved < 4) return;
    yaw -= event.movementX * .0054;
    tilt = T.MathUtils.clamp(tilt + event.movementY * .0034, -.13, .55);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (pointer?.id === event.pointerId && pointer.moved < 4) beginStrike();
    pointer = null;
  });
  canvas.addEventListener('pointercancel', () => { pointer = null; });
  window.addEventListener('demon-duels:duel3d-open', () => { if (active) activate(false); }, { signal });
  window.addEventListener('demon-duels:duel3d-close', resumeWorld, { signal });
  window.addEventListener('demon-duels:return', resumeWorld, { signal });
  window.addEventListener('demon-duels:settled', ({ detail }) => {
    if (pending) confirmation.settle(detail);
  }, { signal });
  window.addEventListener('demon-duels:finisher-done', ({ detail }) => {
    if (!confirmation.finish(detail)) return;
    cleared = true;
    king.root.visible = false;
    message = 'The crown falls. The dead make way for the living.';
    cue('gate-open');
    renderOverlay();
  }, { signal });
  window.addEventListener('demon-duels:mute', ({ detail }) => {
    if (typeof detail?.enabled !== 'boolean') return;
    muted = !detail.enabled;
    audio.enable(active && !muted);
    renderOverlay();
  }, { signal });
  arena.after(world);
  activate(true);
  renderOverlay();
  resize();
  camera.position.set(x + .57, 2.3, z + 3.65);
  hunter.root.position.set(x, 0, z);
  Promise.race([models, new Promise((resolve) => setTimeout(resolve, 2600))]).then(() => {
    menu = 'intro';
    renderOverlay();
  });
  requestAnimationFrame(frame);
}
