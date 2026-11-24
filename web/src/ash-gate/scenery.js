import * as T from 'three';
import { batchStonework, box, mesh, metal } from './figures.js';

export const limits = { left: -10.8, right: 10.8, far: -15, near: 16 };
export const cover = [
  { x: -5.5, z: 7.4, w: 4.3, d: 1.2, h: 1.28 },
  { x: 2.3, z: 4.9, w: 3, d: 1.1, h: 1.38 },
  { x: -2.7, z: -.9, w: 1.5, d: 1.5, h: 2.25 },
  { x: 6.4, z: -.9, w: 2.5, d: 1.3, h: 1.35 },
  { x: -6.7, z: -4.5, w: 4.35, d: 1.25, h: 1.3 },
  { x: 3.8, z: -8.1, w: 1.55, d: 1.55, h: 2.35 },
  { x: -3.8, z: -8.1, w: 1.55, d: 1.55, h: 2.35 },
];
export const shade = [{ x: -4.6, z: 9.25, w: 5.8, d: 3.1 }, { x: -8.9, z: 2.3, w: 3.35, d: 8.4 },
  { x: 8.9, z: -5.6, w: 3.6, d: 5.5 }, { x: -6.1, z: -2.6, w: 4.6, d: 2.45 }];
export const roofs = [
  { x: -7.65, z: 2.5, w: 3.05, d: 3.1, h: 2.94 },
  { x: -8, z: .7, w: 2.34, d: 1.32, h: 4.12 },
  { x: 8.82, z: 3.1, w: 3.15, d: 3.5, h: 2.94 },
];

export function buildGate(scene) {
  let seed = 12731;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stones = [0x282c30, 0x313538, 0x383a3b, 0x42403e, 0x2d2e31, 0x343438].map((color) => metal(color));
  const basalt = metal(0x29282a), iron = metal(0x262425, .55), lip = metal(0x4a4542);
  const brass = metal(0x7b5341), fabric = new T.MeshStandardMaterial({ color: 0x481c1d, side: T.DoubleSide });
  const stone = () => stones[Math.floor(random() * stones.length)];
  const plane = new T.PlaneGeometry(1, 1);
  const base = mesh(scene, plane, metal(0x1a191a), 0, -.075, -1);
  base.rotation.x = -Math.PI / 2;
  base.scale.set(170, 170, 1);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#222326';
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 4; col++) {
      const x = col * 128 + (row % 2) * 64, y = row * 64;
      const tint = Math.floor(48 + random() * 19);
      ctx.fillStyle = `rgb(${tint},${tint - 1},${tint - 2})`;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 7); ctx.lineTo(x + 11, y + 2); ctx.lineTo(x + 125, y + 4);
      ctx.lineTo(x + 124, y + 57); ctx.lineTo(x + 118, y + 61); ctx.lineTo(x + 4, y + 60); ctx.fill();
      ctx.strokeStyle = '#ffffff1d'; ctx.stroke();
      ctx.strokeStyle = '#15151965';
      ctx.beginPath(); ctx.moveTo(x + 125, y + 27); ctx.lineTo(x + 99, y + 20);
      ctx.lineTo(x + 91, y + 25); ctx.lineTo(x + 73, y + 19); ctx.stroke();
    }
  }
  for (let i = 0; i < 18400; i++) {
    ctx.fillStyle = random() < .5 ? '#00000028' : '#c7ad8c19';
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 6, 1 + random() * 3);
  }
  const paving = new T.CanvasTexture(canvas);
  paving.colorSpace = T.SRGBColorSpace;
  paving.anisotropy = 8;
  paving.wrapS = paving.wrapT = T.RepeatWrapping;
  paving.repeat.set(5, 8);
  const floor = mesh(scene, plane, new T.MeshStandardMaterial({ map: paving, bumpMap: paving, bumpScale: .033, roughness: .95 }), 0, 0, 0);
  floor.rotation.x = -Math.PI / 2; floor.scale.set(24, 36, 1);

  function wall(x, z, w, d, rows, alongZ = false) {
    const group = new T.Group();
    scene.add(group); group.position.set(x, 0, z);
    group.rotation.y = alongZ ? Math.PI / 2 : 0;
    const wide = w / Math.max(1, Math.round(w / 1.46));
    for (let row = 0; row < rows; row++) {
      for (let left = -(row % 2) * wide / 2; left < w; left += wide) {
        const lo = Math.max(left, 0), hi = Math.min(left + wide, w);
        if (hi - lo < .05) continue;
        const b = box(group, stone(), (lo + hi - w) / 2, .29 + .58 * row, (random() - .5) * .08, hi - lo - .033, .55, d + random() * .09);
        b.rotation.z = (random() - .5) * .018;
      }
    }
    box(group, lip, 0, rows * .58 + .045, 0, w + .16, .15, d + .19);
  }

  for (const x of [-11.9, 11.9]) {
    wall(x, 0, 36, 1.45, 7, true);
    for (const z of [-14, -7, 0, 7, 14]) {
      box(scene, basalt, x, 2.46, z, 2.15, 4.92, 1.6);
      box(scene, lip, x, 4.87, z, 2.38, .16, 1.84);
    }
  }
  for (const x of [-8.1, 8.1]) {
    wall(x, -15.7, 7.65, 2.05, 11);
    for (let i = 0; i < 4; i++) box(scene, stone(), x - 2.8 + i * 1.9, 6.82, -15.7, .96, .8, 1.92);
  }
  for (const { x, z, w, d, h } of cover) wall(x, z, w, d, Math.round(h / .58));
  for (const { x, z, w, d, h } of roofs) {
    wall(x, z, w, d, Math.round(h / .58));
    box(scene, lip, x, h - .12, z, w + .04, .24, d + .04);
    for (const offset of [-.65, .65]) {
      box(scene, iron, x + offset, h * .50, z + d / 2 + .068, .25, .7, .035);
      box(scene, brass, x + offset, h * .50, z + d / 2 + .092, .044, .66, .04);
    }
  }
  for (const { x, z, w, d } of shade) {
    for (let i = 0; i < 14; i++) {
      const a = random() * .22 + .07;
      mesh(scene, new T.DodecahedronGeometry(a, 0), basalt,
        x + (random() - .5) * w, a * .36, z + (random() - .5) * d).scale.set(1.45, .54, 1);
    }
  }
  for (let i = 0; i < 30; i++) {
    const x = (i < 15 ? -1 : 1) * (8.2 + random() * 22);
    const z = 9 - (i % 15) * 4 - random() * 4, h = 4 + random() * 15;
    const w = 2.7 + random() * 3.8, d = 2.6 + random() * 3.5;
    if (Math.abs(x) < 15 && z > -20) continue;
    box(scene, stone(), x, h / 2, z, w, h, d);
    box(scene, lip, x, h - .05, z, w + .27, .27, d + .32);
    for (let n = 0; n < 4; n++) {
      box(scene, basalt, x - w * .4 + n * w * .267, h + .26, z + d * .41, w / 7, .52, .44);
    }
    if (i % 3 === 0) {
      const lamp = new T.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffb47a : 0xb56540 });
      box(scene, lamp, x, h - 1.1, z + d / 2 + .025, .14, .48, .018);
      box(scene, lamp, x - w * .498, h - 1.1, z, .018, .48, .14);
      box(scene, lamp, x + w * .498, h - 1.1, z, .018, .48, .14);
    }
  }

  const gateZ = -15.48;
  const radius = 2.65, spring = 3.8;
  for (const x of [-3.04, 3.04]) {
    wall(x, gateZ, .88, 2.35, 6);
    box(scene, lip, x, 3.57, gateZ, 1.14, .23, 2.53);
    box(scene, lip, x, .24, gateZ, 1.14, .48, 2.53);
  }
  function archSegment(from, to, inner, outer) {
    const shape = new T.Shape();
    shape.absarc(0, 0, outer, from, to, false);
    shape.lineTo(inner * Math.cos(to), inner * Math.sin(to));
    shape.absarc(0, 0, inner, to, from, true);
    shape.closePath();
    return shape;
  }
  for (let i = 0; i < 15; i++) {
    const from = i * Math.PI / 15, to = (i + 1) * Math.PI / 15;
    mesh(scene, new T.ExtrudeGeometry(archSegment(from + .007, to - .007, radius, i === 7 ? 3.62 : 3.35),
      { depth: 2.14, curveSegments: 4, bevelEnabled: false }), i === 7 ? lip : stone(), 0, spring - .22, gateZ - 1);
  }
  const backlight = new T.MeshBasicMaterial({ color: 0x71321f });
  const opening = new T.Shape();
  opening.moveTo(-radius, 0); opening.lineTo(radius, 0); opening.lineTo(radius, 3.59);
  opening.absarc(0, 3.59, radius, 0, Math.PI, false); opening.closePath();
  mesh(scene, new T.ShapeGeometry(opening, 24), backlight, 0, 0, gateZ - 1.15);
  for (let i = -5; i <= 5; i++) {
    const x = i * .46, h = 3.55 + Math.sqrt(radius ** 2 - x ** 2);
    box(scene, iron, x, h / 2, gateZ - .24, .112, h, .17);
  }
  for (const y of [.8, 2.2, 3.5]) box(scene, iron, 0, y, gateZ - .13, 5.2, .19, .2);
  for (const x of [-5.4, 5.4]) {
    box(scene, iron, x, 5.38, -14.52, 1.58, .078, .14);
    const cloth = mesh(scene, new T.PlaneGeometry(1.21, 2.44, 10, 16), fabric, x, 4.11, -14.49);
    const p = cloth.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), v = p.getY(i);
      p.setXYZ(i, u, v - Math.max(0, -v) * .22 * (1 - Math.abs(u) / .6), .06 * Math.cos(u * 19) * (.2 + Math.max(0, -v)));
    }
    cloth.geometry.computeVertexNormals();
    const ring = mesh(scene, new T.RingGeometry(.19, .216, 4), brass, x, 4.35, -14.34);
    ring.rotation.z = Math.PI / 2;
    box(scene, brass, x, 4.35, -14.33, .026, .71, .022);
  }
  batchStonework(scene);

  const sky = new T.HemisphereLight(0xa7bad4, 0x46312d, 1.52);
  scene.add(sky);
  const moon = new T.DirectionalLight(0xb6c7e3, 2.35);
  moon.position.set(-8, 16, -6);
  moon.target.position.set(0, 0, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -19, right: 19, top: 21, bottom: -21, far: 45 });
  moon.shadow.normalBias = .035;
  scene.add(moon, moon.target);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const glowCtx = glowCanvas.getContext('2d');
  const gradient = glowCtx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, '#fff1cfc9'); gradient.addColorStop(.13, '#ffc47287');
  gradient.addColorStop(.4, '#e75d182c'); gradient.addColorStop(1, '#c2351300');
  glowCtx.fillStyle = gradient; glowCtx.fillRect(0, 0, 64, 64);
  const glowTexture = new T.CanvasTexture(glowCanvas);
  glowTexture.colorSpace = T.SRGBColorSpace;
  const fires = [];
  const fireMaterial = [0xff7a25, 0xffa742, 0xffdc8a].map((color) => new T.MeshBasicMaterial({ color, transparent: true, opacity: .79, fog: false }));
  const flameGeo = new T.LatheGeometry([
    new T.Vector2(0, -1), new T.Vector2(.63, -.77), new T.Vector2(.93, -.39),
    new T.Vector2(.72, .13), new T.Vector2(.43, .57), new T.Vector2(.16, 1.06), new T.Vector2(0, 1.47),
  ], 9);
  for (const [x, z] of [[-3.4, 10.8], [7.7, 7.7], [-7.8, .4], [3.4, -.1], [-5.55, -11], [5.55, -11]]) {
    box(scene, basalt, x, .15, z, .92, .3, .92);
    mesh(scene, new T.CylinderGeometry(.265, .37, .92, 8), iron, x, .64, z);
    mesh(scene, new T.CylinderGeometry(.49, .27, .27, 10), iron, x, 1.14, z);
    mesh(scene, new T.CylinderGeometry(.52, .52, .065, 12), brass, x, 1.28, z);
    const light = new T.PointLight(0xff8c42, 36, 9, 2);
    light.position.set(x, 1.7, z); scene.add(light);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTexture, blending: T.AdditiveBlending, depthWrite: false }));
    glow.position.set(x, 1.75, z); glow.scale.set(3.7, 3.7, 1); scene.add(glow);
    const flames = Array.from({ length: 10 }, (_, i) => {
      const f = mesh(scene, flameGeo, fireMaterial[i % 3], x, 1.35, z);
      f.castShadow = f.receiveShadow = false;
      return f;
    });
    fires.push({ x, z, flames, light, glow });
  }
  const cinders = new Float32Array(240 * 3);
  for (let i = 0; i < cinders.length; i += 3) {
    cinders[i] = (random() - .5) * 23;
    cinders[i + 1] = random() * 7;
    cinders[i + 2] = (random() - .5) * 34;
  }
  const ash = new T.BufferGeometry();
  ash.setAttribute('position', new T.BufferAttribute(cinders, 3));
  const dust = new T.Points(ash, new T.PointsMaterial({ color: 0xe99861, size: .030, transparent: true, opacity: .68, depthWrite: false }));
  scene.add(dust);

  return (t, dt) => {
    for (const { x, z, flames, light, glow } of fires) {
      const flicker = Math.sin(t * 14 + x) * .12 + Math.sin(t * 21 + z) * .09;
      light.intensity = 36 * (1 + flicker);
      glow.material.opacity = .82 + flicker;
      for (const [i, f] of flames.entries()) {
        const life = (t * (1.1 + .08 * i) + i / flames.length) % 1;
        f.position.set(x + Math.cos(i * 2.4 + life * 2) * (.25 - life * .15), 1.30 + life * .8, z + Math.sin(i * 2.4) * .22);
        f.scale.set(.112 * (1.1 - life), .275 * (1.03 - life), .11 * (1.1 - life));
        f.rotation.z = .20 * Math.sin(i * 2.35 + t * 12);
      }
    }
    for (let i = 0; i < cinders.length; i += 3) {
      cinders[i] += (Math.sin(t + i) * .14 + .30) * dt;
      if (cinders[i] > 12) cinders[i] -= 24;
      cinders[i + 1] = (cinders[i + 1] + .22 * dt) % 7;
    }
    ash.attributes.position.needsUpdate = true;
  };
}
