export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const contains = (rect, point) => point.x >= rect.x && point.x <= rect.x + rect.w &&
  point.y >= rect.y && point.y <= rect.y + rect.h;
export const HUNTER_RADIUS = 10;

export function rayDistance(from, angle, range, walls) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return walls.reduce((nearest, wall) => {
    let near = 0;
    let far = nearest;
    for (const [origin, dir, lo, hi] of [[from.x, dx, wall.x, wall.x + wall.w], [from.y, dy, wall.y, wall.y + wall.h]]) {
      if (Math.abs(dir) < 1e-8) {
        if (origin < lo || origin > hi) return nearest;
      } else {
        const a = (lo - origin) / dir;
        const b = (hi - origin) / dir;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (far < near) return nearest;
      }
    }
    return near;
  }, range);
}

export function canSee(guard, hunter, walls, tileSize = 32) {
  const gap = distance(guard, hunter);
  if (gap > guard.range || (hunter.hidden && gap > tileSize)) return false;
  const angle = Math.atan2(hunter.y - guard.y, hunter.x - guard.x);
  const delta = angle - guard.angle;
  return (gap < 1 || Math.cos(delta) >= Math.cos(guard.arc / 2)) &&
    rayDistance(guard, angle, guard.range + 1, walls) > gap;
}

export function hears(guard, hunter, walls, noise) {
  const gap = distance(guard, hunter);
  return gap < noise && rayDistance(guard, Math.atan2(hunter.y - guard.y, hunter.x - guard.x), noise, walls) > gap;
}

export function detection(value, dt, visible, audible, light, unseenFor) {
  return clamp(value + (visible ? 36 + light * 24 : audible ? 34 : unseenFor >= 4 ? -50 : 0) * dt, 0, 100);
}

export const threat = (value, alert = value >= 100) => alert ? 'alert' : value >= 30 ? 'suspicious' : 'unaware';
export const behind = (guard, hunter) => Math.cos(Math.atan2(hunter.y - guard.y, hunter.x - guard.x) - guard.angle) < -0.25;
export const gradeFor = (run) => run.marked || run.alerted ? 'exposed' : run.suspicious ? 'shadow' : 'ghost';

export function move(actor, dx, dy, level, radius = HUNTER_RADIUS) {
  const open = (x, y) => !level.walls.some((wall) =>
    Math.hypot(x - clamp(x, wall.x, wall.x + wall.w), y - clamp(y, wall.y, wall.y + wall.h)) < radius);
  const x = clamp(actor.x + dx, radius, level.width - radius);
  const y = clamp(actor.y + dy, radius, level.height - radius);
  if (open(x, actor.y)) actor.x = x;
  if (open(actor.x, y)) actor.y = y;
}

export function follow(guard, target, dt, speed, level) {
  const gap = distance(guard, target);
  if (gap < 1) return true;
  guard.angle = Math.atan2(target.y - guard.y, target.x - guard.x);
  const step = Math.min(gap, speed * dt);
  move(guard, step * Math.cos(guard.angle), step * Math.sin(guard.angle), level);
  return distance(guard, target) < 1;
}
