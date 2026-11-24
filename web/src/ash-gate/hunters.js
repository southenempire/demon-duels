import { Vector3 } from 'three';
import { figure } from './figures.js';
import { inside } from './stealth.js';

const headings = { up: 0, left: Math.PI / 2, down: Math.PI, right: -Math.PI / 2 };
export const emit = (name, detail) => window.dispatchEvent(new CustomEvent('demon-duels:' + name, { detail }));

function peerHeight(peer, roofs) {
  if (Number.isFinite(peer.height)) return peer.height;
  if (!peer.anim?.startsWith('roof-')) return 0;
  return roofs.reduce((y, roof) => inside(peer.x, peer.y, roof) ? Math.max(y, roof.h) : y, 0);
}

export function separateStep(x, z, height, dx, dz, peers, roofs = []) {
  const distance = Math.hypot(dx, dz);
  if (!distance) return [dx, dz];
  let steering = 0;
  for (const peer of peers) {
    if (Math.abs(height - peerHeight(peer, roofs)) > .65) continue;
    const px = peer.x - x, pz = peer.y - z;
    const gap = Math.hypot(px, pz);
    if (gap >= .9 || px * dx + pz * dz <= 0) continue;
    const side = Math.sign(dx * pz - dz * px) || 1;
    steering -= side * (1 - gap / .9);
  }
  const steer = Math.max(-.7, Math.min(.7, steering));
  return [dx - dz * steer, dz + dx * steer];
}

export function ashHunters(scene, world, { circle, bounds, roofs = [] }) {
  const actors = new Map();
  const framePoint = new Vector3();
  let peers = [];
  const remove = (id, { actor, label }) => {
    actor.dispose();
    label.remove();
    actors.delete(id);
  };
  window.addEventListener('demon-duels:hunters', ({ detail }) => {
    if (detail?.circle !== circle || !Array.isArray(detail.hunters)) return;
    peers = detail.hunters.filter((peer) => typeof peer.id === 'string' && Object.hasOwn(headings, peer.dir)
      && Number.isFinite(peer.x) && peer.x >= bounds.left && peer.x <= bounds.right
      && Number.isFinite(peer.y) && peer.y >= bounds.far && peer.y <= bounds.near).slice(0, 8);
  });
  return {
    count() { return peers.length; },
    leave() {
      peers = [];
      for (const [id, slot] of actors) remove(id, slot);
      emit('hunter-pose', { circle: null });
    },
    separate(x, z, height, dx, dz) { return separateStep(x, z, height, dx, dz, peers, roofs); },
    publish(x, z, height, yaw, anim) {
      const names = ['up', 'left', 'down', 'right'];
      const dir = names[(Math.round(yaw / (Math.PI / 2)) % 4 + 4) % 4];
      emit('hunter-pose', { circle, x, y: z, height, heading: yaw, dir, anim: height > 2.3 ? 'roof-' + anim : anim });
    },
    update(dt, x, z, height) {
      let near = null, closest = 2.3;
      const ids = new Set(peers.map((peer) => peer.id));
      for (const [id, slot] of actors) {
        if (ids.has(id)) continue;
        remove(id, slot);
      }
      for (const peer of peers) {
        const yaw = Number.isFinite(peer.heading) ? peer.heading : headings[peer.dir];
        const top = peerHeight(peer, roofs);
        let slot = actors.get(peer.id);
        if (!slot) {
          const label = document.createElement('span');
          label.className = 'ash-nameplate';
          label.textContent = peer.name || 'Hunter';
          world.append(label);
          slot = { actor: figure(scene, 'hunter', 0x70828b), label, yaw, top, warp: peer.warp, phase: 0, gait: 0, crouch: 0 };
          actors.set(peer.id, slot);
        } else if (slot.warp !== peer.warp) {
          Object.assign(slot, { yaw, top, warp: peer.warp, phase: 0, gait: 0, crouch: 0 });
        }
        const { actor } = slot;
        const elevated = peer.anim?.startsWith('roof-');
        const motion = elevated ? peer.anim.slice(5) : peer.anim;
        const blend = 1 - Math.exp(-dt * 12);
        slot.top += (top - slot.top) * blend;
        slot.yaw += Math.atan2(Math.sin(yaw - slot.yaw), Math.cos(yaw - slot.yaw)) * blend;
        slot.gait += ((({ sprint: 1.1, walk: .68, sneak: .39 })[motion] || 0) - slot.gait) * blend;
        slot.crouch += (Number(motion === 'sneak' || motion === 'hide') - slot.crouch) * blend;
        slot.phase += dt * (3 + slot.gait * 8);
        actor.root.position.set(peer.x, slot.top, peer.y);
        actor.root.rotation.y = slot.yaw;
        actor.pose(slot.phase, slot.gait, slot.crouch);
        const distance = Math.hypot(x - peer.x, z - peer.y);
        slot.distance = Math.hypot(distance, height - top);
        if (!peer.busy && Math.abs(height - top) < 1.1 && distance < closest) {
          near = peer;
          closest = distance;
        }
      }
      return near;
    },
    drawLabels(camera, target) {
      for (const [id, { actor, label, distance }] of actors) {
        framePoint.copy(actor.root.position);
        framePoint.y += 2.07;
        framePoint.project(camera);
        label.hidden = distance > 7.5 || Math.abs(framePoint.x) >= 1 || Math.abs(framePoint.y) >= 1 || Math.abs(framePoint.z) >= 1;
        if (label.hidden) continue;
        label.classList.toggle('is-target', target === id);
        label.style.opacity = Math.min(1, (7.5 - distance) / 4);
        label.style.left = (framePoint.x + 1) * 50 + '%';
        label.style.top = (1 - framePoint.y) * 50 + '%';
      }
    },
  };
}
