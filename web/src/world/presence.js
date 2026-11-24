import { TILE } from './levels.js';

const angles = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
export const animations = { idle: 4, walk: 6, sneak: 6, sprint: 6, takedown: 6, strike: 8, hide: 2 };
export const direction = (angle) => ['right', 'down', 'left', 'up'][Math.round((angle + Math.PI * 2) / (Math.PI / 2)) % 4];
export const worldEvent = (name, detail) => window.dispatchEvent(new CustomEvent('demon-duels:' + name, { detail }));

export function createPresence(levels, signal) {
  const peers = new Map();
  let lastKey = '';
  let lastSent = -Infinity;
  window.addEventListener('demon-duels:hunters', ({ detail } = {}) => {
    const circle = detail?.circle;
    const level = circle === 'pit' ? { width: 16 * TILE, height: 8 * TILE } : Number.isInteger(circle) ? levels[circle] : null;
    if (!level || !Array.isArray(detail.hunters)) return;
    const previous = new Map((peers.get(circle) ?? []).map((peer) => [peer.id, peer]));
    const now = performance.now();
    peers.set(circle, detail.hunters.flatMap((peer) => {
      if (typeof peer?.id !== 'string' || !peer.id || !Number.isFinite(peer.x) || !Number.isFinite(peer.y)) return [];
      const x = peer.x * TILE;
      const y = peer.y * TILE;
      if (x < 0 || x > level.width || y < 0 || y > level.height) return [];
      const anim = Object.hasOwn(animations, peer.anim) ? peer.anim : 'idle';
      const prior = previous.get(peer.id);
      const animStart = prior?.anim === anim ? prior.animStart : now;
      return [{ ...peer, x, y, peer: true, name: typeof peer.name === 'string' && peer.name.trim() ? peer.name.trim().slice(0, 28) : 'Hunter',
        angle: Object.hasOwn(angles, peer.dir) ? angles[peer.dir] : 0,
        anim, animStart, takedownUntil: animStart + 840, hue: Number.isFinite(peer.hue) ? Math.max(0, Math.min(360, peer.hue)) : 0 }];
    }));
  }, { signal });
  return {
    inCircle: (circle) => peers.get(circle) ?? [],
    publish(circle, hunter, now) {
      const pose = { circle, x: Math.round(hunter.x / TILE * 100) / 100, y: Math.round(hunter.y / TILE * 100) / 100,
        dir: direction(hunter.angle), anim: hunter.anim };
      const key = JSON.stringify(pose);
      if (key === lastKey || now - lastSent < 50) return;
      lastKey = key;
      lastSent = now;
      worldEvent('hunter-pose', pose);
    },
    leave() { peers.clear(); lastKey = ''; lastSent = -Infinity; worldEvent('hunter-pose', { circle: null }); },
  };
}
