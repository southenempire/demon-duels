import { figure } from './figures.js';
import { limits, roofs } from './scenery.js';
import { inside } from './stealth.js';

const headings = { up: 0, left: Math.PI / 2, down: Math.PI, right: -Math.PI / 2 };
export const emit = (name, detail) => window.dispatchEvent(new CustomEvent('demon-duels:' + name, { detail }));

export function ashHunters(scene) {
  const slots = [];
  let peers = [];
  window.addEventListener('demon-duels:hunters', ({ detail }) => {
    if (detail?.circle !== 0 || !Array.isArray(detail.hunters)) return;
    peers = detail.hunters.filter((peer) => typeof peer.id === 'string' && Object.hasOwn(headings, peer.dir)
      && Number.isFinite(peer.x) && peer.x >= limits.left && peer.x <= limits.right
      && Number.isFinite(peer.y) && peer.y >= limits.far && peer.y <= limits.near).slice(0, 8);
  });
  return {
    leave() { peers = []; emit('hunter-pose', { circle: null }); },
    publish(x, z, height, yaw, anim) {
      const names = ['up', 'left', 'down', 'right'];
      const dir = names[(Math.round(yaw / (Math.PI / 2)) % 4 + 4) % 4];
      emit('hunter-pose', { circle: 0, x, y: z, dir, anim: height > 2.3 ? 'roof-' + anim : anim });
    },
    update(time, x, z, height) {
      let near = null, closest = 2.3;
      for (const [i, peer] of peers.entries()) {
        const actor = slots[i] ??= figure(scene, 'hunter', 0x70828b);
        const elevated = peer.anim?.startsWith('roof-');
        const motion = elevated ? peer.anim.slice(5) : peer.anim;
        const top = elevated ? roofs.reduce((y, roof) => inside(peer.x, peer.y, roof) ? Math.max(y, roof.h) : y, 0) : 0;
        actor.root.visible = true;
        actor.root.position.set(peer.x, top, peer.y);
        actor.root.rotation.y = headings[peer.dir];
        actor.pose(time * 9, ({ sprint: 1.1, walk: .68, sneak: .39 })[motion] || 0,
          motion === 'sneak' || motion === 'hide' ? 1 : 0);
        const distance = Math.hypot(x - peer.x, z - peer.y);
        if (!peer.busy && Math.abs(height - top) < 1.1 && distance < closest) {
          near = peer;
          closest = distance;
        }
      }
      for (let i = peers.length; i < slots.length; i++) slots[i].root.visible = false;
      return near;
    },
  };
}
