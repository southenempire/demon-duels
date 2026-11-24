export const limits = { left: -11, right: 11, far: -15.4, near: 15.5 };
export const spawn = { x: -5.7, y: 0, z: 12.9 };
export const boss = { x: -2.2, z: -10.9, yaw: Math.PI };
export const cover = [
  { x: -.5, z: 8.0, w: 3.6, d: 1.1, h: 1.25 },
  { x: 5.65, z: 1.8, w: 1.35, d: 3.2, h: 2.1 },
  { x: 1.3, z: -8.05, w: 3.8, d: 1.25, h: 1.65 },
  { x: -5.7, z: -12.35, w: 1.15, d: 3.1, h: 2.1 },
];
export const roofs = [
  { x: -5.7, z: 7.5, w: 3.75, d: 5.1, h: 2.75 },
  { x: -6.8, z: 3.85, w: 2.9, d: 2.45, h: 4.10 },
  { x: 6.8, z: -8.15, w: 2.65, d: 3.7, h: 2.85 },
];
export const roofDecks = roofs.map((roof) => ({ ...roof, w: roof.w + .6, d: roof.d + .6 }));
export const shade = [
  { x: -6.75, z: 11.15, w: 5.8, d: 2.0 },
  { x: -6.8, z: -.35, w: 4, d: 2.2 },
  { x: -5.2, z: -7.05, w: 4.5, d: 3.35 },
  { x: -3.9, z: -9.5, w: 2.85, d: 2.1 },
];
export const tears = [
  { x: -6.7, y: 0, z: -.55, yaw: .15 },
  { x: -6.8, y: 0, z: -6.25, yaw: -.2 },
];
export const patrols = [
  { route: [[-.6, 10.2], [4.8, 10.2], [4.8, 6.25], [-2.65, 6.25], [-2.65, 10.2]], yaw: -Math.PI / 2 },
  { route: [[3.6, 3.4], [1.1, 3.4], [1.1, -.4], [4.3, -.4], [4.3, 3.4]], yaw: Math.PI / 2 },
  { route: [[3.9, -11.9], [8.3, -11.9], [8.3, -14.25], [1.75, -14.25], [1.75, -11.9]], yaw: -Math.PI / 2 },
];

export const rift = { near: -1.7, far: -4.85, bridgeLeft: 7, bridgeRight: 10.15 };
export const hasGround = (x, z) => z >= rift.near || z <= rift.far || x >= rift.bridgeLeft && x <= rift.bridgeRight;
export const barriers = [
  ...[[limits.left, rift.bridgeLeft], [rift.bridgeRight, limits.right]].map(([left, right]) => ({
    x: (left + right) / 2, z: (rift.far + rift.near) / 2, w: right - left, d: rift.near - rift.far, h: 8,
  })),
];
