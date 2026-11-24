import { batchStonework, box as placeBox } from '../ash-gate/figures.js';
import { basins, causeways, colliders, coverZones, fogDensity, inWater, limits, mireTime, perimeter, roofs } from './layout.js';

export function scenery(T, scene) {
  let seed = 3023;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const stone = [0x303f3d, 0x3b4e48, 0x44514a, 0x354645].map((color) =>
    new T.MeshStandardMaterial({ color, roughness: .91 }));
  const material = (color, roughness = .9) => new T.MeshStandardMaterial({ color, roughness });
  const moss = material(0x536b3b);
  const timber = [0x4e5140, 0x585644, 0x3c483a].map((color) => material(color));
  const box = (mat, x, y, z, w, h, d) => placeBox(scene, mat, x, y, z, w, h, d);
  const stoneAt = () => stone[Math.floor(rand() * stone.length)];
  box(material(0x2d4135), 0, -.22, 0, 27, .44, 35);

  for (const wall of colliders) {
    const { x, z, w, d, h } = wall;
    const alongZ = d > w;
    const span = alongZ ? d : w;
    const courses = Math.ceil(h / .47);
    const stride = span / Math.ceil(span / 1.35);
    const rowHeight = h / courses;
    box(stone[0], x, h / 2 - .025, z, w - .045, h - .05, d - .045);
    for (let row = 0; row < courses; row++) {
      for (let left = row % 2 ? -stride / 2 : 0; left < span; left += stride) {
        const lo = Math.max(0, left), hi = Math.min(span, left + stride);
        const offset = (lo + hi - span) / 2;
        const length = hi - lo - .026;
        const tint = row < 3 && rand() < .22 ? moss : stoneAt();
        box(tint, x + (alongZ ? 0 : offset), (row + .5) * rowHeight, z + (alongZ ? offset : 0),
          alongZ ? w : length, rowHeight - .027, alongZ ? length : d);
      }
    }
    box(stone[2], x, h - .065, z, w, .13, d);
  }

  for (const { x, z, w, d } of causeways) {
    const across = w > d;
    const length = across ? w : d;
    const rows = Math.ceil(length / .42);
    const step = length / rows;
    for (let i = 0; i < rows; i++) {
      const shift = -length / 2 + step * (i + .5);
      box(timber[i % 3], x + (across ? shift : 0), .029, z + (across ? 0 : shift),
        across ? step - .016 : w, .058, across ? d : step - .016);
    }
  }

  const waterGeometry = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const water = new T.MeshStandardMaterial({ color: 0x274e43, metalness: .42, roughness: .38, emissive: 0x132a24,
    emissiveIntensity: .55 });
  basins.forEach(({ x, z, w, d }, i) => {
    const surface = new T.Mesh(waterGeometry, water);
    surface.position.set(x, .019 + i * .001, z);
    surface.scale.set(w, 1, d);
    surface.receiveShadow = true;
    scene.add(surface);
  });

  const reeds = new T.InstancedMesh(new T.ConeGeometry(.07, 1, 4), material(0x657345), 420);
  const stalk = new T.Object3D();
  let count = 0;
  for (const zone of coverZones) {
    for (let i = 0; i < 92; i++) {
      const x = zone.x + (rand() - .5) * zone.w, z = zone.z + (rand() - .5) * zone.d;
      const h = .32 + rand() * .9;
      stalk.position.set(x, h / 2, z);
      stalk.scale.set(.4 + rand() * .7, h, .65);
      stalk.rotation.set((rand() - .5) * .46, rand() * Math.PI, (rand() - .5) * .6);
      stalk.updateMatrix();
      reeds.setMatrixAt(count++, stalk.matrix);
    }
  }
  for (let i = 0; i < 144; i++) {
    const x = (rand() < .5 ? -1 : 1) * (9 + rand() * 1.5), z = -13 + rand() * 24;
    stalk.position.set(x, .2, z);
    stalk.scale.set(.6, .4 + rand() * .48, .66);
    stalk.updateMatrix();
    reeds.setMatrixAt(count++, stalk.matrix);
  }
  reeds.count = count;
  scene.add(reeds);

  const ripple = new T.RingGeometry(.92, 1, 28);
  ripple.rotateX(-Math.PI / 2);
  const rippleMaterial = new T.MeshBasicMaterial({ color: 0x739285, transparent: true, opacity: .24, depthWrite: false });
  for (let i = 0; i < 24; i++) {
    const basin = basins[i % basins.length];
    const x = basin.x + (rand() - .5) * basin.w, z = basin.z + (rand() - .5) * basin.d;
    if (!inWater({ x, z })) continue;
    const crest = new T.Mesh(ripple, rippleMaterial);
    crest.position.set(x, .026, z);
    crest.scale.set(.18 + rand() * .55, 1, .11 + rand() * .3);
    scene.add(crest);
  }

  const iron = material(0x333b33, .65);
  const lanternBody = new T.MeshStandardMaterial({ color: 0xb9d68c, emissive: 0x97be62, emissiveIntensity: 1.6 });
  function lantern(x, z, y, intensity) {
    box(iron, x, y / 2, z, .1, y, .1);
    box(lanternBody, x, y, z, .21, .26, .21);
    box(iron, x, y + .17, z, .3, .07, .3);
    const light = new T.PointLight(0xb2d08e, intensity, 5.6, 1.7);
    light.position.set(x, y, z);
    scene.add(light);
  }
  lantern(-1.36, 11.7, 1.55, 10);
  lantern(-8.03, 8.9, 1.7, 11);
  lantern(-7.18, -5.3, 1.7, 14);
  lantern(5.85, -6.85, 1.6, 13);
  lantern(-2.8, -12.4, 1.25, 19);
  lantern(2.8, -12.4, 1.25, 19);

  const altar = new T.Mesh(new T.RingGeometry(1.36, 1.45, 16), material(0x7c8864));
  altar.rotation.x = -Math.PI / 2;
  altar.position.set(0, .063, -10.7);
  scene.add(altar);
  for (const roof of roofs) {
    box(timber[1], roof.x, roof.h - .027, roof.z, roof.w - .19, .054, roof.d - .19);
    for (const side of [-1, 1]) {
      const panel = box(iron, roof.x + side * roof.w * .22, roof.h * .58, roof.z + roof.d / 2, .29, .73, .085);
      panel.rotation.z = side * .12;
    }
  }
  for (const x of [-8.8, -5.3, -1.8, 1.8, 5.3, 8.8]) {
    const rim = perimeter[2];
    box(stoneAt(), x, rim.h + .22, rim.z, 1.5, .58 + rand() * .8, 1.5);
  }

  scene.add(new T.HemisphereLight(0xa9cbc0, 0x3e4d2c, 2.05));
  const moon = new T.DirectionalLight(0xccf3e7, 2.75);
  moon.position.set(-8, 15, -11);
  moon.castShadow = true;
  moon.shadow.camera.left = moon.shadow.camera.bottom = -17;
  moon.shadow.camera.right = moon.shadow.camera.top = 17;
  moon.shadow.camera.far = 46;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.normalBias = .045;
  scene.add(moon);

  batchStonework(scene);
  function animate() {
    if (scene.fog?.isFogExp2) scene.fog.density = fogDensity(mireTime());
  }
  return { colliders, ledges: roofs, roofs, coverZones, animate, limits };
}
