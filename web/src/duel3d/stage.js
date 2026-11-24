import * as T from 'three';

export function buildStage(scene) {
  scene.background = new T.Color(0x211a21);
  scene.fog = new T.FogExp2(0x211a21, .055);
  scene.add(new T.HemisphereLight(0xe2c6ff, 0xa16f52, 2.5));
  const key = new T.DirectionalLight(0xffd4ad, 3.3);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.camera.left = key.shadow.camera.bottom = -6;
  key.shadow.camera.right = key.shadow.camera.top = 6;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = .04;
  scene.add(key);
  const rim = new T.DirectionalLight(0x91a8ee, 2.6);
  rim.position.set(1, 3, -6);
  scene.add(rim);
  const stone = [0x595057, 0x6d605e, 0x524a4d, 0x655857].map((color) => new T.MeshStandardMaterial({ color, roughness: .88 }));
  const iron = new T.MeshStandardMaterial({ color: 0x332d37, roughness: .72, metalness: .3 });
  const etch = new T.MeshStandardMaterial({ color: 0xdf9c63, emissive: 0xa04b20, emissiveIntensity: .36 });
  const fire = new T.MeshBasicMaterial({ color: 0xffa64a });
  const box = new T.BoxGeometry(1, 1, 1);
  const group = new T.Group();
  scene.add(group);
  function piece(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  piece(new T.CylinderGeometry(9, 9.3, .65, 48), iron, 0, -.44, 0);
  for (let i = -8; i <= 8; i++) for (let j = -7; j <= 7; j++) {
    const x = i * 1.06 + (j % 2) * .28, z = j * 1.02;
    if (Math.hypot(x, z) > 8.1) continue;
    piece(box, stone[Math.abs(i * 13 + j * 7) % 4], x, -.09, z, 1.035, .175, .992);
  }
  for (const radius of [3.25, 3.42, 6.7]) {
    const ring = piece(new T.RingGeometry(radius, radius + .023, 64), etch, 0, .009, 0);
    ring.rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    const mark = piece(box, etch, 3.62 * Math.cos(a), .013, 3.62 * Math.sin(a), .22, .02, .045);
    mark.rotation.y = -a + Math.PI / 4;
  }
  const flames = [];
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 1.97;
    const z = -5.3 + Math.abs(i - 4) ** 2 * .12;
    const height = i % 3 === 2 ? 2.8 : 4.6;
    piece(box, stone[i % 4], x, .18, z, 1.22, .36, 1.12);
    for (let j = 0; j < 6 * height / 4.6; j++) {
      const pillar = piece(box, stone[(i + j) % 4], x, .46 + j * .74, z, .88 - j * .025, .71, .8);
      pillar.rotation.y = (i * j % 5 - 2) * .025;
      pillar.castShadow = true;
    }
    if (i % 2) {
      piece(box, iron, x, 1.08, z + .7, .53, .16, .52);
      const flame = piece(new T.IcosahedronGeometry(.21, 0), fire, x, 1.29, z + .7, 1, 1.7, .85);
      const light = new T.PointLight(0xff792e, 26, 7, 2);
      light.position.copy(flame.position);
      scene.add(light);
      flames.push({ flame, light });
    }
  }
  return (time) => flames.forEach(({ flame, light }, i) => {
    flame.scale.y = 1.6 + .28 * Math.sin(time * 15 + i * 6);
    flame.rotation.y = time * 1.3 + i;
    light.intensity = 24 + 4 * Math.sin(time * 13 + i * 4);
  });
}
