const box = (x, z, w, d, h = 0) => ({ x, z, w, d, h });

export const spawn = { x: 0, y: 0, z: 13.4 };
export const bossPosition = { x: 0, y: 0, z: -10.7 };
export const limits = { left: -12, right: 12, far: -16, near: 16 };

export const basins = [
  box(-5.6, 3.8, 9.4, 13.4),
  box(6.5, 3, 8.4, 15),
  box(0, -7, 20.6, 2.6),
  box(0, -14.7, 19.8, 1.4),
];
export const causeways = [
  box(0, 3.1, 2.25, 17.4),
  box(-6.2, -5.5, 1.6, 7.1),
  box(6.8, -6.3, 1.55, 6.6),
  box(.1, -10.8, 8.5, 5),
];
export const roofs = [
  box(-5.8, 7.5, 3.9, 3.4, 2.6),
  box(-6.7, 4.55, 3.2, 2.6, 3.82),
  box(6.35, .25, 3.8, 4, 2.85),
  box(-4.8, -9.5, 3.6, 3.5, 2.65),
];
export const cover = [
  box(2.75, 8.4, 2.2, .8, 1.4),
  box(-3.3, 1.28, .85, 3.5, 1.45),
  box(3.95, -3.85, 2.2, 1.05, 1.6),
  box(-1.8, -9.1, 1.1, .85, 1.4),
  box(2.45, -11.55, 1.3, .8, 1.4),
];
export const coverZones = [
  box(-8.6, 9.9, 1.7, 2.7),
  box(-8.65, -.5, 1.9, 3.6),
  box(8.7, -3.3, 2.4, 2.9),
];
export const perimeter = [
  box(-12.65, 0, 1.3, 34, 4.7),
  box(12.65, 0, 1.3, 34, 5.2),
  box(0, -16.65, 25.3, 1.3, 5.7),
  box(0, 16.65, 25.3, 1.3, 3.3),
];
export const colliders = [...cover, ...roofs, ...perimeter];

export const patrols = [
  { route: [[-.1, 9.2], [0, 3], [2.6, 3], [4.25, 6.8], [4.25, 9.2]], facing: 0, range: 6 },
  { route: [[-7.3, 1.1], [-7.3, -3.6], [-4.4, -3.6], [-4.4, -.8]], facing: 0, range: 6 },
  { route: [[6.8, -2.5], [6.8, -9.65], [3.55, -9.65], [3.55, -6], [7.3, -6], [7.3, -2.5]], facing: 0, range: 6 },
];

const contains = ({ x, z }, rect) =>
  Math.abs(x - rect.x) < rect.w / 2 && Math.abs(z - rect.z) < rect.d / 2;

export const inWater = (pos) => (pos.y ?? pos.height ?? 0) < .12 &&
  basins.some((basin) => contains(pos, basin)) && !causeways.some((path) => contains(pos, path));
export const speedAt = (pos) => inWater(pos) ? .5 : 1;
export const concealedAt = (pos, { crouched }) => pos.y > 2.35 ||
  crouched && (inWater(pos) || coverZones.some((zone) => contains(pos, zone)));

export const FOG_RANGE = 3;
const FOG_CYCLE = 15;
export const mireTime = () => performance.now() / 1000;
export const fogStrength = (time) => {
  const phase = (time % FOG_CYCLE + FOG_CYCLE) % FOG_CYCLE;
  const ramp = Math.min(1, Math.max(0, Math.min((phase - 5) / 2, (14 - phase) / 2)));
  return ramp * ramp * (3 - 2 * ramp);
};
export const fogDensity = (time) => .029 + .078 * fogStrength(time);

export function sightRange(guard, pos) {
  const strength = fogStrength(pos.time ?? mireTime());
  return guard.range - Math.max(0, guard.range - FOG_RANGE) * strength;
}
