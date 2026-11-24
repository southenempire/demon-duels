import * as T from 'three';

const bossModels = {
  0: { file: 'ash-warden.glb' },
  2: { file: 'marrow-king.glb', height: 2.744 },
  3: { file: 'mire-phantom.glb', height: 3.08 },
  4: { file: 'frost-herald.glb' },
  5: { file: 'gloam-shade.glb' },
};
export const bossModel = (id) => bossModels[id]?.file;
export const bossHeight = (id) => bossModels[id] ? bossModels[id].height ?? 3 : 2.4;
const clips = { strike: 'Strike', feint: 'Strike', block: 'Block', parry: 'Parry', dodge: 'Dodge',
  hit: 'HitReact', death: 'Death', fallen: 'Death', victory: 'Victory' };
const up = new T.Vector3(0, 1, 0);
const delta = new T.Vector3();
const smooth = (x) => T.MathUtils.smoothstep(x, 0, 1);
const pulse = (p) => smooth(p / .42) * (1 - smooth((p - .59) / .41));

export function disposeTree(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse((item) => {
    if (item.geometry) geometries.add(item.geometry);
    if (item.material) for (const material of [item.material].flat()) materials.add(material);
    if (item.isSkinnedMesh) item.skeleton.dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
}

export function createFighter(scene, loader, base, { role, color, size }) {
  const root = new T.Group(), body = new T.Group(), standIn = new T.Group();
  root.add(standIn); standIn.add(body); scene.add(root);
  const stone = role !== 'hunter';
  const file = stone ? bossModel(role) : 'hunter.glb';
  const profile = stone ?
    { guard: 'Idle', counter: 'Heavy', elbows: ['Forearm', 'Elbow'], weapon: 'R' } :
    { guard: 'Guard', counter: 'CounterKill', elbows: ['Elbow'], weapon: 'L' };
  const mat = (value, metalness = .1) => new T.MeshStandardMaterial({ color: value, metalness, roughness: .55 });
  const dark = mat(stone ? 0x211c22 : 0x252331);
  const main = mat(stone ? new T.Color(color).multiplyScalar(.46) : 0x88818e, .33);
  const trim = mat(stone ? new T.Color(color) : 0x9c3439, .28);
  const hand = mat(stone ? 0x786564 : 0xc98e73);
  const blade = mat(0xc8c6bb, .67);
  const glow = new T.MeshBasicMaterial({ color });
  const ball = new T.SphereGeometry(1, 12, 9), box = new T.BoxGeometry(1, 1, 1);
  const bone = new T.CylinderGeometry(1, .8, 1, 8);
  function part(parent, geo, material, x, y, z, sx, sy, sz) {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  const shape = stone ? box : ball;
  part(body, shape, main, 0, 1.22, 0, .46, .53, .29).scale.multiplyScalar(stone ? 1 : .62);
  part(body, box, dark, 0, 1, 0, .39, .19, .29);
  part(body, box, trim, 0, 1.044, .02, .43, .082, .31);
  part(body, box, trim, -.054, .79, .1, .14, .44, .2).rotation.z = -.08;
  part(body, box, dark, 0, 1.05, -.18, .46, .78, .073).rotation.x = .14;
  part(body, shape, dark, 0, 1.63, -.018, stone ? .29 : .17, stone ? .34 : .23, stone ? .28 : .16);
  part(body, shape, main, 0, 1.76, .015, stone ? .32 : .156, stone ? .14 : .15, stone ? .3 : .16);
  part(body, box, dark, 0, 1.625, .132, .23, .08, .035);
  for (const sign of [-1, 1]) {
    part(body, box, glow, sign * .063, 1.639, .154, .071, .019, .009);
    if (stone) {
      part(body, new T.ConeGeometry(.1, .32, 5), main, sign * .18, 1.87, -.033, 1, 1, 1).rotation.z = -sign * .37;
      part(body, box, glow, sign * .11, 1.28, .151, .041, .2, .009).rotation.z = sign * .24;
    }
  }
  function limb(parent, width, material) {
    const mesh = part(parent, bone, material, 0, 0, 0, width, 1, width);
    return (a, b) => {
      delta.subVectors(b, a);
      mesh.scale.y = delta.length();
      mesh.quaternion.setFromUnitVectors(up, delta.normalize());
      mesh.position.copy(a).lerp(b, .5);
    };
  }
  const arms = [-1, 1].map((sign) => {
    const shoulder = new T.Vector3(sign * .23, 1.405, .008);
    const elbow = new T.Vector3(), wrist = new T.Vector3();
    part(body, stone ? box : ball, main, sign * .248, 1.406, 0, .15, .111, .14);
    const upper = limb(body, .082, dark), fore = limb(body, .089, main);
    const palm = new T.Group(); body.add(palm);
    part(palm, ball, hand, 0, 0, 0, .061, .078, .034);
    const fingers = Array.from({ length: 4 }, (_, i) => part(palm, ball, hand, (i - 1.5) * .027,
      .08, 0, .013, .059 - .006 * Math.abs(i - 1), .014));
    part(palm, ball, hand, sign * .063, .035, 0, .019, .049, .018).rotation.z = -sign * .45;
    const sword = new T.Group();
    if (sign > 0) {
      palm.add(sword);
      part(sword, box, dark, 0, .013, 0, .043, .21, .056);
      part(sword, box, trim, 0, .109, 0, .19, .035, .05);
      part(sword, box, blade, 0, .31, 0, stone ? .101 : .066, stone ? .43 : .39, .023);
      part(sword, new T.ConeGeometry(.044, .16, 4), blade, 0, .56, 0, 1, 1, .34);
    }
    return ({ x, y, z, angle, tilt, open }) => {
      wrist.set(x, y, z);
      elbow.copy(shoulder).lerp(wrist, .49);
      elbow.x += sign * .12; elbow.y -= .16;
      upper(shoulder, elbow); fore(elbow, wrist);
      palm.position.copy(wrist); palm.rotation.set(tilt, sign * .17, angle);
      for (const finger of fingers) finger.rotation.x = open ? 0 : 1.25;
    };
  });
  const legs = [-1, 1].map((sign) => {
    const hip = new T.Vector3(), knee = new T.Vector3(), foot = new T.Vector3();
    const upper = limb(standIn, .097, dark), shin = limb(standIn, .093, main);
    const boot = part(standIn, box, dark, 0, 0, 0, .17, .13, .32);
    return (sway, crouch, lunge) => {
      hip.set(sign * .133, .92 - crouch, 0);
      foot.set(sign * (.177 + lunge * .078), .078, sign * (.16 + lunge * .27) + sway);
      knee.copy(hip).lerp(foot, .55); knee.z += .105 + crouch * .65;
      upper(hip, knee); shin(knee, foot);
      boot.position.copy(foot); boot.position.z += .067;
    };
  });
  standIn.scale.setScalar(size / 1.85);

  let model, mixer, tracks, rig, lastAction, activeTrack, dead = false;
  const target = new T.Vector3(), from = new T.Vector3(), to = new T.Vector3();
  const rotation = new T.Quaternion(), rest = new Map();
  if (file) loader.load(base + file, ({ scene: asset, animations }) => {
    if (dead) { disposeTree(asset); return; }
    model = asset;
    model.visible = false;
    model.traverse((item) => { if (item.isMesh) { item.castShadow = true; item.receiveShadow = true; } });
    root.add(model);
    mixer = new T.AnimationMixer(model);
    tracks = new Map(animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    const joint = (side, ...names) => {
      for (const name of names) {
        const match = model.getObjectByName(name + side) ?? model.getObjectByName(name + '.' + side);
        if (match) return match;
      }
    };
    rig = Object.fromEntries(['L', 'R'].map((side) => [side,
      [joint(side, 'Hand'), joint(side, ...profile.elbows), joint(side, 'Arm', 'Shoulder')]]));
    if (lastAction === 'guard') lastAction = undefined;
  }, undefined, () => {});
  function pose(action, progress, time, reduced, contact) {
    for (const [joint, authored] of rest) joint.quaternion.copy(authored);
    rest.clear();
    const name = action === 'guard' ? profile.guard : action === 'counter' ? profile.counter : clips[action];
    if (action !== lastAction) {
      activeTrack?.stop();
      activeTrack = tracks?.get(name);
      activeTrack?.reset().play();
      lastAction = action;
    }
    if (model) model.visible = Boolean(activeTrack);
    standIn.visible = !activeTrack;
    if (activeTrack) {
      const length = activeTrack.getClip().duration;
      const fraction = action === 'guard' ? (reduced ? 0 : time % length / length) :
        action === 'fallen' ? .998 : action === 'death' ? smooth((progress - .46) / .54) * .998 :
          action === 'feint' ? pulse(progress) * .52 : Math.min(.998, progress);
      activeTrack.time = fraction * length;
      mixer.update(0);
      return;
    }
    const e = pulse(progress), wind = Math.sin(Math.PI * Math.min(1, progress / .48));
    const fall = action === 'fallen' ? 1 : action === 'death' ? smooth((progress - .49) / .51) : 0;
    const dodge = action === 'dodge' ? e : 0;
    const lunge = ['strike', 'counter'].includes(action) ? e : 0;
    const crouch = dodge * .32 + (action === 'hit' ? e * .19 : lunge * .11) + Math.sin(Math.PI * fall) * .2;
    const sway = reduced ? 0 : Math.sin(time * 4.2) * .045;
    standIn.rotation.x = -fall * 1.52;
    standIn.position.set(0, fall * size * .16, 0);
    body.position.set(dodge * -.18, -crouch + sway * .16, lunge * .1);
    body.rotation.set(dodge * -.23 + lunge * .26 - (action === 'hit' ? e * .32 : 0),
      action === 'parry' ? e * -.43 : lunge * .29, dodge * -.24);
    const left = { x: -.23, y: 1.32, z: .28, tilt: .2, angle: .47 };
    const right = { x: .22, y: 1.23, z: .27, tilt: -.33, angle: -.45 };
    if (action === 'block') {
      Object.assign(left, { x: -.23 + .27 * e, y: 1.32 + .18 * e, z: .28 + .51 * e, tilt: -.16, angle: .12, open: true });
      Object.assign(right, { x: .24 - .2 * e, y: 1.27 + .1 * e, z: .3 + .25 * e, tilt: .24, angle: -1.24 });
    } else if (action === 'parry') {
      const sweep = smooth((progress - .29) / .39);
      Object.assign(left, { x: -.26 + e * (.66 - sweep * .97), y: 1.35 + .11 * e, z: .28 + .48 * e, angle: .45 + 1.1 * e, open: true });
      Object.assign(right, { x: .23 + .13 * e, y: 1.17 + .27 * e, z: .3 + .31 * e, tilt: -.62, angle: -1.05 + sweep * .84 });
    } else if (action === 'strike' || action === 'feint' || action === 'counter') {
      const reach = (action === 'feint' ? .37 : .71) * e;
      Object.assign(right, { x: .22 + .22 * wind - e * (.13 + .26 * smooth((progress - .45) / .3)),
        y: 1.23 + .33 * wind + .15 * e, z: .27 - .34 * wind + reach,
        tilt: -.33 + .94 * e - wind * .32, angle: -.45 + 1.32 * e });
      Object.assign(left, { x: -.23 - .16 * e, y: 1.32 - .12 * e, z: .29 - .27 * e });
    } else if (action === 'dodge' || action === 'hit' || fall) {
      Object.assign(left, { x: -.23 - .32 * Math.max(e, fall), y: 1.32 - .36 * fall, angle: .46 + .75 * e, open: true });
      Object.assign(right, { x: .22 + .28 * Math.max(e, fall), y: 1.23 - .38 * fall, angle: -.45 - .65 * e });
    } else if (action === 'victory') {
      right.y += .12 * smooth(progress); right.angle -= .28 * smooth(progress);
    }
    if (contact && ['strike', 'feint', 'counter', 'block', 'parry'].includes(action)) {
      const defending = ['block', 'parry'].includes(action);
      const cross = action === 'counter' ? smooth((progress - .58) / .18) : 0;
      target.copy(contact);
      body.worldToLocal(target);
      const wrist = defending ? left : right;
      wrist.x = T.MathUtils.lerp(wrist.x, target.x - cross * .31, e);
      wrist.y = T.MathUtils.lerp(wrist.y, target.y - (defending ? .065 : 0), e);
      wrist.z = T.MathUtils.lerp(wrist.z, target.z - (defending ? 0 : .39), e);
      if (!defending) {
        wrist.tilt = T.MathUtils.lerp(wrist.tilt, 1.64, e);
        wrist.angle = T.MathUtils.lerp(wrist.angle, .03 + cross * .48, e);
      }
    }
    arms[0](left); arms[1](right);
    for (const leg of legs) leg(sway, crouch, lunge);
  }
  function alignHands(action, point, strength) {
    if (!activeTrack || !rig || strength <= 0) return;
    const defense = action === 'block' || action === 'parry';
    const side = defense ? (profile.weapon === 'L' ? 'R' : 'L') : profile.weapon;
    const [handJoint, elbow, shoulder] = rig[side];
    if (!handJoint || !elbow || !shoulder) return;
    target.copy(point);
    if (!defense) target.x += Math.sign(root.position.x) * .12;
    for (const joint of [elbow, shoulder]) rest.set(joint, joint.quaternion.clone());
    for (let pass = 0; pass < 3; pass++) for (const joint of [elbow, shoulder]) {
      joint.worldToLocal(handJoint.getWorldPosition(from)).normalize();
      joint.worldToLocal(to.copy(target)).normalize();
      rotation.setFromUnitVectors(from, to);
      joint.quaternion.multiply(rotation);
    }
    for (const [joint, authored] of rest) joint.quaternion.slerp(authored, 1 - strength);
  }
  return { root, pose, alignHands, dispose() {
    dead = true;
    mixer?.stopAllAction();
    disposeTree(root);
    root.removeFromParent();
  } };
}
