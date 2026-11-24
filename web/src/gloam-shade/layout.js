import { inside } from '../ash-gate/stealth.js';

export const limits = { left: -12.5, right: 12.5, far: -22, near: 17.5 };
export const spawn = { x: -8, z: 14.5 };
export const throne = { x: 0, z: -17 };

export const roofs = [
  { x: -8, z: 9.8, w: 3.6, d: 3, h: 1.25 },
  { x: -8, z: 5.6, w: 4, d: 5.4, h: 2.65 },
  { x: -8, z: .1, w: 4.6, d: 5.6, h: 4.05 },
  { x: 8.65, z: 5.4, w: 3.5, d: 5.2, h: 2.5 },
  { x: 8.65, z: 1, w: 4.1, d: 3.6, h: 3.9 },
];

export const cover = [
  { x: -4.4, z: 6.9, w: .9, d: .9, h: 3.65 },
  { x: -4.4, z: .4, w: .9, d: .9, h: 3.65 },
  { x: -4.4, z: -6.1, w: .9, d: .9, h: 3.65 },
  { x: 4.4, z: 6.9, w: .9, d: .9, h: 3.65 },
  { x: 4.4, z: .4, w: .9, d: .9, h: 3.65 },
  { x: 4.4, z: -6.1, w: .9, d: .9, h: 3.65 },
  { x: 6.3, z: -12.6, w: 3.3, d: 1, h: 1.6 },
];

export const barriers = [
  ...[-1, 1].map((side) => ({ x: side * 13, z: -2, w: 1, d: 41, h: 7.4 })),
  { x: 0, z: -22.5, w: 27, d: 1, h: 9 },
  { x: 0, z: 18, w: 27, d: 1, h: 4.5 },
];

export const coverZones = [
  { x: -8, z: 12.7, w: 2.8, d: 5, h: 0 },
  ...roofs.slice(0, 3).map(({ x, z, w, d, h }) => ({ x, z, w: w - .65, d, h })),
  { x: -8, z: -6.65, w: 2.8, d: 8.2, h: 0 },
  { x: -5.1, z: -10.45, w: 8.6, d: 2.1, h: 0 },
  { x: -2.15, z: -14, w: 2.7, d: 8.4, h: 0 },
];

export const patrols = [
  { route: [[-2.6, 10.7], [2.7, 10.7], [2.7, 3.4], [-2.6, 3.4]], yaw: -Math.PI / 2 },
  { route: [[-2.6, -1.8], [2.7, -1.8], [2.7, -8.65], [-2.6, -8.65]], yaw: -Math.PI / 2 },
  { route: [[6.2, -7.8], [9.6, -7.8], [9.6, -16.2], [3.9, -16.2], [3.9, -10]], yaw: -Math.PI / 2 },
];

export function concealedAt({ x, z, y = 0, height = y }) {
  return coverZones.some((zone) => Math.abs(height - zone.h) < .32 && inside(x, z, zone));
}
