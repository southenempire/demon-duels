import { obstruction } from '../../ash-gate/stealth.js';

export const bounds = { left: -10.8, right: 10.8, far: -15, near: 16 };
export const spawn = { x: 1.3, z: 12.9 };
export const herald = { x: 1.4, z: -10.6 };

export const roofs = [
  { x: -5.9, z: 2.9, w: 3.2, d: 3.4, h: 2.7 },
  { x: -5.9, z: -.25, w: 3.2, d: 2.9, h: 3.8 },
  { x: -5.9, z: -3.2, w: 3.2, d: 3, h: 4.85 },
  { x: -5.9, z: -6.05, w: 3.2, d: 2.7, h: 2.95 },
  { x: 7.15, z: -1.3, w: 3.2, d: 3.1, h: 2.9 },
];

export const coverZones = [
  { x: -9.25, z: 5.9, w: 2.35, d: 3.3 },
  { x: 9.3, z: -6.7, w: 2.35, d: 3.4 },
];

export const caveWalls = [
  { x: -9.7, z: 4.02, w: 2.55, d: .42, h: 2.65 },
  { x: -9.7, z: 7.78, w: 2.55, d: .42, h: 2.65 },
  { x: 9.7, z: -8.61, w: 2.55, d: .42, h: 2.65 },
  { x: 9.7, z: -4.79, w: 2.55, d: .42, h: 2.65 },
];

export const buttresses = [
  { x: 3.25, z: 9.2, w: 4.1, d: 1.15, h: 1.4 },
  { x: -.15, z: 2.15, w: 1.6, d: 1.2, h: 2.45 },
  { x: 3.4, z: -3.3, w: 2.85, d: 1.15, h: 1.45 },
  { x: -2.65, z: -7.95, w: 1.1, d: 2.5, h: 2.6 },
  { x: .55, z: -8.85, w: 4.6, d: .75, h: 1.8 },
  { x: 5.4, z: -8.9, w: 1.25, d: 2, h: 2.8 },
];

export const barriers = [
  { x: -11.45, z: .5, w: 1.3, d: 33, h: 6 },
  { x: 11.45, z: .5, w: 1.3, d: 33, h: 6 },
  { x: 0, z: -15.75, w: 23, d: 1.5, h: 7 },
  { x: 0, z: 16.75, w: 23, d: 1.5, h: 4 },
];

export const roofBodies = roofs.map((roof) => ({ ...roof, w: roof.w - .66, d: roof.d - .66 }));
export const colliders = [...caveWalls, ...buttresses, ...roofBodies];

export const stone = [
  { x: 1.3, z: 12.45, w: 3.15, d: 4.1 },
  { x: -2.6, z: 10.95, w: 8.85, d: 1.9 },
  { x: -6.5, z: 8, w: 1.85, d: 6.4 },
  { x: -8.0, z: 5.7, w: 4.35, d: 1.55 },
  { x: -8.2, z: .15, w: 1.35, d: 10.25 },
  { x: -7.25, z: -5.0, w: 3.2, d: 1.3 },
  { x: -6.5, z: -8.65, w: 1.7, d: 2.65 },
  { x: -3.15, z: -10.25, w: 8.65, d: 2.2 },
  { x: 1.35, z: -11.95, w: 4.6, d: 4.7 },
];

export const ice = [
  { x: 2.75, z: 5.25, w: 9.1, d: 5.85 },
  { x: .25, z: -5.5, w: 6.6, d: 2.55 },
  { x: 8.3, z: -9.85, w: 4.65, d: 3.85 },
];

export const inside = ({ x, z }, area) =>
  Math.abs(x - area.x) < area.w / 2 && Math.abs(z - area.z) < area.d / 2;

export const surfaceAt = (pos) => {
  if ((pos.y ?? 0) > .18 || stone.some((area) => inside(pos, area)) ||
      coverZones.some((area) => inside(pos, area))) return 'stone';
  return ice.some((area) => inside(pos, area)) ? 'ice' : 'snow';
};

const sideOf = (ax, az, bx, bz, x, z) => (bx - ax) * (z - az) - (bz - az) * (x - ax);

export function canInvestigate({ x, z }, patrols) {
  const clear = (ax, az, bx, bz) => obstruction(ax, az, bx, bz, colliders, .12) === 1;
  // Every thrall sees the same targets, including while walking between waypoints.
  return patrols.every(({ route }) => route.every(([ax, az], i) => {
    const [bx, bz] = route[(i + 1) % route.length];
    if (!clear(ax, az, x, z) || !clear(ax, az, bx, bz)) return false;
    const turn = Math.sign(sideOf(ax, az, bx, bz, x, z));
    // Once all three edges are clear, only a collider enclosed by the triangle can block it.
    return !turn || !colliders.some((wall) =>
      turn * sideOf(ax, az, bx, bz, wall.x, wall.z) > 0 &&
      turn * sideOf(bx, bz, x, z, wall.x, wall.z) > 0 &&
      turn * sideOf(x, z, ax, az, wall.x, wall.z) > 0);
  }));
}
