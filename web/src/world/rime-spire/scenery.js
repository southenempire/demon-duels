import { barriers, bounds, buttresses, caveWalls, colliders, coverZones, ice, roofBodies, roofs, stone } from './layout.js';
import { maxTracks } from './tracks.js';

export function buildSpire(T, scene, intel) {
  const material = (color, roughness = .85, extra) => new T.MeshStandardMaterial({ color, roughness, ...extra });
  const snow = material(0xc0d3e0);
  const stonework = [0x7d8e9d, 0x95a9b7, 0xa3b5c2, 0x8d9aaa].map((color) => material(color));
  const trim = material(0xc3d1d9);
  const paving = [0x54677b, 0x62798a, 0x6c8293].map((color) => material(color));
  const deep = material(0x273e58);
  const frozen = material(0x659db6, .19, { metalness: .28 });
  const caveIce = material(0x51829e, .42, { side: T.DoubleSide });
  const crystal = material(0x89cada, .26, { metalness: .28, flatShading: true });
  const metal = material(0x667581, .36, { metalness: .68 });
  const bellMetal = material(0x898072, .38, { metalness: .72 });
  const glass = material(0x326d98, .46, { emissive: 0x164671, emissiveIntensity: .72 });
  const light = new T.MeshBasicMaterial({ color: 0xacfcff });
  const boxGeometry = new T.BoxGeometry();
  const groups = new Map();
  const root = new T.Group();
  root.name = 'Rime Spire';
  scene.add(root);

  function box(mat, x, y, z, w, h, d) {
    if (!groups.has(mat)) groups.set(mat, []);
    groups.get(mat).push([x, y, z, w, h, d]);
  }
  function shape(mat, geometry, x, y, z) {
    const mesh = new T.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  function masonry({ x, z, w, d, h }, cap = trim) {
    const across = w >= d;
    const length = across ? w : d;
    const rows = Math.ceil(h / .47);
    const rowHeight = h / rows;
    const width = length / Math.ceil(length / 1.05);
    for (let row = 0; row < rows; row++) {
      for (let start = -width * (row % 2) / 2, col = 0; start < length; start += width, col++) {
        const from = Math.max(0, start), to = Math.min(length, start + width);
        if (to - from < .06) continue;
        const shift = (from + to - length) / 2;
        const mat = stonework[(row * 3 + col) % stonework.length];
        const span = to - from - .024;
        box(mat, x + (across ? shift : 0), (row + .5) * rowHeight, z + (across ? 0 : shift),
          across ? span : w, rowHeight - .023, across ? d : span);
      }
    }
    box(cap, x, h - .057, z, w, .114, d);
  }

  box(snow, 0, -.11, 0, 85, .22, 85);
  ice.forEach(({ x, z, w, d }, pond) => {
    box(frozen, x, .001, z, w, .009, d);
    for (let i = 0; i < 8; i++) {
      const crack = shape(i % 2 ? crystal : deep, new T.PlaneGeometry(w * (.19 + i % 3 * .095), .014),
        x + Math.sin(i * 6 + pond) * w * .24, .012, z + Math.cos(i * 2) * d * .37);
      crack.rotation.set(-Math.PI / 2, 0, i * 1.7);
    }
  });
  for (const { x, z, w, d } of stone) {
    const countX = Math.ceil(w / 1.22), countZ = Math.ceil(d / 1.08);
    const tileW = w / countX, tileD = d / countZ;
    for (let i = 0; i < countX; i++) {
      for (let j = 0; j < countZ; j++) {
        box(paving[(i + j * 2) % paving.length], x - w / 2 + (i + .5) * tileW, .015,
          z - d / 2 + (j + .5) * tileD, tileW - .025, .026, tileD - .025);
      }
    }
  }

  for (const wall of [...buttresses, ...roofBodies, ...barriers]) masonry(wall);
  for (const { x, z, w, d, h } of roofs) {
    box(trim, x, h - .12, z, w, .23, d);
    box(snow, x, h - .017, z, w * .94, .034, d * .96);
    for (const ox of [-.31, .31]) {
      box(deep, x + ox * w, h * .54, z + d / 2 - .318, .31, .85, .027);
      box(glass, x + ox * w, h * .54 + .014, z + d / 2 - .298, .19, .67, .016);
    }
  }

  caveWalls.forEach((wall) => masonry(wall, crystal));
  coverZones.forEach(({ x, z, w, d }, index) => {
    const side = index === 0 ? -1 : 1;
    box(deep, x, .006, z, w, .012, d);
    const canopy = shape(caveIce,
      new T.CylinderGeometry(1, 1, d + .74, 6, 1, true, Math.PI / 2, Math.PI), x + side * .19, 2.3, z);
    canopy.rotation.x = Math.PI / 2;
    canopy.scale.set(w * .77, 1, .94);
    for (let i = 0; i < 6; i++) {
      const icicle = shape(crystal, new T.ConeGeometry(.11 + i % 3 * .065, .44 + i % 3 * .24, 4),
        x - side * .98, 2.33 - i % 3 * .13, z + (i - 2.5) * .59);
      icicle.rotation.z = Math.PI;
    }
  });

  function arch(x, z, width, spring, color) {
    const path = new T.Shape(), thickness = .36;
    path.moveTo(-width / 2 - thickness, 0);
    path.lineTo(-width / 2 - thickness, spring);
    path.quadraticCurveTo(-width / 2 - thickness, spring + width * .44, 0, spring + width * .76 + thickness);
    path.quadraticCurveTo(width / 2 + thickness, spring + width * .44, width / 2 + thickness, spring);
    path.lineTo(width / 2 + thickness, 0);
    path.lineTo(width / 2, 0);
    path.lineTo(width / 2, spring);
    path.quadraticCurveTo(width / 2, spring + width * .35, 0, spring + width * .76);
    path.quadraticCurveTo(-width / 2, spring + width * .35, -width / 2, spring);
    path.lineTo(-width / 2, 0);
    path.closePath();
    shape(color, new T.ExtrudeGeometry(path, { depth: .28, bevelEnabled: false, curveSegments: 10 }), x, 0, z);
  }

  for (const x of [-6.1, 1.4, 7.9]) arch(x, -14.81, x === 1.4 ? 4.2 : 2.9, 2.5, trim);
  const rose = shape(glass, new T.CircleGeometry(1.12, 24), 1.4, 5.28, -14.57);
  rose.castShadow = false;
  shape(trim, new T.TorusGeometry(1.07, .105, 8, 24), 1.4, 5.28, -14.53);
  for (let i = 0; i < 6; i++) {
    const spoke = shape(trim, new T.BoxGeometry(.048, 1.04, .08),
      1.4 + Math.sin(i * Math.PI / 3) * .52, 5.28 + Math.cos(i * Math.PI / 3) * .52, -14.47);
    spoke.rotation.z = -i * Math.PI / 3;
  }
  for (const x of [-.28, 3.08]) {
    for (const z of [-16.7, -14.35]) {
      box(trim, x, 8.4, z, .46, 5.4, .46);
      shape(deep, new T.ConeGeometry(.47, 2.15, 4), x, 12.4, z).rotation.y = Math.PI / 4;
    }
  }
  box(stonework[0], 1.4, 10.95, -15.55, 3.95, .45, 3.1);
  shape(deep, new T.ConeGeometry(2.6, 4.6, 4), 1.4, 13.25, -15.55).rotation.y = Math.PI / 4;
  const bell = new T.LatheGeometry([[0, 0], [.94, 0], [.89, .18], [.69, .39], [.57, 1], [.42, 1.29], [0, 1.38]]
    .map(([r, y]) => new T.Vector2(r, y)), 24);
  shape(bellMetal, bell, 1.4, 8.48, -15.17);
  shape(metal, new T.SphereGeometry(.18, 10, 8), 1.4, 8.37, -15.17);
  box(metal, 1.4, 10.01, -15.17, 2.95, .18, .24);
  for (let i = 0; i < 13; i++) {
    const x = (i % 2 ? -1 : 1) * (13 + i % 3 * 2.1);
    const z = 15 - i * 3.18, h = 6 + i % 5 * 1.32;
    box(stonework[i % 4], x, h * .5, z, 2.35, h, 2.65);
    shape(deep, new T.ConeGeometry(1.85, 2.9 + i % 4, 4), x, h + (2.9 + i % 4) / 2, z).rotation.y = Math.PI / 4;
  }
  for (const [x, z] of [[-6.95, 10.9], [-8.64, 1.12], [-6.82, -9.61], [4.45, -11.9]]) {
    box(deep, x, .52, z, .25, 1.04, .25);
    shape(light, new T.OctahedronGeometry(.195), x, 1.19, z);
    const lantern = new T.PointLight(0x70ceff, 2, 4);
    lantern.position.set(x, 1.26, z);
    root.add(lantern);
  }
  const inscriptions = new Map();
  for (const { id, pos: { x, y, z }, text } of intel) {
    box(deep, x, y + .27, z, .45, .54, .42);
    const scroll = shape(trim, new T.CylinderGeometry(.09, .09, .39, 10), x, y + .59, z);
    scroll.rotation.z = Math.PI / 2;
    shape(light, new T.OctahedronGeometry(.075), x, y + .78, z);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 176;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      const colon = text.indexOf(':');
      ctx.fillStyle = '#101e30ef';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#8bb1cb';
      ctx.lineWidth = 3;
      ctx.strokeRect(6, 6, 628, 164);
      ctx.font = 'bold 28px Georgia';
      ctx.fillStyle = '#9fdef6';
      ctx.fillText(text.slice(0, colon).toUpperCase(), 26, 49);
      ctx.font = '30px Georgia';
      ctx.fillStyle = '#e8f5fd';
      let line = '', row = 92;
      for (const word of text.slice(colon + 2).split(' ')) {
        if (line && ctx.measureText(line + ' ' + word).width > 575) {
          ctx.fillText(line, 26, row);
          line = '';
          row += 38;
        }
        line += (line ? ' ' : '') + word;
      }
      ctx.fillText(line, 26, row);
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      const inscription = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
      inscription.name = id;
      inscription.position.set(x, y + 1.54, z);
      inscription.scale.set(2.05, .565, 1);
      inscription.visible = false;
      inscriptions.set(id, inscription);
      root.add(inscription);
    }
  }

  const dummy = new T.Object3D();
  for (const [mat, boxes] of groups) {
    const batch = new T.InstancedMesh(boxGeometry, mat, boxes.length);
    batch.castShadow = mat !== snow && mat !== frozen;
    batch.receiveShadow = true;
    boxes.forEach(([x, y, z, w, h, d], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      batch.setMatrixAt(i, dummy.matrix);
    });
    root.add(batch);
  }

  const sky = new T.HemisphereLight(0xcceaff, 0x677f9f, 2.05);
  const moon = new T.DirectionalLight(0xe1f5ff, 2.45);
  moon.position.set(-9, 18, 6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1536, 1536);
  Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 19, bottom: -19, far: 46 });
  moon.shadow.normalBias = .025;
  root.add(sky, moon);

  const footprint = new T.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
  const prints = new T.InstancedMesh(footprint, new T.MeshStandardMaterial({ color: 0x7791ac, roughness: .99 }), maxTracks);
  prints.name = 'Snow footprints';
  prints.count = 0;
  prints.frustumCulled = false;
  prints.receiveShadow = true;
  root.add(prints);

  return {
    colliders, ledges: roofs, roofs, coverZones, barriers, limits: bounds,
    showIntel(id) {
      for (const [key, inscription] of inscriptions) inscription.visible = key === id;
    },
    drawTracks(tracks) {
      prints.count = tracks.length;
      tracks.forEach(({ pos, yaw, offset }, i) => {
        dummy.position.set(pos.x + Math.cos(yaw) * offset, .038, pos.z - Math.sin(yaw) * offset);
        dummy.rotation.y = yaw;
        dummy.scale.set(.065, 1, .14);
        dummy.updateMatrix();
        prints.setMatrixAt(i, dummy.matrix);
      });
      prints.instanceMatrix.needsUpdate = true;
    },
  };
}
