import * as T from 'three';
import { figure } from '../ash-gate/figures.js';
import { obstruction } from '../ash-gate/stealth.js';
import { obstacles } from './stealth.js';

export function citadelGuard(scene, route) {
  const actor = figure(scene, 'guard', 0x654164);
  const [x, z] = route[0];
  const state = { x, z, yaw: 0, range: 5.9, halfAngle: Math.PI / 4, suspicion: 0 };
  let waypoint = 1;
  let pause = .65;
  const segments = 16;
  const geo = new T.BufferGeometry();
  const points = new T.BufferAttribute(new Float32Array((segments + 2) * 3), 3);
  geo.setAttribute('position', points);
  geo.setIndex(Array.from({ length: segments }, (_, i) => [0, i + 1, i + 2]).flat());
  const material = new T.MeshBasicMaterial({
    color: 0xeeb65c, side: T.DoubleSide, transparent: true, opacity: .15, depthWrite: false,
  });
  const cone = new T.Mesh(geo, material);
  cone.frustumCulled = false;
  scene.add(cone);
  return {
    state,
    update(dt, time) {
      const [tx, tz] = route[waypoint];
      const dx = tx - state.x, dz = tz - state.z;
      const distance = Math.hypot(dx, dz);
      pause -= dt;
      const moving = pause <= 0 && distance > .06;
      if (distance > .06) {
        const delta = Math.atan2(-dx, -dz) - state.yaw;
        state.yaw += Math.atan2(Math.sin(delta), Math.cos(delta)) * Math.min(dt * 5, 1);
      }
      if (moving) {
        const advance = Math.min(distance, dt * 1.35);
        state.x += dx / distance * advance;
        state.z += dz / distance * advance;
      } else if (distance <= .06) {
        waypoint = (waypoint + 1) % route.length;
        pause = .65;
      }
      actor.root.position.set(state.x, 0, state.z);
      actor.root.rotation.y = state.yaw;
      actor.pose(time * 7, moving ? .55 : 0);
      points.setXYZ(0, state.x, .027, state.z);
      for (let i = 0; i <= segments; i++) {
        const a = state.yaw + state.halfAngle * (2 * i / segments - 1);
        const px = state.x - Math.sin(a) * state.range, pz = state.z - Math.cos(a) * state.range;
        const fraction = obstruction(state.x, state.z, px, pz, obstacles);
        points.setXYZ(i + 1, T.MathUtils.lerp(state.x, px, fraction), .027, T.MathUtils.lerp(state.z, pz, fraction));
      }
      points.needsUpdate = true;
      material.opacity = .14 + state.suspicion * .23;
    },
  };
}
