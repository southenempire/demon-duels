import { TILE } from './levels.js';
import { behind, canSee, clamp, contains, detection, distance, follow, hears, move, rayDistance, threat } from './stealth.js';

const spawnWatcher = (config, soundOnly = false) => ({
  ...config, ...config.path[0], soundOnly, next: 1, meter: 0, unseenFor: 4, alert: false, last: null,
  angle: Math.atan2(config.path[1].y - config.path[0].y, config.path[1].x - config.path[0].x),
});

export function advancePit(hunter, dx, dy, dt) {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude) {
    const speed = 4 * TILE * dt / magnitude;
    hunter.x = clamp(hunter.x + dx * speed, TILE, 15 * TILE);
    hunter.y = clamp(hunter.y + dy * speed, 2.5 * TILE, 7.5 * TILE);
    hunter.angle = Math.atan2(dy, dx);
  }
  hunter.anim = magnitude ? 'walk' : 'idle';
}

export function newRun(level, intel = [], synced = false, checkpoint = level.start) {
  return {
    hunter: { ...checkpoint, angle: 0, noise: 0, hidden: false, sight: false, vx: 0, vy: 0, anim: 'idle' },
    guards: level.patrols.map((guard) => spawnWatcher(guard)),
    boss: spawnWatcher(level.boss, level.boss.hearing > 1),
    lights: level.lights.map((light) => ({ ...light, doused: false })),
    embers: [], intel: [...intel], synced, checkpoint,
    suspicious: false, alerted: false, marked: false, watch: 'unaware', meter: 0,
  };
}

function illumination(level, run, hunter) {
  if (hunter.hidden) return 0;
  const lit = run.lights.some((light) => !light.doused && distance(light, hunter) < light.r &&
    hears(light, hunter, level.walls, light.r));
  return lit ? 2 : level.id === 0 || level.id === 1 ? 0 : 1;
}

export function advance(level, run, input, dt, now) {
  const { hunter, boss, guards } = run;
  const { dx, dy, sneak, sprint, sight } = input;
  const surface = (name) => level.surfaces[name]?.some((area) => contains(area, hunter));
  const speed = (sneak ? 92 : sprint ? 224 : 154) * (sight ? 0.5 : 1) * (surface('water') ? 0.5 : 1);
  const strength = Math.max(1, Math.hypot(dx, dy));
  const original = { x: hunter.x, y: hunter.y };
  const ease = 1 - Math.exp(-dt * (dx || dy ? 15 : 20));
  hunter.vx += (dx * speed / strength - hunter.vx) * ease;
  hunter.vy += (dy * speed / strength - hunter.vy) * ease;
  if (Math.abs(hunter.vx) < 2) hunter.vx = 0;
  if (Math.abs(hunter.vy) < 2) hunter.vy = 0;
  move(hunter, hunter.vx * dt, hunter.vy * dt, level);
  hunter.moving = distance(hunter, original) > 0.01;
  if (dx || dy) hunter.angle = Math.atan2(dy, dx);
  hunter.hidden = level.cover.some((area) => contains(area, hunter)) || (sneak && surface('water'));
  hunter.noise = hunter.moving ? TILE * (sneak ? 1 : sprint ? 6 : 3) * (surface('bone') ? 1.5 : surface('water') ? 0.5 : 1) : 0;
  hunter.sight = sight;
  hunter.anim = now < (hunter.takedownUntil ?? 0) ? 'takedown' : hunter.moving ?
    (sneak ? 'sneak' : sprint ? 'sprint' : 'walk') : hunter.hidden ? 'hide' : 'idle';
  run.embers = run.embers.filter(({ until }) => now < until);
  const light = illumination(level, run, hunter);
  run.meter = 0;
  run.watch = 'unaware';
  for (const guard of [...guards, boss]) {
    const visible = !guard.soundOnly && canSee(guard, hunter, level.walls);
    const audible = hears(guard, hunter, level.walls, hunter.noise * (guard.hearing ?? 1));
    const previous = threat(guard.meter, guard.alert);
    guard.unseenFor = visible || audible ? 0 : guard.unseenFor + dt;
    guard.meter = detection(guard.meter, dt, visible, audible, light, guard.unseenFor);
    if (guard.meter >= 100 || (guard === boss && run.marked)) guard.alert = true;
    else if (guard.meter < 30) guard.alert = false;
    if (visible || audible) guard.last = { x: hunter.x, y: hunter.y };
    const state = threat(guard.meter, guard.alert);
    run.meter = Math.max(run.meter, guard.meter);
    if (state === 'alert') { run.alerted = true; run.watch = 'alert'; }
    else if (state === 'suspicious') {
      run.suspicious = true;
      if (run.watch !== 'alert') run.watch = 'suspicious';
    }
    const ember = state === 'unaware' ? run.embers.find((e) => hears(guard, e, level.walls, TILE * 5)) : null;
    const target = state === 'unaware' ? ember : guard.last;
    if (target) {
      if (follow(guard, target, dt, guard.alert ? guard === boss ? 118 : 168 : guard.speed, level)) {
        if (guard.alert) guard.last = null;
      }
    } else if (!(guard === boss && guard.alert)) {
      if (follow(guard, guard.path[guard.next], dt, guard.speed, level)) guard.next = (guard.next + 1) % guard.path.length;
    }
    if (guard !== boss && guard.alert && distance(guard, hunter) < 19 &&
        hears(guard, hunter, level.walls, 20)) return { caught: true };
    if (previous !== 'alert' && state === 'alert') run.alerted = true;
  }
  return { caught: false, surface: ['bone', 'water', 'snow'].find(surface) ?? 'stone' };
}

export function interaction(level, run, peers) {
  const { hunter, boss } = run;
  if (distance(boss, hunter) <= boss.strikeRadius && hears(boss, hunter, level.walls, boss.strikeRadius + 1) &&
      (boss.soundOnly || boss.alert || behind(boss, hunter))) {
    return { name: 'strike', label: boss.alert ? 'Duel in the open' : 'Strike' };
  }
  const guard = run.guards.find((guard) => guard.meter < 30 && !guard.alert && distance(guard, hunter) < 34 &&
    (hunter.hidden || behind(guard, hunter)) && hears(guard, hunter, level.walls, 35));
  if (guard) return { name: 'takedown', label: 'Takedown', target: guard };
  const scroll = level.intel.find((entry) => !run.intel.includes(entry.id) && distance(entry, hunter) < 36);
  if (scroll) return { name: 'intel', label: 'Read intel', target: scroll };
  if (distance(level.vantage, hunter) < 38 && !run.synced) return { name: 'vantage', label: 'Climb & sync' };
  const light = run.lights.find((entry) => entry.douseable && !entry.doused && distance(entry, hunter) < 36);
  if (light) return { name: 'douse', label: 'Douse brazier', target: light };
  const tear = level.tears.findIndex((entry) => distance(entry, hunter) < 31);
  if (tear >= 0) return { name: 'tear', label: 'Enter void tear', target: level.tears[1 - tear] };
  const peer = peers.find((entry) => !entry.busy && distance(entry, hunter) <= TILE * 1.5);
  if (peer) return { name: 'challenge', label: 'Challenge ' + peer.name, target: peer };
  return null;
}

export function throwEmber(level, run, now) {
  if (run.embers.length) return false;
  const { hunter } = run;
  const reach = rayDistance(hunter, hunter.angle, TILE * 5, level.walls);
  const length = Math.max(0, reach - 5);
  run.embers.push({
    x: clamp(hunter.x + length * Math.cos(hunter.angle), 0, level.width),
    y: clamp(hunter.y + length * Math.sin(hunter.angle), 0, level.height),
    until: now + 1550,
  });
  return true;
}
