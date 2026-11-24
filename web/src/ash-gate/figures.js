import * as T from 'three';

export const metal = (color, roughness = .84) => new T.MeshStandardMaterial({ color, roughness });
const cube = new T.BoxGeometry(1, 1, 1);
const sphere = new T.SphereGeometry(1, 18, 12);

export function mesh(parent, geometry, material, x, y, z) {
  const m = new T.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function box(parent, material, x, y, z, w, h, d) {
  const m = mesh(parent, cube, material, x, y, z);
  m.scale.set(w, h, d);
  return m;
}

export function batchStonework(scene) {
  scene.updateMatrixWorld(true);
  const batches = new Map();
  scene.traverse((object) => {
    if (object.geometry !== cube) return;
    if (!batches.has(object.material)) batches.set(object.material, []);
    batches.get(object.material).push(object);
  });
  for (const [material, parts] of batches) {
    if (parts.length < 2) continue;
    const instances = new T.InstancedMesh(cube, material, parts.length);
    instances.castShadow = instances.receiveShadow = true;
    for (const [i, part] of parts.entries()) {
      instances.setMatrixAt(i, part.matrixWorld);
      part.removeFromParent();
    }
    scene.add(instances);
  }
}

function oval(parent, material, x, y, z, w, h, d) {
  const m = mesh(parent, sphere, material, x, y, z);
  m.scale.set(w, h, d);
  return m;
}

function group(parent, x, y, z) {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function cape(parent, fabric, trim) {
  const positions = [], indices = [], edges = [], uv = [];
  const cols = 24, rows = 18;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const u = i / cols * 2 - 1, v = j / rows;
      const x = u * (.37 + v * .26);
      const y = -v * (1.3 - .16 * u * u) + .075 * v ** 6 * Math.sin(u * 13);
      const z = .18 + .27 * v + (.025 + v * .045) * Math.cos(u * 14 + v * 2) - .11 * u * u;
      positions.push(x, y, z);
      uv.push(i / cols, 1 - v);
      if (i === cols || i === 0 || j === rows) edges.push([i, j, x, y, z]);
      if (i < cols && j < rows) {
        const a = j * (cols + 1) + i;
        indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
      }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const cloth = mesh(parent, geo, fabric, 0, 1.53, .02);
  for (const chain of [
    edges.filter(([i]) => i === 0), edges.filter(([i]) => i === cols), edges.filter(([, j]) => j === rows),
  ]) {
    const curve = new T.CatmullRomCurve3(chain.map(([, , x, y, z]) => new T.Vector3(x, y, z + .005)));
    mesh(cloth, new T.TubeGeometry(curve, 28, .009, 4, false), trim, 0, 0, 0);
  }
  return cloth;
}

function weave() {
  const swatch = document.createElement('canvas');
  swatch.width = swatch.height = 128;
  const ctx = swatch.getContext('2d');
  const data = ctx.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = (x + y * 128) * 4;
      const value = 220 + 12 * Math.cos(x * Math.PI / 2) + 8 * Math.sin(y * Math.PI / 2)
        + 9 * Math.sin(x * .23 + y * .26);
      data.data.set([value, value, value, 255], i);
    }
  }
  ctx.putImageData(data, 0, 0);
  const texture = new T.CanvasTexture(swatch);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(3, 4);
  return texture;
}

export function figure(scene, kind) {
  const hunter = kind === 'hunter', boss = kind === 'warden';
  const coat = metal(hunter ? 0x77746a : boss ? 0x332326 : 0x303a37);
  const hood = metal(hunter ? 0xa39b88 : 0x48413f);
  const boot = metal(0x211c1c);
  const leather = metal(hunter ? 0x543931 : 0x362828);
  const iron = metal(boss ? 0x71453a : 0x6b6965, .43);
  const brass = metal(0x927452, .5);
  const fabric = new T.MeshStandardMaterial({ color: hunter ? 0x81837c : 0x4b1d18, side: T.DoubleSide, roughness: 1 });
  if (hunter) {
    fabric.map = fabric.bumpMap = weave();
    fabric.bumpScale = .014;
  }
  const trim = metal(hunter ? 0x756758 : 0x82513b);
  const ember = new T.MeshBasicMaterial({ color: boss ? 0xff9d4b : 0xd38853 });
  const root = group(scene, 0, 0, 0);
  const body = group(root, 0, 0, 0);
  const chest = oval(body, coat, 0, 1.3, 0, .36, .42, .22);
  chest.scale.x *= boss ? 1.22 : 1;
  oval(body, leather, 0, 1.036, -.015, .33, .075, .24);
  box(body, brass, 0, 1.045, -.245, .14, .095, .03);
  const cloth = cape(body, fabric, trim);
  if (hunter) {
    const sash = mesh(body, new T.PlaneGeometry(.23, .79, 5, 14),
      new T.MeshStandardMaterial({ color: 0x6b2826, side: T.DoubleSide, roughness: 1 }), -.23, .79, .24);
    const p = sash.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = p.getY(i);
      p.setXYZ(i, p.getX(i) + v * .22, v, .10 - v * .19 + .023 * Math.sin(v * 23 + p.getX(i) * 28));
    }
    sash.geometry.computeVertexNormals();
  }
  const belt = box(body, leather, 0, 1.34, .226, .098, .53, .045);
  belt.rotation.z = -.62;
  const beltPin = box(body, brass, .02, 1.36, .252, .096, .069, .025);
  beltPin.rotation.z = -.62;
  oval(body, leather, -.26, .99, .17, .105, .13, .067);
  const hoodShape = oval(body, hood, 0, 1.76, .001, .228, .285, .235);
  hoodShape.rotation.x = -.19;
  if (hunter) {
    const crown = new T.SphereGeometry(1, 24, 16);
    const p = crown.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), ridge = Math.max(0, y) ** 2;
      p.setXYZ(i, p.getX(i) * (1 - .32 * ridge), y + .44 * ridge, p.getZ(i) - .34 * ridge);
    }
    crown.computeVertexNormals();
    hoodShape.geometry = crown;
    const seam = new T.CatmullRomCurve3([
      new T.Vector3(0, 1.59, .19), new T.Vector3(0, 1.74, .235),
      new T.Vector3(0, 1.88, .185), new T.Vector3(0, 2.05, .073), new T.Vector3(0, 2.17, -.057),
    ]);
    mesh(body, new T.TubeGeometry(seam, 12, .008, 4, false), trim, 0, 0, 0);
  }
  oval(body, boot, 0, 1.743, -.184, .146, .195, .081);
  const peak = mesh(body, new T.ConeGeometry(.17, .30, 4), hood, 0, 1.88, -.114);
  peak.rotation.x = -Math.PI / 2.8;
  oval(body, coat, 0, 1.55, .035, .27, .10, .23);
  oval(body, trim, 0, 1.55, .254, .07, .058, .018);
  if (!hunter) {
    for (const side of [-1, 1]) {
      box(body, ember, side * .063, 1.78, -.257, .064, .016, .013).rotation.z = side * .2;
      if (boss) {
        const path = new T.CatmullRomCurve3([
          new T.Vector3(side * .12, 1.93, 0), new T.Vector3(side * .25, 2.09, .035),
          new T.Vector3(side * .23, 2.23, .105), new T.Vector3(side * .18, 2.30, .14),
        ]);
        mesh(body, new T.TubeGeometry(path, 9, .044, 6, false), iron, 0, 0, 0);
      }
    }
  }
  const arms = [], legs = [], knees = [];
  let hiddenBlade;
  for (const side of [-1, 1]) {
    const arm = group(body, side * .333, 1.50, 0);
    arm.rotation.z = side * .14;
    oval(arm, hunter ? coat : iron, side * .025, -.115, 0, boss ? .22 : .125, .229, .133);
    oval(arm, leather, .012 * side, -.34, -.036, .102, .179, .108);
    box(arm, iron, .01 * side, -.34, .036, .148, .172, .065);
    oval(arm, boot, 0, -.52, -.046, .083, .088, .076);
    if (hunter && side === 1) {
      hiddenBlade = mesh(arm, new T.CylinderGeometry(.045, .002, .28, 4), iron, 0, -.42, -.12);
      hiddenBlade.scale.z = .30;
      box(arm, leather, 0, -.385, -.062, .16, .21, .082);
    } else if (!hunter && side === 1) {
      const weapon = group(arm, 0, -.488, -.079);
      weapon.rotation.x = hunter ? -.36 : -.7;
      box(weapon, leather, 0, -.04, 0, .064, .25, .058);
      box(weapon, brass, 0, -.16, 0, .21, .045, .07);
      const blade = mesh(weapon, new T.CylinderGeometry(.074, .002, hunter ? .45 : .74, 4), iron, 0, hunter ? -.39 : -.55, 0);
      blade.scale.z = .34;
    }
    arms.push(arm);
    const leg = group(body, side * .168, .936, 0);
    oval(leg, coat, 0, -.214, 0, .125, .243, .125);
    const knee = group(leg, 0, -.408, 0);
    oval(knee, boot, 0, -.22, 0, .102, .246, .106);
    box(knee, iron, 0, -.14, -.075, .144, .25, .08);
    oval(knee, boot, 0, -.43, -.067, .114, .089, .174);
    legs.push(leg);
    knees.push(knee);
  }
  if (boss) root.scale.setScalar(1.48);

  function pose(time, speed = 0, crouch = 0, strike = 0, climbing = 0) {
    const swing = Math.sin(time) * speed, attack = Math.sin(strike * Math.PI), mantle = Math.sin(climbing * Math.PI);
    body.position.y = -.34 * crouch + Math.abs(swing) * .043 + Math.sin(time * .45) * .012;
    body.rotation.x = -.20 * crouch - speed * .09 - attack * .23 - mantle * .16;
    body.rotation.y = -attack * .50 + swing * .07;
    cloth.rotation.x = -.13 - speed * .36 + Math.sin(time * 1.15) * (.03 + speed * .06);
    cloth.rotation.z = swing * .08;
    for (let i = 0; i < 2; i++) {
      const stride = swing * (i ? 1 : -1);
      arms[i].rotation.x = -stride * .61 - crouch * .46 - (i ? attack * 1.66 : 0) - mantle * (i ? 2.4 : 2.81);
      arms[i].rotation.z = (i ? 1 : -1) * (.16 + (i ? attack * .48 : 0));
      legs[i].rotation.x = stride * .60 - crouch * .57 - mantle * (i ? .51 : .89);
      knees[i].rotation.x = Math.max(0, -stride * .59) + crouch * .90 + mantle * .62;
    }
    if (hiddenBlade) hiddenBlade.position.y = -.39 - .25 * attack;
  }

  return { root, body, pose };
}
