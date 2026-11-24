import { batchStonework, box, metal } from '../ash-gate/figures.js';
import { barriers, cover, coverZones, limits, roofs, throne } from './layout.js';

export function scenery(T, scene) {
  const sanctum = new T.Group();
  scene.add(sanctum);
  const stone = [0x201b30, 0x242137, 0x292539, 0x302a41].map((color) => metal(color));
  const obsidian = metal(0x171422, .65);
  const silver = metal(0x777395, .44);
  const inlay = new T.MeshStandardMaterial({ color: 0xa89aba, emissive: 0x615979, emissiveIntensity: .75, roughness: .62 });
  const seam = new T.MeshBasicMaterial({ color: 0xdfdfff });
  const halo = new T.MeshBasicMaterial({ color: 0xd9c3fa, fog: false });
  const eclipse = new T.MeshBasicMaterial({ color: 0x0c0914, fog: false });
  const runeMetal = metal(0x513b63, .46);
  const lampGeometry = new T.OctahedronGeometry(.23);
  const linkGeometry = new T.TorusGeometry(.21, .038, 6, 12);

  function ring(geometry, material, x, y, z) {
    const item = new T.Mesh(geometry, material);
    item.position.set(x, y, z);
    sanctum.add(item);
    return item;
  }

  box(sanctum, obsidian, 0, -.21, -2, 28, .22, 43);
  for (let row = 0; row < 24; row++) {
    for (let col = 0; col < 16; col++) {
      const x = (col - 7.5) * 1.6, z = -22 + (row + .5) * 1.65;
      box(sanctum, stone[(row * 13 + col * 17 + (row ^ col)) % stone.length], x, -.045, z, 1.56, .09, 1.61);
    }
  }

  for (const { x, z, w, d, h } of [...barriers, ...cover, ...roofs]) {
    box(sanctum, stone[1], x, h / 2, z, w, h, d);
    for (let y = .52; y < h - .18; y += .52) {
      box(sanctum, stone[Math.round(y * 2) % stone.length], x, y, z, w + .035, .05, d + .035);
    }
    box(sanctum, obsidian, x, .14, z, w, .28, d);
    box(sanctum, silver, x, h - .11, z, w, .13, d);
  }
  for (const { x, z, w, d, h } of roofs) {
    for (const side of [-1, 1]) {
      box(sanctum, silver, x + side * (w / 2 - .22), h - .44, z + d / 2 + .026, .31, .55, .052);
    }
  }

  for (const { x, z, w, d, h } of coverZones) {
    box(sanctum, inlay, x, h + .009, z, w, .018, d);
    for (const side of [-1, 1]) {
      box(sanctum, seam, x + side * (w / 2 - .09), h + .02, z, .045, .012, d - .12);
      box(sanctum, seam, x, h + .02, z + side * (d / 2 - .08), w - .12, .012, .044);
    }
    const light = new T.PointLight(0xd8c8ff, 11, Math.max(5, Math.max(w, d)), 1.8);
    light.position.set(x, h + 1.8, z);
    sanctum.add(light);
    for (const offset of [-.30, .3]) {
      const lampX = x - w / 2 + .17, lampZ = z + d * offset;
      box(sanctum, obsidian, lampX, h + .12, lampZ, .28, .24, .28);
      ring(lampGeometry, seam, lampX, h + .43, lampZ).scale.y = 1.55;
    }
  }

  for (const side of [-1, 1]) {
    for (const z of [-19.4, -12.9, -6.4, .1, 6.6, 13.1]) {
      box(sanctum, obsidian, side * 12.83, 4.15, z, .65, 8.3, 1.12);
      box(sanctum, silver, side * 12.5, 4.8, z, .04, 2.45, .45);
      box(sanctum, runeMetal, side * 12.46, 4.8, z, .06, 2.15, .32);
    }
    box(sanctum, obsidian, side * 3.05, 4.15, -21.82, .92, 8.3, .38);
    box(sanctum, silver, side * 3.05, 4.15, -21.6, .09, 7.9, .02);
    for (let i = 0; i < 11; i++) {
      const link = ring(linkGeometry, runeMetal, side * (3.25 + i * .62), 6.9 + i * .21, -20.6);
      link.rotation.set(0, i % 2 ? Math.PI * .42 : -.12, .32);
      link.scale.set(1.9, .88, 1);
    }
  }

  const eclipseZ = -21.47;
  ring(new T.RingGeometry(2.45, 2.64, 64), halo, 0, 6.02, eclipseZ);
  ring(new T.CircleGeometry(2.46, 64), eclipse, 0, 6.02, eclipseZ + .015);
  ring(new T.RingGeometry(2.77, 2.79, 64), runeMetal, 0, 6.02, eclipseZ);
  const dais = ring(new T.RingGeometry(1.22, 1.28, 32), silver, throne.x, .026, throne.z);
  dais.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const rune = ring(new T.RingGeometry(.15, .19, 4), seam,
      throne.x + Math.sin(i * Math.PI / 3) * 1.53, .027, throne.z + Math.cos(i * Math.PI / 3) * 1.53);
    rune.rotation.x = -Math.PI / 2;
  }
  box(sanctum, obsidian, 0, 1.55, -21.8, 1.9, 3.1, .3);
  box(sanctum, silver, 0, 2.28, -21.62, .038, 1.35, .06);
  batchStonework(sanctum);

  const sky = new T.HemisphereLight(0xbab1ef, 0x312245, 1.38);
  const moon = new T.DirectionalLight(0xc2b3f4, 1.9);
  moon.position.set(-7, 15, -10);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 23, bottom: -23, far: 50 });
  moon.shadow.normalBias = .036;
  const throneLight = new T.PointLight(0xbc84e9, 42, 9, 1.65);
  throneLight.position.set(0, 4.6, -19.4);
  scene.add(sky, moon, throneLight);

  return { limits, colliders: cover, ledges: roofs, roofs, coverZones, barriers, cameraBlockers: roofs };
}
