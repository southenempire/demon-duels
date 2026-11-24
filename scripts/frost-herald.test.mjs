import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Frost Herald GLB follows the boss rig, scale and clip contract', () => {
  const glb = readFileSync(new URL('../web/public/models/frost-herald.glb', import.meta.url));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  assert.ok(glb.length < 3_000_000);
  const { accessors, animations, meshes, nodes, skins } = JSON.parse(
    glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)),
  );
  assert.equal(skins.length, 1);
  const joints = new Set(skins[0].joints.map((index) => nodes[index].name));
  for (const side of ['L', 'R']) {
    for (const name of ['Arm', 'Forearm', 'Hand', 'Thigh', 'Shin', 'Foot']) {
      assert.ok(joints.has(name + side), `missing joint ${name + side}`);
    }
  }
  const primitives = meshes.flatMap((mesh) => mesh.primitives);
  assert.ok(primitives.every(({ attributes }) => 'JOINTS_0' in attributes && 'WEIGHTS_0' in attributes));
  const tris = primitives.reduce((sum, { indices }) => sum + accessors[indices].count / 3, 0);
  assert.ok(tris >= 17_000 && tris <= 23_000, `${tris} triangles`);
  const positions = primitives.map(({ attributes }) => accessors[attributes.POSITION]);
  assert.equal(Math.min(...positions.map(({ min }) => min[1])), 0);
  assert.ok(Math.abs(Math.max(...positions.map(({ max }) => max[1])) - 3) < .02);
  assert.deepEqual(animations.map(({ name }) => name).sort(),
    ['Idle', 'Walk', 'Alert', 'Strike', 'Heavy', 'Block', 'Parry', 'Dodge', 'HitReact', 'Death', 'Victory'].sort());
  for (const { name, channels, samplers } of animations) {
    assert.ok(channels.some(({ target }) => joints.has(nodes[target.node].name) &&
      target.path === 'rotation'), `${name} does not animate the rig`);
    assert.ok(Math.max(...samplers.map(({ input }) => accessors[input].max[0])) > .9, `${name} is too short`);
  }
});
