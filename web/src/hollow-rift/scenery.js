import * as T from 'three';
import { batchStonework, box, mesh, metal } from '../ash-gate/figures.js';
import { boss, cover, rift, roofs, shade, tears } from './layout.js';

export function buildRift(scene) {
  const obsidian = metal(0x25243a);
  const edge = metal(0x484961);
  const voidStone = metal(0x17182b);
  const tiles = [0x39374e, 0x343347, 0x2e2e43, 0x30334b, 0x36394e].map((color) => metal(color));
  const crystal = new T.MeshStandardMaterial({ color: 0xb7c0ff, emissive: 0x634bfe, emissiveIntensity: .95, roughness: .35 });
  const glow = new T.MeshBasicMaterial({ color: 0xb6a6ff, toneMapped: false });
  const prism = new T.OctahedronGeometry(1);
  let seed = 91731;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function causeway(left, right, far, near) {
    const width = right - left, depth = near - far;
    box(scene, voidStone, (left + right) / 2, -1.55, (far + near) / 2, width, 3, depth);
    const cols = Math.ceil(width / 1.75), rows = Math.ceil(depth / 1.4);
    const w = width / cols, d = depth / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        box(scene, tiles[Math.floor(random() * tiles.length)], left + (col + .5) * w, -.075,
          far + (row + .5) * d, w - .025, .15, d - .03);
      }
    }
  }
  causeway(-11.35, 11.35, rift.near, 16.25);
  causeway(-11.35, 11.35, -15.85, rift.far);
  causeway(rift.bridgeLeft, rift.bridgeRight, rift.far, rift.near);

  for (const site of [...cover, ...roofs]) {
    const { x, z, w, d, h } = site;
    box(scene, obsidian, x, h / 2, z, w, h, d);
    const rows = Math.ceil(h / .64);
    for (let n = 1; n < rows; n++) {
      const y = n * h / rows;
      box(scene, edge, x, y, z, w + .024, .045, d + .024);
    }
    box(scene, edge, x, h - .09, z, w, .18, d);
    for (const side of [-1, 1]) {
      box(scene, voidStone, x + side * (w / 2 - .19), h / 2, z, .38, h, d + .03);
      box(scene, crystal, x + side * (w / 2 - .19), h - .34, z + d / 2, .10, .32, .06);
    }
  }

  const shadowMaterial = new T.MeshBasicMaterial({ color: 0x151226, depthWrite: false, transparent: true, opacity: .72 });
  const shadowGeo = new T.CircleGeometry(1, 30);
  for (const { x, z, w, d } of shade) {
    const patch = mesh(scene, shadowGeo, shadowMaterial, x, .026, z);
    patch.rotation.x = -Math.PI / 2;
    patch.scale.set(w * .59, d * .59, 1);
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const z = 19 - i * 2.65;
      const x = side * (13.5 + random() * 12), y = -7 + random() * 8;
      const h = 5 + random() * 16;
      box(scene, i % 3 ? obsidian : edge, x, y, z, 2 + random() * 4, h, 2 + random() * 3);
      const shard = mesh(scene, prism, crystal, x, y + h / 2 + .65, z);
      shard.rotation.z = (random() - .5) * .6;
      shard.scale.set(.27, .95 + random(), .37);
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = -11 + random() * 17.3, z = rift.far + .28 + random() * 2.55;
    const shard = mesh(scene, prism, i % 3 ? voidStone : crystal, x, -2.95 - random() * 1.5, z);
    shard.rotation.set(.45, random() * Math.PI, .23);
    shard.scale.set(.24 + random() * .65, 1 + random() * 1.6, .45);
  }

  for (const side of [-1, 1]) {
    const x = boss.x + side * 2.05, z = boss.z - 2.5;
    box(scene, voidStone, x, 2.25, z, 1.25, 4.5, 1.5);
    const shard = mesh(scene, prism, crystal, x, 4.5, z);
    shard.scale.set(.52, 1.72, .52);
  }
  const seal = mesh(scene, new T.RingGeometry(1.65, 1.69, 48), crystal, boss.x, .042, boss.z);
  seal.rotation.x = -Math.PI / 2;

  const aperture = new T.MeshBasicMaterial({ color: 0x070516, side: T.DoubleSide });
  const tearFlames = tears.map(({ x, z, yaw }) => {
    const group = new T.Group();
    group.position.set(x, 1.18, z);
    group.rotation.y = yaw;
    scene.add(group);
    mesh(group, new T.PlaneGeometry(1.6, 1.6), aperture, 0, 0, 0).rotation.z = Math.PI / 4;
    const rim = mesh(group, new T.TorusGeometry(.82, .035, 6, 4), glow, 0, 0, .025);
    rim.scale.set(.93, 1.38, 1);
    const back = rim.clone();
    back.position.z = -.025;
    group.add(back);
    const core = mesh(group, prism, crystal, 0, 0, 0);
    core.scale.set(.18, .75, .18);
    const light = new T.PointLight(0x9e73ff, 8, 5);
    group.add(light);
    return { core, light };
  });

  const sparkPositions = new Float32Array(175 * 3);
  for (let i = 0; i < sparkPositions.length; i += 3) {
    sparkPositions[i] = (random() - .5) * 34;
    sparkPositions[i + 1] = random() * 9 - 2;
    sparkPositions[i + 2] = 16 - random() * 36;
  }
  const sparkGeo = new T.BufferGeometry();
  sparkGeo.setAttribute('position', new T.BufferAttribute(sparkPositions, 3));
  const motes = new T.Points(sparkGeo, new T.PointsMaterial({
    color: 0xaba3ff, size: .05, transparent: true, opacity: .62, depthWrite: false,
  }));
  scene.add(motes);
  scene.add(new T.HemisphereLight(0xc0cbff, 0x563765, 2.3));
  const moon = new T.DirectionalLight(0x98adff, 2.15);
  moon.position.set(-7, 12, 5);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, far: 55 });
  moon.shadow.normalBias = .025;
  scene.add(moon);
  batchStonework(scene);
  return (time) => {
    motes.position.y = Math.sin(time * .32) * .48;
    motes.position.x = Math.sin(time * .21) * .93;
    for (const [i, { core, light }] of tearFlames.entries()) {
      core.rotation.y = time * .95 + i;
      light.intensity = 8 + Math.sin(time * 2.1 + i) * 1.5;
    }
  };
}
