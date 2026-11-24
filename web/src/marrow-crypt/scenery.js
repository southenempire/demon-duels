import * as T from 'three';
import { batchStonework, box, figure, mesh, metal } from '../ash-gate/figures.js';
import { boss, crowd, roofs, walls } from './stealth.js';

export function buildCitadel(scene) {
  const slate = metal(0x24232d), mortar = metal(0x352e34), ivory = metal(0x9a8564);
  const ash = metal(0x625967), gold = metal(0xa37943, .47), velvet = metal(0x501c44);
  const light = new T.MeshBasicMaterial({ color: 0xb5ffde });
  scene.add(new T.HemisphereLight(0xc4b9ef, 0x5b3e46, 2.1));
  const moon = new T.DirectionalLight(0xd3c6ff, 2.65);
  moon.position.set(-7, 14, 4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -15, right: 15, top: 17, bottom: -17, far: 48 });
  moon.shadow.normalBias = .045;
  scene.add(moon);
  box(scene, slate, 0, -.22, 0, 26, .4, 35);
  for (let z = -14; z <= 15; z++) {
    for (let x = -9; x <= 9; x++) {
      const hue = Math.abs((x * 13 + z * 7) % 8);
      box(scene, hue === 1 ? ivory : hue < 5 ? mortar : ash,
        x, -.04, z, .96, .08, .96);
    }
  }
  for (const side of [-1, 1]) {
    box(scene, slate, side * 10.65, 3.8, 0, 1.15, 7.6, 31);
    for (let z = -14; z < 15; z += 2.2) {
      box(scene, mortar, side * 10.1, 3.6, z, .52, 7.2, .65);
      box(scene, ivory, side * 10, 6.7, z, .72, .27, .8);
      box(scene, velvet, side * 9.98, 4.9, z + 1.1, .06, 2.75, 1.1);
    }
  }
  box(scene, slate, 0, 4.4, -14.75, 22, 8.8, 1.25);
  for (let x = -8; x <= 8; x += 4) {
    const arch = mesh(scene, new T.TorusGeometry(1.38, .11, 6, 18, Math.PI), ivory, x, 5.6, -14.07);
    arch.castShadow = false;
    for (const side of [-1, 1]) box(scene, ivory, x + side * 1.38, 3.55, -14.07, .2, 4.1, .22);
    box(scene, velvet, x, 3.95, -14.02, 1.78, 4.25, .12);
  }
  for (const { x, z, h, w, d } of [...roofs, ...walls]) {
    box(scene, slate, x, h / 2, z, w, h, d);
    box(scene, ivory, x, h - .11, z, w, .22, d);
    box(scene, gold, x, h - .31, z, w, .075, d);
    for (let off = -d / 2 + .37; off <= d / 2 - .35; off += .68) {
      for (const side of [-1, 1]) {
        const rib = mesh(scene, new T.CylinderGeometry(.048, .092, h * .71, 5), ivory, x + side * (w / 2 - .045), h * .43, z + off);
        rib.rotation.x = .17 * side;
      }
    }
  }
  box(scene, gold, 0, boss.y + 1.12, -11.81, 2.05, 2.1, .42);
  box(scene, velvet, 0, boss.y + 1.35, -11.56, 1.62, 1.63, .16);
  mesh(scene, new T.TorusGeometry(1.17, .055, 6, 32), gold, 0, boss.y + 3.15, -11.82);
  for (const [x, z, y = 0] of [[-8.7, 11.5], [8.7, 11.5], [-8.7, .2], [8.7, .2], [-1.6, -11.18, boss.y], [1.6, -11.18, boss.y]]) {
    box(scene, mortar, x, y + .47, z, .42, .94, .42);
    mesh(scene, new T.OctahedronGeometry(.25), light, x, y + 1.25, z);
    const lantern = new T.PointLight(0x90f7cc, 17, 6);
    lantern.position.set(x, y + 1.3, z);
    scene.add(lantern);
  }
  const marker = mesh(scene, new T.RingGeometry(.72, .77, 28), gold, boss.x, boss.y + .015, boss.z);
  marker.rotation.x = -Math.PI / 2;
  batchStonework(scene);

  const courtiers = crowd.flatMap((area) => Array.from({ length: 8 }, (_, i) => {
    const courtier = figure(scene, 'guard', i % 2 ? 0x785d76 : 0x47394b);
    courtier.root.scale.setScalar(.65 + .04 * (i % 3));
    courtier.root.position.set(area.x + (i % 3 - 1) * .84, 0, area.z + (Math.floor(i / 3) - 1) * .92);
    courtier.root.rotation.y = .28 * (i % 3 - 1);
    return courtier;
  }));
  return (time) => courtiers.forEach((actor, i) => actor.pose(time * 2.1 + i * .5));
}
